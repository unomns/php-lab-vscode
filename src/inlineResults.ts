/**
 * Short results shown at the end of the last line of a cell/selection,
 * e.g. `  ⇒ Hello world · 3 ms`. Hover over it to see the full output.
 *
 * Results stay in place while you edit other parts of the file (they move up
 * and down with the text) and disappear as soon as you edit the code they belong to.
 */
import * as vscode from 'vscode';

interface InlineResult {
	/** First and last line of the code that produced the result. */
	startLine: number;
	endLine: number;
	text: string;
	fullOutput: string;
	isError: boolean;
}

const MAX_INLINE_LENGTH = 100;

export class InlineResults implements vscode.Disposable {
	private readonly results = new Map<string, InlineResult[]>();
	private readonly disposables: vscode.Disposable[] = [];

	private readonly okStyle = vscode.window.createTextEditorDecorationType({
		after: { color: new vscode.ThemeColor('editorCodeLens.foreground'), margin: '0 0 0 2em', fontStyle: 'italic' },
	});
	private readonly errorStyle = vscode.window.createTextEditorDecorationType({
		after: { color: new vscode.ThemeColor('editorError.foreground'), margin: '0 0 0 2em', fontStyle: 'italic' },
	});

	constructor() {
		this.disposables.push(
			vscode.workspace.onDidChangeTextDocument(event => this.onEdit(event)),
			vscode.workspace.onDidCloseTextDocument(document => this.results.delete(document.uri.toString())),
			// Editors are re-created when you switch tabs, so decorations must be re-applied.
			vscode.window.onDidChangeVisibleTextEditors(editors => editors.forEach(editor => this.render(editor))),
		);
	}

	/** Shows a result after `endLine`, replacing any older result for the same lines. */
	show(document: vscode.TextDocument, startLine: number, endLine: number, summary: string, fullOutput: string, isError: boolean): void {
		const key = document.uri.toString();
		const others = (this.results.get(key) ?? []).filter(r => r.endLine < startLine || r.startLine > endLine);
		others.push({ startLine, endLine, text: summary, fullOutput, isError });
		this.results.set(key, others);
		this.renderDocument(document);
	}

	clear(document?: vscode.TextDocument): void {
		if (document) {
			this.results.delete(document.uri.toString());
		} else {
			this.results.clear();
		}
		vscode.window.visibleTextEditors.forEach(editor => this.render(editor));
	}

	/** Drops results whose code was edited and moves the ones below the edit. */
	private onEdit(event: vscode.TextDocumentChangeEvent): void {
		const key = event.document.uri.toString();
		let results = this.results.get(key);
		if (!results?.length || !event.contentChanges.length) {
			return;
		}
		for (const change of event.contentChanges) {
			const first = change.range.start.line;
			const last = change.range.end.line;
			const delta = change.text.split('\n').length - 1 - (last - first);
			results = results
				.filter(r => r.endLine < first || r.startLine > last)
				.map(r => r.startLine > last ? { ...r, startLine: r.startLine + delta, endLine: r.endLine + delta } : r);
		}
		this.results.set(key, results);
		this.renderDocument(event.document);
	}

	private renderDocument(document: vscode.TextDocument): void {
		vscode.window.visibleTextEditors
			.filter(editor => editor.document === document)
			.forEach(editor => this.render(editor));
	}

	private render(editor: vscode.TextEditor): void {
		const results = this.results.get(editor.document.uri.toString()) ?? [];
		const toDecoration = (r: InlineResult): vscode.DecorationOptions => {
			const line = Math.min(r.endLine, editor.document.lineCount - 1);
			const end = editor.document.lineAt(line).range.end;
			const hover = new vscode.MarkdownString().appendCodeblock(r.fullOutput.slice(0, 5000) || '(no output)', 'text');
			return {
				range: new vscode.Range(end, end),
				hoverMessage: hover,
				renderOptions: { after: { contentText: r.text } },
			};
		};
		editor.setDecorations(this.okStyle, results.filter(r => !r.isError).map(toDecoration));
		editor.setDecorations(this.errorStyle, results.filter(r => r.isError).map(toDecoration));
	}

	dispose(): void {
		this.okStyle.dispose();
		this.errorStyle.dispose();
		this.disposables.forEach(d => d.dispose());
	}
}

/** Squeezes multi-line output into one short line: "Array ↵ ( ↵ [0] => 1 …". */
export function summarize(output: string): string {
	const oneLine = output
		.split(/\r?\n/)
		.map(line => line.trim())
		.filter(Boolean)
		.join(' ↵ ');
	return oneLine.length > MAX_INLINE_LENGTH ? `${oneLine.slice(0, MAX_INLINE_LENGTH - 1)}…` : oneLine;
}
