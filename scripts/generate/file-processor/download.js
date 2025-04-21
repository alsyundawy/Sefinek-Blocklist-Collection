const readline = require('readline');
const axios = require('axios');
const unzipper = require('unzipper');
const lzma = require('lzma-native');
const { mkdir, rm, readdir } = require('node:fs/promises');
const { join, basename, extname } = require('node:path');
const { createWriteStream, createReadStream } = require('node:fs');
const { pipeline } = require('node:stream/promises');
const { fileUrls } = require('./scripts/data.js');

const downloadFile = async (url, outputPath) => {
	console.log(`Preparing: ${url}`);
	const res = await axios.get(url, { responseType: 'stream' });
	await pipeline(res.data, createWriteStream(outputPath));
};

const extractors = {
	'.zip': async (input, outDir) => {
		await pipeline(createReadStream(input), unzipper.Extract({ path: outDir }));
	},
	'.xz': async (input, outDir) => {
		const output = join(outDir, basename(input, '.xz'));
		await pipeline(createReadStream(input), lzma.createDecompressor(), createWriteStream(output));
	},
};

const collectDomains = async (filePath, writeStream) => {
	const rl = readline.createInterface({ input: createReadStream(filePath), crlfDelay: Infinity });

	for await (const line of rl) {
		const domain = extname(filePath) === '.csv' ? line.split(',')[0].trim() : line.trim();
		if (domain) {
			if (!writeStream.write(`${domain}\n`)) await new Promise(res => writeStream.once('drain', res));
		}
	}
};

const processFiles = async (directory, writeStream) => {
	const entries = await readdir(directory, { withFileTypes: true });

	for (const entry of entries) {
		const fullPath = join(directory, entry.name);
		if (entry.isDirectory()) {
			await processFiles(fullPath, writeStream);
		} else {
			await collectDomains(fullPath, writeStream);
		}
	}
};

const handleCompressedFile = async (filePath, outDir, writeStream) => {
	await mkdir(outDir, { recursive: true });

	const ext = extname(filePath);
	if (ext in extractors) {
		await extractors[ext](filePath, outDir);
		await processFiles(outDir, writeStream);
		await rm(outDir, { recursive: true, force: true });
	}
	await rm(filePath, { force: true });
};

const main = async () => {
	const tmpDir = join(__dirname, '..', '..', '..', 'tmp');
	const globalFilePath = join(tmpDir, 'global.txt');

	await rm(tmpDir, { recursive: true, force: true });
	await mkdir(tmpDir, { recursive: true });

	const writeStream = createWriteStream(globalFilePath, { flags: 'a' });

	for (const { url, name } of fileUrls) {
		const fileName = name || basename(url);
		const filePath = join(tmpDir, fileName);
		const extractTo = join(tmpDir, `${fileName}_extracted`);

		try {
			await downloadFile(url, filePath);

			const ext = extname(filePath);
			if (['.zip', '.xz'].includes(ext)) {
				await handleCompressedFile(filePath, extractTo, writeStream);
			} else {
				await collectDomains(filePath, writeStream);
				await rm(filePath, { force: true });
			}
		} catch (err) {
			console.error(`Error with ${fileName}:`, err.message);
		} finally {
			if (global.gc) global.gc();
		}
	}

	writeStream.end(() => {
		console.log(`Domain list saved: ${globalFilePath}`);
	});
};

main().catch(err => {
	console.error('Unhandled error:', err);
});