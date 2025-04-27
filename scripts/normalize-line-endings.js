const { readdir, readFile, writeFile } = require('node:fs/promises');
const { join } = require('node:path');

const normalizeLineEndings = async filePath => {
	const content = await readFile(filePath, 'utf8');
	const normalized = content.replace(/\r?\n/g, '\n');
	if (content !== normalized) {
		await writeFile(filePath, normalized, 'utf8');
		console.log(`🔄 Modified ${filePath}: Line endings normalized`);
	}
};

const processDirectory = async dirPath => {
	const entries = await readdir(dirPath, { withFileTypes: true });

	await Promise.all(entries.map(async entry => {
		const fullPath = join(dirPath, entry.name);
		if (entry.isDirectory()) {
			await processDirectory(fullPath);
		} else if (entry.isFile() && entry.name.endsWith('.txt')) {
			await normalizeLineEndings(fullPath);
		}
	}));
};

(async () => {
	try {
		await processDirectory(join(__dirname, '..', 'blocklists', 'templates'));
	} catch (err) {
		console.error('❌ Unexpected error:', err);
	}
})();