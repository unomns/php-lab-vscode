# PHP Lab

Run small PHP snippets right in the editor with **your local PHP** — a mix of
Jupyter-style cells and an online PHP sandbox.

![PHP Lab demo](images/demo.gif)
<!-- TODO: replace images/demo.gif with a short screen recording (~10 s) of running cells. -->

## Features

- **Run Selection** — select some PHP and press <kbd>Cmd</kbd>+<kbd>Alt</kbd>+<kbd>Enter</kbd>
  (<kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>Enter</kbd> on Windows/Linux). Nothing selected? The current cell runs.
- **Cells** — split a `.php` file into cells with `// %%` lines, then click **▶ Run Cell** above any cell.
- **Scratch files** — **PHP: New Scratch File** creates a PHP file with sample code, like an online sandbox.
  Scratches are real files, listed in a **Scratches** view in the Explorer sidebar.
- **Output** — stdout and stderr stream into the **PHP Lab** Output panel, with the PHP version and execution time.
- **Inline results** — a short result appears after the last line that ran (`⇒ Hello · 3 ms`). Hover over it for the full output.
- **Clear errors** — errors and warnings are reported with the line number *in your file*
  and underlined in the editor (they also appear in the Problems panel).
- **Timeout** — runaway scripts are stopped after 10 seconds (configurable).

## Requirements

PHP (any recent version) installed locally:

