/**
 * Finding the `php` executable and its version.
 *
 * Lookup order for the default setting value "php":
 *   1. every directory on PATH (honouring PATHEXT on Windows)
 *   2. well-known install locations, e.g. Homebrew's /opt/homebrew/bin/php
 *
 * Step 2 matters on macOS: when VS Code is started from the Dock it may not
 * inherit the PATH from your shell profile, so Homebrew's PHP wouldn't be found.
 *
 * Phase 2 (PHP version switcher) can build on `knownPhpLocations()` to list candidates.
 */
import { execFile } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const isWindows = process.platform === 'win32';

/** Caches, cleared when the settings change. */
const resolvedPaths = new Map<string, string | undefined>();
const versions = new Map<string, Promise<string>>();

export function clearPhpCache(): void {
	resolvedPaths.clear();
	versions.clear();
}

/** Places where PHP is commonly installed, besides PATH. */
export function knownPhpLocations(platform: NodeJS.Platform = process.platform): string[] {
	const home = os.homedir();
	switch (platform) {
		case 'darwin':
			return [
				'/opt/homebrew/bin/php', // Homebrew on Apple Silicon
				'/usr/local/bin/php', // Homebrew on Intel
				path.join(home, 'Library/Application Support/Herd/bin/php'), // Laravel Herd
				'/opt/local/bin/php', // MacPorts
			];
		case 'win32':
			return ['C:\\php\\php.exe', 'C:\\xampp\\php\\php.exe'];
		default:
			return ['/usr/bin/php', '/usr/local/bin/php', '/home/linuxbrew/.linuxbrew/bin/php'];
	}
}

/**
 * Turns the `phpLab.phpPath` setting into an absolute path to an existing file,
 * or `undefined` if PHP can't be found.
 */
export function resolvePhpPath(configured: string): string | undefined {
	if (!resolvedPaths.has(configured)) {
		resolvedPaths.set(configured, lookUp(configured));
	}
	return resolvedPaths.get(configured);
}

function lookUp(configured: string): string | undefined {
	const value = expandHome(configured.trim() || 'php');

	// An explicit path ("/usr/bin/php8.3", "C:\php\php.exe", "~/bin/php") is used as-is.
	if (path.isAbsolute(value) || value.includes('/') || value.includes('\\')) {
		return isFile(value) ? path.resolve(value) : undefined;
	}

	// A bare command name: search PATH first, then the usual install locations.
	const fromPath = findOnPath(value);
	if (fromPath) {
		return fromPath;
	}
	return value === 'php' ? knownPhpLocations().find(isFile) : undefined;
}

function findOnPath(command: string): string | undefined {
	const dirs = (process.env.PATH ?? '').split(path.delimiter).filter(Boolean);
	// On Windows "php" may be "php.exe", "php.bat", ...
	const extensions = isWindows && !path.extname(command)
		? (process.env.PATHEXT ?? '.EXE;.CMD;.BAT;.COM').split(';')
		: [''];

	for (const dir of dirs) {
		for (const ext of extensions) {
			const candidate = path.join(dir, command + ext);
			if (isFile(candidate)) {
				return candidate;
			}
		}
	}
	return undefined;
}

/** Returns the PHP version (e.g. "8.4.4") of the given binary, cached per binary. */
export function getPhpVersion(phpPath: string): Promise<string> {
	let version = versions.get(phpPath);
	if (!version) {
		version = new Promise(resolve => {
			execFile(phpPath, ['-r', 'echo PHP_VERSION;'], { timeout: 5000 }, (error, stdout) => {
				resolve(error ? 'unknown version' : stdout.trim());
			});
		});
		versions.set(phpPath, version);
	}
	return version;
}

function expandHome(value: string): string {
	return value.replace(/^(~|\$\{userHome\})(?=$|[\\/])/, os.homedir());
}

function isFile(candidate: string): boolean {
	try {
		return fs.statSync(candidate).isFile();
	} catch {
		return false;
	}
}
