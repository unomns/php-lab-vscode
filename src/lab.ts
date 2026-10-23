/**
 * Ties everything together for one run:
 * prepare the code → find PHP → run it → show output, inline result and diagnostics.
 */
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { parsePhpErrors, PhpError, prepareCode, rewriteScriptPaths } from './codePrep';
import { InlineResults, summarize } from './inlineResults';
import { describeResult, formatDuration, LabOutput } from './output';
import { clearPhpCache, getPhpVersion, resolvePhpPath } from './phpLocator';
import { OneShotRunner, PhpRunner, PhpStartError, RunResult } from './runner';

/** What to run: some lines of a document. */
export interface RunTarget {
	document: vscode.TextDocument;
	code: string;
	/** Line where `code` starts (0-based), used to map PHP's line numbers. */
	startLine: number;
	/** Line after which the inline result is shown. */
	endLine: number;
	/** Shown in the Output channel, e.g. `demo.php · cell "Arrays" (lines 8–12)`. */
	title: string;
}

interface LabConfig {
	phpPath: string;
	timeoutSeconds: number;
	showInlineResult: boolean;
}

function getConfig(document?: vscode.TextDocument): LabConfig {
	const config = vscode.workspace.getConfiguration('phpLab', document?.uri);
	return {
		phpPath: config.get<string>('phpPath', 'php'),
		timeoutSeconds: Math.max(1, config.get<number>('timeout', 10)),
		showInlineResult: config.get<boolean>('showInlineResult', true),
	};
}

const SEVERITY: Record<PhpError['severity'], vscode.DiagnosticSeverity> = {
	error: vscode.DiagnosticSeverity.Error,
	warning: vscode.DiagnosticSeverity.Warning,
	info: vscode.DiagnosticSeverity.Information,
};

export class PhpLab implements vscode.Disposable {
	private readonly output = new LabOutput();
	private readonly inlineResults = new InlineResults();
	private readonly diagnostics = vscode.languages.createDiagnosticCollection('PHP Lab');
	private readonly disposables: vscode.Disposable[] = [];
	/** The run in progress, so a new run can wait for it to wind down. */
	private running: Promise<unknown> = Promise.resolve();

	constructor(private readonly runner: PhpRunner = new OneShotRunner()) {
		this.disposables.push(
			// Squiggles from the last run are stale once you start editing.
			vscode.workspace.onDidChangeTextDocument(event => {
				if (event.contentChanges.length) {
					this.diagnostics.delete(event.document.uri);
				}
			}),
			vscode.workspace.onDidChangeConfiguration(event => {
				if (event.affectsConfiguration('phpLab.phpPath')) {
					clearPhpCache();
				}
				if (event.affectsConfiguration('phpLab.showInlineResult') && !getConfig().showInlineResult) {
					this.inlineResults.clear();
				}
			}),
		);
	}

	/** Runs the target. Only one run at a time: starting a new one stops the previous one. */
	run(target: RunTarget): Promise<RunResult | undefined> {
		this.runner.cancel();
		const next = this.running.then(() => this.execute(target));
		this.running = next.catch(() => undefined);
		return next;
	}

	private async execute(target: RunTarget): Promise<RunResult | undefined> {
		const { document } = target;
		const source = prepareCode(target.code);
		if (!source) {
			void vscode.window.showInformationMessage('PHP Lab: there is no code to run here.');
			return undefined;
		}

		const config = getConfig(document);
		const phpPath = resolvePhpPath(config.phpPath);
		if (!phpPath) {
			void this.showPhpNotFound(config.phpPath);
			return undefined;
		}

		const name = displayName(document);
		// PHP reports "line N" of the temp file; line N of the snippet is line startLine + N of the document.
		const rewrite = (text: string, scriptPath: string) => rewriteScriptPaths(text, scriptPath, name, target.startLine);

		this.output.start(target.title, await getPhpVersion(phpPath));
		this.diagnostics.delete(document.uri);

		let result: RunResult;
		try {
			const running = this.runner.run({
				phpPath,
				source,
				cwd: workingDirectory(document),
				timeoutMs: config.timeoutSeconds * 1000,
				onOutput: (text, _stream, scriptPath) => this.output.append(rewrite(text, scriptPath)),
			});
			vscode.window.setStatusBarMessage('$(sync~spin) PHP Lab: running…', running);
			result = await running;
		} catch (error) {
			if (error instanceof PhpStartError) {
				clearPhpCache();
				this.output.note(`✖ ${error.message}`);
				void this.showPhpNotFound(config.phpPath);
				return undefined;
			}
			throw error;
		}

		this.output.finish(result, config.timeoutSeconds);

		const errors = parsePhpErrors(result.stderr, result.scriptPath);
		this.showDiagnostics(target, errors);
		if (config.showInlineResult) {
			const fullOutput = rewrite(result.stdout + result.stderr, result.scriptPath);
			this.showInlineResult(target, result, errors, fullOutput, config.timeoutSeconds);
		}
		return result;
	}

