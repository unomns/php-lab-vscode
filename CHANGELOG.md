# Changelog

All notable changes to PHP Lab are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project follows [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.1.0] - 2026-10-24

### Added

- `PHP: Run Selection` runs the selection, or the current cell when nothing is selected
  (<kbd>Cmd</kbd>+<kbd>Alt</kbd>+<kbd>Enter</kbd> / <kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>Enter</kbd>).
- `// %%` cells with a **▶ Run Cell** CodeLens.
- `PHP: New Scratch File` opens an untitled PHP file with sample cells.
- **PHP Lab** Output channel with the PHP version and execution time.
- Inline result after the last line that ran, with the full output on hover.
- PHP errors mapped to the right line of your file, shown as diagnostics.
- Automatic PHP discovery (`PATH`, Homebrew, Laravel Herd, XAMPP, …) and a helpful message when PHP is missing.
- Settings: `phpLab.phpPath`, `phpLab.timeout`, `phpLab.showInlineResult`.

[Unreleased]: https://github.com/unomns/php-lab-vscode/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/unomns/php-lab-vscode/releases/tag/v0.1.0
