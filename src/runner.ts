/**
 * Running PHP code.
 *
 * Everything else talks to the `PhpRunner` interface, so the execution strategy
 * can be swapped without touching the commands or the UI. Today there is one
 * implementation, `OneShotRunner`: every run is a fresh `php` process.
 *
 * Phase 2: a `PsyShSessionRunner` can implement the same interface and keep one
 * long-lived PsySH process per document, so variables survive between runs.
 */
import { ChildProcess, spawn } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

export interface RunRequest {
	/** Absolute path to the php binary. */
	phpPath: string;
	/** Complete PHP source (already prepared, starting with `<?php`). */
	source: string;
	/** Working directory for the script. */
	cwd: string;
	timeoutMs: number;
	/** Called with output as it arrives, so long-running scripts show progress. */
	onOutput?: (text: string, stream: 'stdout' | 'stderr', scriptPath: string) => void;
}

export interface RunResult {
	stdout: string;
	stderr: string;
	/** Process exit code, or null if it was killed. */
	exitCode: number | null;
	durationMs: number;
	/** Why the process was killed early, if it was. */
	stopReason?: 'timeout' | 'outputLimit' | 'cancelled';
	/** Path of the temporary script, as PHP reports it in error messages (already deleted). */
	scriptPath: string;
}

export interface PhpRunner {
	run(request: RunRequest): Promise<RunResult>;
	/** Stops the current run, if any. */
	cancel(): void;
}

/** Thrown when the php binary can't be started at all (missing or not executable). */
export class PhpStartError extends Error {
	constructor(readonly phpPath: string, readonly code: string | undefined) {
		super(`Could not start PHP at "${phpPath}" (${code ?? 'unknown error'})`);
	}
}

/** Stop runaway output (e.g. an endless loop that echoes) from flooding the editor. */
const MAX_OUTPUT_CHARS = 1_000_000;

/**
 * Error settings for every run: send errors to stderr (so they can be told apart
 * from normal output), show all of them, and turn off error *logging*, which on
 * a default Homebrew php.ini would print every message a second time.
 */
const PHP_ARGS = ['-d', 'display_errors=stderr', '-d', 'log_errors=0', '-d', 'error_reporting=E_ALL'];

export class OneShotRunner implements PhpRunner {
	private current?: { child: ChildProcess; stop: (reason: RunResult['stopReason']) => void };

	async run(request: RunRequest): Promise<RunResult> {
		// realpath: on macOS os.tmpdir() is a symlink (/var -> /private/var) and
		// PHP prints the real path in error messages, so we need that exact string.
		const dir = await fs.promises.mkdtemp(path.join(fs.realpathSync(os.tmpdir()), 'php-lab-'));
		const scriptPath = path.join(dir, 'snippet.php');
		try {
			await fs.promises.writeFile(scriptPath, request.source, 'utf8');
			return await this.execute(request, scriptPath);
		} finally {
			await fs.promises.rm(dir, { recursive: true, force: true });
		}
	}

	cancel(): void {
		this.current?.stop('cancelled');
	}

	private execute(request: RunRequest, scriptPath: string): Promise<RunResult> {
		return new Promise((resolve, reject) => {
			const started = Date.now();
			let stdout = '';
			let stderr = '';
			let stopReason: RunResult['stopReason'];

			const child = spawn(request.phpPath, [...PHP_ARGS, scriptPath], {
				cwd: request.cwd,
				// No stdin: a script that reads STDIN gets EOF instead of hanging until the timeout.
				stdio: ['ignore', 'pipe', 'pipe'],
				windowsHide: true,
			});

			const stop = (reason: RunResult['stopReason']) => {
				stopReason ??= reason;
				child.kill();
			};
			const timer = setTimeout(() => stop('timeout'), request.timeoutMs);
			this.current = { child, stop };

			const collect = (stream: 'stdout' | 'stderr') => (text: string) => {
				if (stream === 'stdout') {
					stdout += text;
				} else {
					stderr += text;
				}
				request.onOutput?.(text, stream, scriptPath);
				if (stdout.length + stderr.length > MAX_OUTPUT_CHARS) {
					stop('outputLimit');
				}
			};
			child.stdout.setEncoding('utf8').on('data', collect('stdout'));
			child.stderr.setEncoding('utf8').on('data', collect('stderr'));

			const cleanUp = () => {
				clearTimeout(timer);
				if (this.current?.child === child) {
					this.current = undefined;
				}
			};
			child.on('error', (error: NodeJS.ErrnoException) => {
				cleanUp();
				reject(new PhpStartError(request.phpPath, error.code));
			});
			child.on('close', exitCode => {
				cleanUp();
				resolve({ stdout, stderr, exitCode, durationMs: Date.now() - started, stopReason, scriptPath });
			});
		});
	}
}
