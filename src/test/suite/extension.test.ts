/**
 * End-to-end tests: run inside a real VS Code instance (`npm run test:integration`)
 * and need PHP to be installed.
 */
import * as assert from 'assert';
import * as vscode from 'vscode';
import { PhpLabApi } from '../../extension';
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

	test('creates a scratch file that is saved on disk', async () => {
		await vscode.commands.executeCommand('phpLab.newScratchFile');
		const document = vscode.window.activeTextEditor?.document;
		assert.strictEqual(document?.languageId, 'php');
		assert.strictEqual(document?.isUntitled, false);
		assert.match(document?.uri.path ?? '', /\/scratches\/scratch-\d{8}-\d{6}\.php$/);

		// One "Run Cell" button at the top, which runs the whole scratch.
		const lenses = await vscode.commands.executeCommand<vscode.CodeLens[]>('vscode.executeCodeLensProvider', document!.uri);
		assert.deepStrictEqual(lenses.filter(l => l.command?.command === 'phpLab.runCell').map(l => l.range.start.line), [2]);
		assert.match((await runSelection())?.stdout ?? '', /^Hello from PHP Lab on PHP .*!\nArray\n/);

		// A second scratch in the same second gets its own file.
		await vscode.commands.executeCommand('phpLab.newScratchFile');
		assert.notStrictEqual(vscode.window.activeTextEditor?.document.uri.toString(), document?.uri.toString());
	});

	test('lists scratch files in the Explorer view, newest first', async () => {
		const api = vscode.extensions.getExtension<PhpLabApi>('unomns.php-lab-vscode')!.exports;
		await vscode.commands.executeCommand('phpLab.newScratchFile');
		const editor = vscode.window.activeTextEditor!;
		await editor.edit(edit => edit.insert(new vscode.Position(0, 5), '\n// newest'));
		await editor.document.save();
		const uri = editor.document.uri;
		await vscode.commands.executeCommand('workbench.action.closeAllEditors');

		// The view is there, in the Explorer.
		await vscode.commands.executeCommand('phpLab.scratches.focus');

		const items = await api.scratches.getChildren();
		assert.strictEqual(items[0].toString(), uri.toString());

		// Clicking an item opens the file.
		const item = api.scratches.getTreeItem(items[0]);
		await vscode.commands.executeCommand(item.command!.command, ...item.command!.arguments!);
		assert.match(vscode.window.activeTextEditor?.document.getText() ?? '', /\/\/ newest/);
	});
});
