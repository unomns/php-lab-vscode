import { defineConfig } from '@vscode/test-cli';

// End-to-end tests in a real VS Code instance (`npm run test:integration`).
// The pure unit tests in out/test/unit run with plain mocha (`npm test`).
export default defineConfig({
	files: 'out/test/suite/**/*.test.js',
	launchArgs: ['--disable-extensions'],
	mocha: {
		ui: 'tdd',
		timeout: 20000,
	},
});
