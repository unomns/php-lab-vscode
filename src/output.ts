/**
 * The "PHP Lab" Output channel: one block per run, with a header
 * (what ran, PHP version) and a footer (exit status, execution time).
 */
import * as vscode from 'vscode';
import { RunResult } from './runner';

export class LabOutput implements vscode.Disposable {
	private readonly channel = vscode.window.createOutputChannel('PHP Lab');

	/** Starts a new block, e.g. "▶ demo.php · cell "Arrays" (lines 8–12) · PHP 8.4.4". */
	start(title: string, phpVersion: string): void {
		const time = new Date().toLocaleTimeString();
		this.channel.appendLine('');
		this.channel.appendLine(`▶ ${title} · PHP ${phpVersion} · ${time}`);
		this.channel.appendLine('─'.repeat(60));
		this.channel.show(true); // true = keep the focus in the editor
	}

	append(text: string): void {
		this.channel.append(text);
	}

	finish(result: RunResult, timeoutSeconds: number): void {
		const needsNewline = !(result.stdout + result.stderr).endsWith('\n') && (result.stdout + result.stderr) !== '';
		if (needsNewline) {
			this.channel.appendLine('');
		}
		this.channel.appendLine('─'.repeat(60));
		this.channel.appendLine(describeResult(result, timeoutSeconds));
	}

	/** Writes a line outside of a run, e.g. a "PHP not found" note. */
	note(message: string): void {
		this.channel.appendLine(message);
	}

	dispose(): void {
		this.channel.dispose();
	}
}

/** A one-line summary of how a run ended, also used for the inline result. */
export function describeResult(result: RunResult, timeoutSeconds: number): string {
	const time = formatDuration(result.durationMs);
	switch (result.stopReason) {
		case 'timeout':
			return `⏱ Stopped after the ${timeoutSeconds}s timeout (setting "phpLab.timeout")`;
		case 'outputLimit':
			return `✋ Stopped after ${time}: too much output (over 1 MB)`;
		case 'cancelled':
			return `■ Cancelled after ${time}`;
	}
	return result.exitCode === 0
		? `✔ Finished in ${time}`
		: `✖ Exited with code ${result.exitCode} after ${time}`;
}

export function formatDuration(ms: number): string {
	return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(2)} s`;
}
