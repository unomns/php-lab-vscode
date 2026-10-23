/**
 * "▶ Run Cell" links above every `// %%` cell.
 */
import * as vscode from 'vscode';
import { hasCode, parseCells } from './cells';

export class CellCodeLensProvider implements vscode.CodeLensProvider {
	provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
		const lines = documentLines(document);
		const cells = parseCells(lines);

		// A file without any `// %%` marker is a single cell: no lens needed,
		// "PHP: Run Selection" without a selection runs the whole file.
		if (cells.length === 1 && cells[0].markerLine === -1) {
			return [];
		}

		return cells
			.filter(cell => cell.markerLine >= 0 || hasCode(lines, cell))
			.map(cell => {
				const line = cell.markerLine >= 0 ? cell.markerLine : cell.startLine;
				return new vscode.CodeLens(new vscode.Range(line, 0, line, 0), {
					title: '▶ Run Cell',
					tooltip: cell.title ? `Run cell "${cell.title}"` : 'Run this cell',
					command: 'phpLab.runCell',
					arguments: [document.uri, line],
				});
			});
	}
}

export function documentLines(document: vscode.TextDocument): string[] {
	return document.getText().split(/\r?\n/);
}
