import * as assert from 'assert';
import { scratchFileName } from '../../scratchNames';

suite('scratchNames: scratchFileName', () => {
	test('uses the local date and time, zero-padded', () => {
		assert.strictEqual(scratchFileName(new Date(2026, 0, 5, 4, 7, 9)), 'scratch-20260105-040709.php');
	});

	test('names sort in creation order', () => {
		const names = [new Date(2026, 9, 24, 10, 0, 0), new Date(2026, 9, 24, 9, 59, 59), new Date(2025, 11, 31)]
			.map(scratchFileName);
		assert.deepStrictEqual([...names].sort(), [names[2], names[1], names[0]]);
	});
});
