/**
 * Cell parsing.
 *
 * A PHP file can be split into "cells" with marker lines that start with
 * `// %%` (the same idea as `# %%` cells in Python / Jupyter):
 *
 *     <?php
 *     // %% Say hello
 *     echo "Hello";
 *     // %% Arrays
 *     print_r([1, 2, 3]);
 *
 * This module has no `vscode` import, so it can be unit-tested with plain mocha.
 * All line numbers are 0-based, like in the VS Code API.
 */

/** Optional indentation, `//`, optional spaces, `%%`, then an optional title. */
const CELL_MARKER = /^\s*\/\/\s*%%(.*)$/;

/** A line that contains nothing worth running: blank, `<?php` or `?>`. */
const NO_CODE_LINE = /^\s*(<\?php|\?>)?\s*$/i;

export interface Cell {
	/** Line of the `// %%` marker, or -1 for the code before the first marker. */
	markerLine: number;
	/** First line of the cell's code (the line after the marker). */
	startLine: number;
	/** Last line of the cell's code (inclusive). Smaller than `startLine` for an empty cell. */
	endLine: number;
	/** Text written after the marker, e.g. `// %% Arrays` gives "Arrays". */
	title: string;
}

export function isCellMarker(line: string): boolean {
	return CELL_MARKER.test(line);
}

/**
 * Splits a document into cells.
 *
 * - A file without markers is a single cell covering the whole file.
 * - Code before the first marker is its own cell, unless it only holds
 *   `<?php` and blank lines (the usual file header), in which case it's dropped.
 */
export function parseCells(lines: readonly string[]): Cell[] {
	const lastLine = lines.length - 1;
	const cells: Cell[] = [];
	let current: Cell = { markerLine: -1, startLine: 0, endLine: lastLine, title: '' };

	lines.forEach((text, i) => {
		const match = CELL_MARKER.exec(text);
		if (!match) {
			return;
		}
		current.endLine = i - 1;
		cells.push(current);
		current = { markerLine: i, startLine: i + 1, endLine: lastLine, title: match[1].trim() };
	});
	cells.push(current);

	const [first] = cells;
	if (cells.length > 1 && !hasCode(lines, first)) {
		cells.shift();
	}
	return cells;
}

/** Returns the cell containing `line` (a marker line belongs to the cell it starts). */
export function findCellAt(cells: readonly Cell[], line: number): Cell | undefined {
	return cells.find(cell =>
		line >= Math.min(cell.markerLine, cell.startLine) && line <= Math.max(cell.endLine, cell.markerLine));
}

/** True if the cell contains at least one line besides blanks, `<?php` and `?>`. */
export function hasCode(lines: readonly string[], cell: Cell): boolean {
	return lastCodeLine(lines, cell) !== undefined;
}

/**
 * The last line of the cell that contains code, ignoring trailing blank lines.
 * Used to place the inline result right after the code instead of on an empty line.
 */
export function lastCodeLine(lines: readonly string[], cell: Cell): number | undefined {
	for (let i = cell.endLine; i >= cell.startLine; i--) {
		if (!NO_CODE_LINE.test(lines[i])) {
			return i;
		}
	}
	return undefined;
}