| OS      | Install                                                                 |
|---------|-------------------------------------------------------------------------|
| macOS   | `brew install php` ([Homebrew](https://brew.sh))                        |
| Windows | Download from [windows.php.net](https://windows.php.net/download/), unzip to e.g. `C:\php`, and add it to `PATH` |
| Linux   | `sudo apt install php-cli` (Debian/Ubuntu) or your distribution's package |

PHP Lab looks for `php` on your `PATH` and in common install locations
(`/opt/homebrew/bin/php`, `/usr/local/bin/php`, Laravel Herd, `C:\php`, `C:\xampp\php`, …).
If it still can't find PHP, it shows a message with a button that opens the `phpLab.phpPath` setting.

## Installation

- **VS Code Marketplace:** search for **PHP Lab** in the Extensions view (<kbd>Cmd/Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>X</kbd>).
- **Open VSX** (VSCodium, Cursor, Gitpod, …): search for **PHP Lab**, or get it from [open-vsx.org](https://open-vsx.org).
- **From a `.vsix` file:** Extensions view → `…` menu → **Install from VSIX…**, or run
  `code --install-extension php-lab-vscode-0.1.0.vsix`.

## Usage

### Cells

Lines that start with `// %%` split a file into cells. Text after `%%` is an optional title.

```php
<?php

// %% Strings
echo str_pad('PHP', 9, '*', STR_PAD_BOTH);

// %% Arrays
$numbers = [3, 1, 2];
sort($numbers);
print_r($numbers);
```

A **▶ Run Cell** link appears above every cell. A cell goes from the line after its `// %%`
to the line before the next `// %%` (or to the end of the file); blank lines don't end a cell.
A file without `// %%` lines is a single cell, so the shortcut runs the whole file.

### Running code

| You do                                    | PHP Lab runs                     |
|-------------------------------------------|----------------------------------|
| Select code, press the shortcut           | the selection                    |
| Press the shortcut with nothing selected  | the cell under the cursor        |
| Click **▶ Run Cell**                      | that cell                        |

Each run is plain PHP on its own: no project code (Composer autoloader, framework) is loaded,
and variables from one run are **not** available in the next. The code runs with the file's
folder as the working directory (your home folder for unsaved files), so relative paths work
like in a terminal. For code that needs your application, use a debugger such as Xdebug or
your framework's REPL (e.g. `php artisan tinker`).

You don't need to write `<?php` (it's added for you), but it's fine if your code has it.
A trailing `?>` is removed.

### Scratch files

Scratches are listed in the **Scratches** view in the Explorer sidebar (below your project
folder and Timeline), newest first. Click one to open it.

- **+** in the view's title bar (or **PHP: New Scratch File**) creates a new scratch,
  e.g. `scratch-20261024-043712.php`, with sample code and one `// %%` line at the top,
  so its **▶ Run Cell** button runs the whole scratch.
- Right-click a scratch to **Rename…** or **Delete** it (deleted files go to the trash).
- The folder button reveals the scratches folder in Finder / File Explorer.

Scratches are kept in PHP Lab's own storage folder, not in your projects, so they are the same in
every window and survive closing VS Code. Save your changes as usual (<kbd>Cmd/Ctrl</kbd>+<kbd>S</kbd>,
or turn on VS Code's Auto Save). Scratches run with their own folder as the working directory, so
files they create with relative paths end up next to them.

To move or hide the view, right-click the Explorer's view headers.

### Commands

| Command                  | Description                                            |
|--------------------------|--------------------------------------------------------|
| `PHP: Run Selection`     | Run the selection, or the current cell if nothing is selected |
| `PHP: New Scratch File`  | Create a scratch file with sample code                 |

`PHP: Run Selection` is also in the editor's right-click menu.

## Keyboard shortcuts

| Command              | macOS                                         | Windows / Linux                                |
|----------------------|-----------------------------------------------|------------------------------------------------|
| `PHP: Run Selection` | <kbd>Cmd</kbd>+<kbd>Alt</kbd>+<kbd>Enter</kbd> | <kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>Enter</kbd> |

The shortcut is only active while the cursor is in a PHP editor
(`editorTextFocus && editorLangId == php && !notebookEditorFocused && !inChat`),
so it doesn't take over VS Code's own uses of the same keys:

- **Find widget → Replace All** keeps working while the cursor is in the Find/Replace box.
- **Notebooks → Execute Cell** (Windows) and **Chat** actions are excluded.
- **Search view → Replace All** is in a different part of the window and is unaffected.

To change the shortcut, open **Preferences: Open Keyboard Shortcuts**
(<kbd>Cmd/Ctrl</kbd>+<kbd>K</kbd> <kbd>Cmd/Ctrl</kbd>+<kbd>S</kbd>), search for `phpLab`,
and double-click the binding. Or add this to `keybindings.json`:

```json
{
  "key": "shift+enter",
  "command": "phpLab.runSelection",
  "when": "editorTextFocus && editorLangId == php"
}
```

## Settings

| Setting                   | Default | Description                                                                        |
|---------------------------|---------|------------------------------------------------------------------------------------|
| `phpLab.phpPath`          | `"php"` | PHP executable: a command on `PATH` or a full path such as `/opt/homebrew/bin/php` |
| `phpLab.timeout`          | `10`    | Stop the PHP process after this many seconds                                      |
| `phpLab.showInlineResult` | `true`  | Show a short result after the last line that ran                                  |

In [Restricted Mode](https://code.visualstudio.com/docs/editor/workspace-trust), a
`phpLab.phpPath` set in an untrusted folder's workspace settings is ignored.

## How it works

1. The code is cleaned up: a leading `<?php` and a trailing `?>` are removed, and `<?php ` is
   added **on the same line**, so line numbers in error messages match your file.
2. It's written to a temporary file and run with
   `php -d display_errors=stderr -d log_errors=0 -d error_reporting=E_ALL <file>`
   (all errors are shown, and only once). Standard input is closed, so `fgets(STDIN)` returns
   immediately instead of waiting.
3. Output is streamed to the Output panel; the temp file name is replaced by your file's name.
4. After the run (or the timeout), the temporary file is deleted.

Only one snippet runs at a time; starting a new run stops the previous one.
With Remote Development (SSH, WSL, Dev Containers), PHP runs on the remote machine.

## Troubleshooting

**"PHP Lab could not find PHP"** — run `which php` (macOS/Linux) or `where php` (Windows) in a terminal
and put the result in `phpLab.phpPath`. On macOS with Homebrew this is usually `/opt/homebrew/bin/php`
(Apple Silicon) or `/usr/local/bin/php` (Intel).

**A `// %%` inside a string or block comment** also splits the cell. Cells are detected line by line.

## Roadmap

- Persistent sessions: keep variables between runs (e.g. with [PsySH](https://psysh.org)).
- Switch between several installed PHP versions from the status bar.

## Contributing

```bash
npm install
npm test                  # unit tests (no VS Code needed)
npm run test:integration  # end-to-end tests in a real VS Code (needs PHP)
npm run lint
```

Press <kbd>F5</kbd> in VS Code to start an Extension Development Host with PHP Lab loaded.
See [PUBLISHING.md](PUBLISHING.md) for packaging and releasing.

## License

PHP Lab is free software: you can redistribute it and/or modify it under the terms of the
[GNU General Public License v3.0](LICENSE) as published by the Free Software Foundation.
It is distributed WITHOUT ANY WARRANTY; see the [LICENSE](LICENSE) file for details.