	private showDiagnostics(target: RunTarget, errors: PhpError[]): void {
		const diagnostics = errors.map(error => {
			const line = Math.min(target.startLine + error.line - 1, target.document.lineCount - 1);
			const diagnostic = new vscode.Diagnostic(target.document.lineAt(line).range, error.message, SEVERITY[error.severity]);
			diagnostic.source = 'PHP Lab';
			return diagnostic;
		});
		this.diagnostics.set(target.document.uri, diagnostics);
	}

	private showInlineResult(target: RunTarget, result: RunResult, errors: PhpError[], fullOutput: string, timeoutSeconds: number): void {
		const time = formatDuration(result.durationMs);
		let summary: string;
		if (result.stopReason) {
			summary = describeResult(result, timeoutSeconds);
		} else if (errors.length) {
			const [first] = errors;
			const more = errors.length > 1 ? ` (+${errors.length - 1} more)` : '';
			summary = `✖ ${first.message} (line ${target.startLine + first.line})${more} · ${time}`;
		} else if (result.exitCode !== 0) {
			summary = `✖ ${summarize(fullOutput) || `exit code ${result.exitCode}`} · ${time}`;
		} else {
			summary = `⇒ ${summarize(result.stdout) || '(no output)'} · ${time}`;
		}
		const isError = Boolean(result.stopReason) || result.exitCode !== 0 || errors.length > 0;
		this.inlineResults.show(target.document, target.startLine, target.endLine, summary, fullOutput, isError);
	}

	private async showPhpNotFound(configured: string): Promise<void> {
		const hints: Partial<Record<NodeJS.Platform, string>> = {
			darwin: 'Install it with Homebrew ("brew install php")',
			win32: 'Download it from windows.php.net',
			linux: 'Install it with your package manager (e.g. "sudo apt install php-cli")',
		};
		const hint = hints[process.platform] ?? hints.linux;
		const message = `PHP Lab could not find PHP ("${configured}"). ${hint}, or set "phpLab.phpPath" to the full path of the php executable.`;

		const openSettings = 'Open Settings';
		const guide = 'Installation Guide';
		const choice = await vscode.window.showErrorMessage(message, openSettings, guide);
		if (choice === openSettings) {
			await vscode.commands.executeCommand('workbench.action.openSettings', 'phpLab.phpPath');
		} else if (choice === guide) {
			await vscode.env.openExternal(vscode.Uri.parse('https://www.php.net/manual/en/install.php'));
		}
	}

	dispose(): void {
		this.runner.cancel();
		this.output.dispose();
		this.inlineResults.dispose();
		this.diagnostics.dispose();
		this.disposables.forEach(d => d.dispose());
	}
}

/** "demo.php" for saved files, "Untitled-1" for new ones. */
export function displayName(document: vscode.TextDocument): string {
	return document.isUntitled ? document.uri.path : path.basename(document.uri.fsPath);
}

/** The file's folder, so relative paths in `include` / `file_get_contents` work as expected. */
function workingDirectory(document: vscode.TextDocument): string {
	if (document.uri.scheme === 'file') {
		return path.dirname(document.uri.fsPath);
	}
	const folder = vscode.workspace.workspaceFolders?.find(f => f.uri.scheme === 'file');
	return folder?.uri.fsPath ?? os.homedir();
}
