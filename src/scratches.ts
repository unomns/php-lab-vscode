/**
 * Scratch files: small PHP files to try things out, kept in PHP Lab's own
 * storage folder (not in a project), so they're still there after closing them.
 *
 * They are listed in the "Scratches" view in the Explorer sidebar, newest first:
 * click one to open it, use the + button for a new one, and right-click to
 * rename or delete.
 */
import * as path from 'path';
import * as vscode from 'vscode';
import { scratchFileName } from './scratchNames';

// One `// %%` line at the top: its "▶ Run Cell" button runs the whole scratch.
const SCRATCH_TEMPLATE = `<?php

// %% PHP Lab scratch
// Run it with "▶ Run Cell" above or Cmd/Ctrl+Alt+Enter.
// Add more "// %%" lines to split it into separate cells.

$name = 'PHP Lab';
echo "Hello from {$name} on PHP " . PHP_VERSION . "!\\n";

$numbers = [3, 1, 2];
sort($numbers);
print_r($numbers);
`;

export class Scratches implements vscode.TreeDataProvider<vscode.Uri>, vscode.Disposable {
	/** e.g. ~/Library/Application Support/Code/User/globalStorage/<publisher>.php-lab-vscode/scratches */
	readonly folder: vscode.Uri;
	private readonly changed = new vscode.EventEmitter<void>();
	readonly onDidChangeTreeData = this.changed.event;
	private readonly disposables: vscode.Disposable[] = [this.changed];

	constructor(context: vscode.ExtensionContext) {
		this.folder = vscode.Uri.joinPath(context.globalStorageUri, 'scratches');

		// Keep the list up to date, also when files are changed in Finder / Explorer.
		const watcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(this.folder, '*.php'));
		const refresh = () => this.changed.fire();
		this.disposables.push(
			watcher,
			watcher.onDidCreate(refresh),
			watcher.onDidDelete(refresh),
			watcher.onDidChange(refresh),
			vscode.workspace.onDidSaveTextDocument(document => this.isScratch(document.uri) && refresh()),
		);
	}

	/** The scratch files, most recently changed first. */
	async getChildren(): Promise<vscode.Uri[]> {
		let entries: [string, vscode.FileType][];
		try {
			entries = await vscode.workspace.fs.readDirectory(this.folder);
		} catch {
			return []; // the folder doesn't exist until the first scratch is created
		}
		const files = await Promise.all(entries
			.filter(([name, type]) => type === vscode.FileType.File && name.endsWith('.php'))
			.map(async ([name]) => {
				const uri = vscode.Uri.joinPath(this.folder, name);
				return { uri, modified: (await vscode.workspace.fs.stat(uri)).mtime };
			}));
		return files.sort((a, b) => b.modified - a.modified).map(file => file.uri);
	}

	getTreeItem(uri: vscode.Uri): vscode.TreeItem {
		const item = new vscode.TreeItem(uri); // resourceUri: the label and file icon come from the file
		item.contextValue = 'phpLab.scratch';
		item.tooltip = uri.fsPath;
		item.command = { title: 'Open', command: 'vscode.open', arguments: [uri] };
		return item;
	}

	async create(): Promise<void> {
		await vscode.workspace.fs.createDirectory(this.folder);
		const uri = await this.unusedUri(scratchFileName(new Date()));
		await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(SCRATCH_TEMPLATE));
		this.changed.fire();

		const editor = await vscode.window.showTextDocument(uri);
		// Put the cursor on the first line of code, ready to press the shortcut.
		const position = new vscode.Position(6, 0);
		editor.selection = new vscode.Selection(position, position);
	}

	async rename(uri: vscode.Uri): Promise<void> {
		const oldName = path.basename(uri.path);
		const newName = await vscode.window.showInputBox({
			title: 'Rename Scratch File',
			value: oldName,
			valueSelection: [0, oldName.length - '.php'.length],
			validateInput: value => /^[^\\/:*?"<>|]+$/.test(value.trim()) ? undefined : 'Please enter a valid file name',
		});
		if (!newName || newName.trim() === oldName) {
			return;
		}
		const fileName = newName.trim().endsWith('.php') ? newName.trim() : `${newName.trim()}.php`;
		await vscode.workspace.fs.rename(uri, vscode.Uri.joinPath(this.folder, fileName), { overwrite: false });
		this.changed.fire();
	}

	async delete(uri: vscode.Uri): Promise<void> {
		const answer = await vscode.window.showWarningMessage(
			`Delete scratch file "${path.basename(uri.path)}"?`,
			{ modal: true, detail: 'It will be moved to the trash.' },
			'Delete',
		);
		if (answer === 'Delete') {
			await vscode.workspace.fs.delete(uri, { useTrash: true });
			this.changed.fire();
		}
	}

	revealFolder(): Thenable<unknown> {
		return vscode.commands.executeCommand('revealFileInOS', this.folder);
	}

	/** `name`, or `name-2`, `name-3`, … if a scratch was already created in the same second. */
	private async unusedUri(name: string): Promise<vscode.Uri> {
		for (let n = 1; ; n++) {
			const uri = vscode.Uri.joinPath(this.folder, n === 1 ? name : name.replace(/\.php$/, `-${n}.php`));
			try {
				await vscode.workspace.fs.stat(uri);
			} catch {
				return uri; // doesn't exist yet
			}
		}
	}

	private isScratch(uri: vscode.Uri): boolean {
		return uri.toString().startsWith(`${this.folder.toString()}/`);
	}

	dispose(): void {
		this.disposables.forEach(d => d.dispose());
	}
}
