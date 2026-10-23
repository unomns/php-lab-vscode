/**
 * Turning editor text into a runnable PHP file, and mapping PHP's error
 * messages back to the editor.
 *
 * Line numbers are the key detail: `<?php ` is added *on the same line* as the
 * first line of code (instead of on a line of its own), so "line N" in the
 * temp file is always line N of the snippet. That keeps error messages and
 * diagnostics pointing at the right place in the user's file.
 *
 * This module has no `vscode` import, so it can be unit-tested with plain mocha.
 */

/** A leading `<?php` tag (after optional BOM/whitespace) that must be followed by whitespace or end the text. */
const LEADING_OPEN_TAG = /^(﻿?\s*)<\?php(?=\s|$)/i;

/** A trailing `?>` close tag, plus any whitespace after it. */
const TRAILING_CLOSE_TAG = /\?>\s*$/;

/**
 * Prepares a snippet for execution:
 * removes a leading `<?php` and a trailing `?>`, then adds `<?php ` at the start.
 * Returns `undefined` if there is no code left to run.
 */
export function prepareCode(snippet: string): string | undefined {
	const code = snippet
		.replace(LEADING_OPEN_TAG, (_tag, before: string) => before.replace('﻿', ''))
		.replace(TRAILING_CLOSE_TAG, '');

	if (code.trim() === '') {
		return undefined;
	}
	// No newline after `<?php `: this keeps line numbers identical to the snippet.
	return `<?php ${code}${code.endsWith('\n') ? '' : '\n'}`;
}

export type PhpErrorSeverity = 'error' | 'warning' | 'info';

export interface PhpError {
	severity: PhpErrorSeverity;
	/** e.g. "Warning: Undefined variable $y" */
	message: string;
	/** 1-based line in the snippet. */
	line: number;
}

const SEVERITIES: Record<string, PhpErrorSeverity> = {
	'fatal error': 'error',
	'recoverable fatal error': 'error',
	'parse error': 'error',
	'warning': 'warning',
	'notice': 'info',
	'deprecated': 'info',
	'strict standards': 'info',
};

/** Start of an error as printed by PHP ("Warning: ...", or "PHP Warning:  ..." when logged). */
const ERROR_START = /^(?:PHP )?(Fatal error|Recoverable fatal error|Parse error|Warning|Notice|Deprecated|Strict Standards):\s+(.*)$/;

/**
 * Finds PHP errors that point into the snippet file (not into included files).
 * Uncaught exceptions span several lines; the line number is taken from the
 * first "in <file> on line N" / "<file>:N" found in the error's text.
 */
export function parsePhpErrors(stderr: string, scriptPath: string): PhpError[] {
	const location = new RegExp(`${escapeRegExp(scriptPath)}(?: on line |:)(\\d+)`);
	const errors: PhpError[] = [];
	let current: { type: string; text: string[] } | undefined;

	const finish = () => {
		if (!current) {
			return;
		}
		const match = location.exec(current.text.join('\n'));
		if (match) {
			// Drop " in /tmp/...:3" / " in /tmp/... on line 3" from the message itself.
			const message = current.text[0].replace(new RegExp(` in ${escapeRegExp(scriptPath)}.*$`), '');
			errors.push({
				severity: SEVERITIES[current.type.toLowerCase()],
				message: `${current.type}: ${message}`,
				line: Number(match[1]),
			});
		}
		current = undefined;
	};

	for (const line of stderr.split(/\r?\n/)) {
		const start = ERROR_START.exec(line);
		if (start) {
			finish();
			current = { type: start[1], text: [start[2]] };
		} else if (current) {
			current.text.push(line);
		}
	}
	finish();
	return errors;
}

/**
 * Rewrites PHP output so it talks about the user's file instead of the temp file:
 * "/tmp/php-lab-x/snippet.php on line 2" becomes "Untitled-1 on line 7"
 * (and the same for "file:2" and "file(2)" in stack traces).
 *
 * @param lineOffset number of lines before the snippet in the user's file
 */
export function rewriteScriptPaths(text: string, scriptPath: string, displayName: string, lineOffset: number): string {
	const pattern = new RegExp(`${escapeRegExp(scriptPath)}(?:( on line |:)(\\d+)|\\((\\d+)\\))?`, 'g');
	return text.replace(pattern, (_match, separator?: string, line?: string, parenLine?: string) => {
		if (line) {
			return `${displayName}${separator}${Number(line) + lineOffset}`;
		}
		if (parenLine) {
			return `${displayName}(${Number(parenLine) + lineOffset})`;
		}
		return displayName;
	});
}

function escapeRegExp(text: string): string {
	return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
