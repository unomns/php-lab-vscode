/**
 * File names for scratch files.
 *
 * This module has no `vscode` import, so it can be unit-tested with plain mocha.
 */

/** "scratch-20261024-043712.php": sortable, and unique to the second. */
export function scratchFileName(date: Date): string {
	const pad = (n: number) => String(n).padStart(2, '0');
	const day = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
	const time = `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
	return `scratch-${day}-${time}.php`;
}
