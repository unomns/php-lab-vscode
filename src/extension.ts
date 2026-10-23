/**
 * PHP Lab: run PHP snippets and `// %%` cells with your local PHP.
 *
 * Entry point: registers the commands and the CodeLens provider.
 * The actual work happens in `lab.ts` (orchestration) and `runner.ts` (execution).
 */
import * as vscode from 'vscode';
import { findCellAt, lastCodeLine, parseCells } from './cells';
import { CellCodeLensProvider, documentLines } from './codeLens';
import { displayName, PhpLab } from './lab';
import { RunResult } from './runner';
import { Scratches } from './scratches';

/** Returned from activate() so the end-to-end tests can look at the Scratches view. */
export interface PhpLabApi {
	scratches: Scratches;
}

export function activate(context: vscode.ExtensionContext): PhpLabApi {
	const lab = new PhpLab();
	const scratches = new Scratches(context);

	context.subscriptions.push(
		lab,
		scratches,
		vscode.window.registerTreeDataProvider('phpLab.scratches', scratches),
		vscode.languages.registerCodeLensProvider({ language: 'php' }, new CellCodeLensProvider()),
		vscode.commands.registerCommand('phpLab.runSelection', runSelection),
		vscode.commands.registerCommand('phpLab.runCell', runCell),
		vscode.commands.registerCommand('phpLab.newScratchFile', () => scratches.create()),
		vscode.commands.registerCommand('phpLab.renameScratchFile', (uri: vscode.Uri) => scratches.rename(uri)),
		vscode.commands.registerCommand('phpLab.deleteScratchFile', (uri: vscode.Uri) => scratches.delete(uri)),
		vscode.commands.registerCommand('phpLab.revealScratchesFolder', () => scratches.revealFolder()),
	);

	/** Runs the selected text, or the current cell when nothing is selected. */
	function runSelection(): Promise<RunResult | undefined> | undefined {
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			return undefined;
		}
		const { document, selection } = editor;
		if (selection.isEmpty) {
			return runCellAt(document, selection.active.line);
		}

		// A selection that ends at the start of a line doesn't really include that line.
		const endLine = selection.end.character === 0 && selection.end.line > selection.start.line
			? selection.end.line - 1
			: selection.end.line;
		return lab.run({
			document,
			code: document.getText(selection),
			startLine: selection.start.line,
			endLine,
			title: `${displayName(document)} · selection (${describeLines(selection.start.line, endLine)})`,
		});
	}

	/** Runs the cell at `line` (from a CodeLens), or the cell under the cursor. */
	async function runCell(uri?: vscode.Uri, line?: number): Promise<RunResult | undefined> {
		const editor = vscode.window.activeTextEditor;
		const document = uri ? await vscode.workspace.openTextDocument(uri) : editor?.document;
		if (!document) {
			return undefined;
		}
		return runCellAt(document, line ?? editor?.selection.active.line ?? 0);
	}

	function runCellAt(document: vscode.TextDocument, line: number): Promise<RunResult | undefined> | undefined {
		const lines = documentLines(document);
		const cells = parseCells(lines);
		const cell = findCellAt(cells, line);
		if (!cell) {
			void vscode.window.showInformationMessage('PHP Lab: put the cursor inside a "// %%" cell, or select some code.');
			return undefined;
		}

		const isWholeFile = cells.length === 1 && cell.markerLine === -1;
		const what = isWholeFile ? 'file' : cell.title ? `cell "${cell.title}"` : 'cell';
		return lab.run({
			document,
			code: lines.slice(cell.startLine, cell.endLine + 1).join('\n'),
			startLine: cell.startLine,
			endLine: lastCodeLine(lines, cell) ?? cell.endLine,
			title: `${displayName(document)} · ${what} (${describeLines(cell.startLine, cell.endLine)})`,
		});
	}

	return { scratches };
}

/** "lines 3–7" (1-based, as shown in the editor). */
function describeLines(startLine: number, endLine: number): string {
	return startLine >= endLine ? `line ${startLine + 1}` : `lines ${startLine + 1}–${endLine + 1}`;
}

export function deactivate(): void {
	// Everything is cleaned up through context.subscriptions.
}
