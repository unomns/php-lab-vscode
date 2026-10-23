import * as assert from 'assert';
import { parsePhpErrors, prepareCode, rewriteScriptPaths } from '../../codePrep';

suite('codePrep: prepareCode', () => {
	test('adds <?php to plain code', () => {
		assert.strictEqual(prepareCode('echo 1;'), '<?php echo 1;\n');
	});

	test('does not duplicate an existing <?php', () => {
		assert.strictEqual(prepareCode('<?php\necho 1;\n'), '<?php \necho 1;\n');
		assert.strictEqual(prepareCode('<?php echo 1;'), '<?php  echo 1;\n');
	});

	test('handles <?php after blank lines, in any case, and with a BOM', () => {
		assert.strictEqual(prepareCode('\n  <?PHP\necho 1;'), '<?php \n  \necho 1;\n');
		assert.strictEqual(prepareCode('\uFEFF<?php\necho 1;'), '<?php \necho 1;\n');
	});

	test('removes a trailing ?>', () => {
		assert.strictEqual(prepareCode('echo 1;\n?>\n\n'), '<?php echo 1;\n');
		assert.strictEqual(prepareCode('<?php echo 1; ?>'), '<?php  echo 1; \n');
	});

	test('keeps ?> and <?php that are not at the edges', () => {
		assert.strictEqual(prepareCode('echo "<?php";\n?>html<?php\necho 2;'), '<?php echo "<?php";\n?>html<?php\necho 2;\n');
	});

	test('does not treat <?phpx as an open tag', () => {
		assert.strictEqual(prepareCode('<?phpx'), '<?php <?phpx\n');
	});

	test('keeps line numbers: line N of the snippet is line N of the result', () => {
		const snippet = '<?php\n\n$a = 1;\necho $b;\n?>';
		const prepared = prepareCode(snippet)!;
		assert.strictEqual(prepared.split('\n')[3], 'echo $b;');
		assert.strictEqual(snippet.split('\n')[3], 'echo $b;');
	});

	test('returns undefined when there is nothing to run', () => {
		assert.strictEqual(prepareCode(''), undefined);
		assert.strictEqual(prepareCode('  \n\n'), undefined);
		assert.strictEqual(prepareCode('<?php\n\n?>'), undefined);
	});
});

suite('codePrep: parsePhpErrors', () => {
	const script = '/private/var/T/php-lab-x/snippet.php';

	test('reads warnings and parse errors', () => {
		const stderr = `\nWarning: Undefined variable $y in ${script} on line 2\n\nParse error: syntax error in ${script} on line 5\n`;
		assert.deepStrictEqual(parsePhpErrors(stderr, script), [
			{ severity: 'warning', message: 'Warning: Undefined variable $y', line: 2 },
			{ severity: 'error', message: 'Parse error: syntax error', line: 5 },
		]);
	});

	test('reads uncaught exceptions that span several lines', () => {
		const stderr = [
			`PHP Fatal error:  Uncaught RuntimeException: boom in ${script}:3`,
			'Stack trace:',
			`#0 ${script}(4): f()`,
			'#1 {main}',
			`  thrown in ${script} on line 3`,
		].join('\n');
		assert.deepStrictEqual(parsePhpErrors(stderr, script), [
			{ severity: 'error', message: 'Fatal error: Uncaught RuntimeException: boom', line: 3 },
		]);
	});

	test('ignores errors in other files and normal stderr output', () => {
		const stderr = 'Warning: oops in /app/vendor/lib.php on line 9\nsomething written to STDERR\n';
		assert.deepStrictEqual(parsePhpErrors(stderr, script), []);
	});
});

suite('codePrep: rewriteScriptPaths', () => {
	const script = 'C:\\Temp\\php-lab-x\\snippet.php';

	test('replaces the temp path and shifts line numbers', () => {
		const text = `Warning: x in ${script} on line 2\nboom in ${script}:3\n#0 ${script}(4): f()\nat ${script}`;
		assert.strictEqual(
			rewriteScriptPaths(text, script, 'demo.php', 10),
			'Warning: x in demo.php on line 12\nboom in demo.php:13\n#0 demo.php(14): f()\nat demo.php',
		);
	});
});
