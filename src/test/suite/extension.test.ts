/**
 * End-to-end tests: run inside a real VS Code instance (`npm run test:integration`)
 * and need PHP to be installed.
 */
import * as assert from 'assert';
import * as vscode from 'vscode';
import { RunResult } from '../../runner';

async function openPhp(content: string): Promise<vscode.TextEditor> {
	const document = await vscode.workspace.openTextDocument({ language: 'php', content });
	return vscode.window.showTextDocument(document);
}

function runSelection(): Thenable<RunResult | undefined> {
	return vscode.commands.executeCommand<RunResult | undefined>('phpLab.runSelection');
}

suite('PHP Lab (in VS Code)', () => {
	const config = () => vscode.workspace.getConfiguration('phpLab');

	teardown(async () => {
		await config().update('timeout', undefined, vscode.ConfigurationTarget.Global);
		await config().update('phpPath', undefined, vscode.ConfigurationTarget.Global);
		await vscode.commands.executeCommand('workbench.action.closeAllEditors');
	});

	test('runs the selected code', async () => {
		const editor = await openPhp('<?php\necho "one";\necho "two";\n');
		editor.selection = new vscode.Selection(2, 0, 2, 12);
		const result = await runSelection();
		assert.strictEqual(result?.stdout, 'two');
		assert.strictEqual(result?.exitCode, 0);
	});

	test('runs the cell under the cursor when nothing is selected', async () => {
		const editor = await openPhp('<?php\n// %% A\necho "a";\n// %% B\necho "b";\n');
		editor.selection = new vscode.Selection(4, 0, 4, 0);
		assert.strictEqual((await runSelection())?.stdout, 'b');
	});

	test('reports PHP errors on the right line of the document', async () => {
		const editor = await openPhp('<?php\n// %% A\necho "a";\n// %% B\n$x = 1;\necho $missing;\n');
		editor.selection = new vscode.Selection(5, 0, 5, 0);
		const result = await runSelection();
		assert.match(result?.stderr ?? '', /Undefined variable \$missing/);

		const diagnostics = vscode.languages.getDiagnostics(editor.document.uri);
		assert.strictEqual(diagnostics.length, 1);
		assert.strictEqual(diagnostics[0].range.start.line, 5);
		assert.strictEqual(diagnostics[0].severity, vscode.DiagnosticSeverity.Warning);
	});

	test('stops the process after the timeout', async () => {
		await config().update('timeout', 1, vscode.ConfigurationTarget.Global);
		const editor = await openPhp('<?php\nwhile (true) {}\n');
		editor.selection = new vscode.Selection(1, 0, 1, 0);
		const result = await runSelection();
		assert.strictEqual(result?.stopReason, 'timeout');
	});

	test('does not run anything when php is missing', async () => {
		await config().update('phpPath', '/no/such/php', vscode.ConfigurationTarget.Global);
		const editor = await openPhp('<?php\necho 1;\n');
		editor.selection = new vscode.Selection(1, 0, 1, 0);
		assert.strictEqual(await runSelection(), undefined);
	});

	test('shows a "Run Cell" CodeLens for each cell', async () => {
		const editor = await openPhp('<?php\n// %% A\necho 1;\n// %% B\necho 2;\n');
		const lenses = await vscode.commands.executeCommand<vscode.CodeLens[]>(
			'vscode.executeCodeLensProvider', editor.document.uri);
		const ours = lenses.filter(lens => lens.command?.command === 'phpLab.runCell');
		assert.deepStrictEqual(ours.map(lens => lens.range.start.line), [1, 3]);
	});

	test('opens a scratch file', async () => {
		await vscode.commands.executeCommand('phpLab.newScratchFile');
		const document = vscode.window.activeTextEditor?.document;
		assert.strictEqual(document?.languageId, 'php');
		assert.match(document?.getText() ?? '', /\/\/ %% Hello/);
	});
});
