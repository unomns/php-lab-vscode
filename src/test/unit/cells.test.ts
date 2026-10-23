import * as assert from 'assert';
import { findCellAt, isCellMarker, lastCodeLine, parseCells } from '../../cells';

const lines = (text: string) => text.split('\n');

suite('cells: isCellMarker', () => {
	test('recognizes markers with and without titles', () => {
		assert.ok(isCellMarker('// %%'));
		assert.ok(isCellMarker('// %% Arrays'));
		assert.ok(isCellMarker('  //%%'));
	});

	test('ignores other comments and code', () => {
		assert.ok(!isCellMarker('// % not a cell'));
		assert.ok(!isCellMarker('# %%'));
		assert.ok(!isCellMarker('echo "// %%";'));
		assert.ok(!isCellMarker('/* %% */'));
	});
});

suite('cells: parseCells', () => {
	test('a file without markers is one cell', () => {
		const cells = parseCells(lines('<?php\necho 1;\necho 2;'));
		assert.deepStrictEqual(cells, [{ markerLine: -1, startLine: 0, endLine: 2, title: '' }]);
	});

	test('splits on markers and reads titles', () => {
		const cells = parseCells(lines('<?php\n// %% One\necho 1;\n\n// %% Two\necho 2;'));
		assert.deepStrictEqual(cells, [
			{ markerLine: 1, startLine: 2, endLine: 3, title: 'One' },
			{ markerLine: 4, startLine: 5, endLine: 5, title: 'Two' },
		]);
	});

	test('drops a header that only contains <?php and blank lines', () => {
		const cells = parseCells(lines('<?php\n\n// %%\necho 1;'));
		assert.strictEqual(cells.length, 1);
		assert.strictEqual(cells[0].markerLine, 2);
	});

	test('keeps code before the first marker as its own cell', () => {
		const cells = parseCells(lines('<?php\n$a = 1;\n// %%\necho $a;'));
		assert.deepStrictEqual(cells[0], { markerLine: -1, startLine: 0, endLine: 1, title: '' });
		assert.strictEqual(cells.length, 2);
	});

	test('a marker on the last line gives an empty cell', () => {
		const cells = parseCells(lines('// %% A\necho 1;\n// %% B'));
		assert.deepStrictEqual(cells[1], { markerLine: 2, startLine: 3, endLine: 2, title: 'B' });
	});

	test('handles an empty document', () => {
		assert.deepStrictEqual(parseCells(['']), [{ markerLine: -1, startLine: 0, endLine: 0, title: '' }]);
	});
});

suite('cells: findCellAt', () => {
	const doc = lines('<?php\n// %% One\necho 1;\n\n// %% Two\necho 2;\n// %% Empty');
	const cells = parseCells(doc);

	test('finds the cell for code lines and marker lines', () => {
		assert.strictEqual(findCellAt(cells, 1)?.title, 'One');
		assert.strictEqual(findCellAt(cells, 3)?.title, 'One');
		assert.strictEqual(findCellAt(cells, 4)?.title, 'Two');
		assert.strictEqual(findCellAt(cells, 5)?.title, 'Two');
		assert.strictEqual(findCellAt(cells, 6)?.title, 'Empty');
	});

	test('returns undefined in a dropped <?php header', () => {
		assert.strictEqual(findCellAt(cells, 0), undefined);
	});
});

suite('cells: lastCodeLine', () => {
	test('skips trailing blank lines', () => {
		const doc = lines('// %%\necho 1;\necho 2;\n\n\n// %%');
		assert.strictEqual(lastCodeLine(doc, parseCells(doc)[0]), 2);
	});

	test('returns undefined for a cell without code', () => {
		const doc = lines('// %%\n\n<?php\n// %%\necho 1;');
		assert.strictEqual(lastCodeLine(doc, parseCells(doc)[0]), undefined);
	});
});
