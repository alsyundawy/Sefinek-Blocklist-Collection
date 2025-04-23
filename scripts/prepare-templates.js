const { mkdir, readdir, readFile, writeFile } = require('node:fs/promises');
const { join } = require('node:path');
const validator = require('validator');
const local = require('./utils/local.js');

const processDirectory = async dirPath => {
	try {
		await mkdir(dirPath, { recursive: true });

		const fileNames = await readdir(dirPath);
		const txtFiles = fileNames.filter(fileName => fileName.endsWith('.txt'));

		for (const fileName of txtFiles) {
			const filePath = join(dirPath, fileName);
			const fileContents = await readFile(filePath, 'utf8');

			let convertedDomains = 0, invalidLinesRemoved = 0, ipsReplaced = 0, modifiedLines = 0;

			const lines = fileContents.split('\n');
			const processedLines = [];

			for (let line of lines) {
				line = line.trim();
				if (line === '') continue;

				// Remove standalone 0.0.0.0
				if (line === '0.0.0.0') {
					invalidLinesRemoved++;
					continue;
				}

				// Replace 127.0.0.1 localhost entries with 0.0.0.0
				if ((/127\.0\.0\.1\s+(localhost(\.localdomain)?|local)/).test(line)) {
					line = line.replace('127.0.0.1', '0.0.0.0');
				}

				// Skip entries matched by local test
				if (local.test(line)) {
					processedLines.push(line);
					continue;
				}

				// Preserve comments
				if (line.startsWith('#')) {
					processedLines.push(line);
					continue;
				}

				// Normalize case in domains
				if ((/^(0\.0\.0\.0|127\.0\.0\.1)\s+/).test(line)) {
					const words = line.split(/\s+/);
					const domain = words[1];
					if ((/[A-Z]/).test(domain)) {
						line = `${words[0]} ${domain.toLowerCase()} ${words.slice(2).join(' ')}`.trim();
						convertedDomains++;
					}
				}

				// Replace specific IPs with 0.0.0.0
				if ((/^(127\.0\.0\.1|195\.187\.6\.3[3-5])\s+/).test(line)) {
					line = line.replace(/^(\d{1,3}\.){3}\d{1,3}/, '0.0.0.0');
					ipsReplaced++;
				}

				// Normalize spacing after IP
				if (line.startsWith('0.0.0.0\t') || line.startsWith('0.0.0.0  ')) {
					line = line.replace(/0\.0\.0\.0\s+/, '0.0.0.0 ');
					modifiedLines++;
				}

				// AdGuard-specific conversion
				if (line.startsWith('||') && !line.includes('#')) {
					line = `0.0.0.0 ${line.replace(/^(\|\|)/, '').replace(/\^$/, '')}`;
					modifiedLines++;
				}

				// Convert ! comments to #
				if (line.startsWith('!')) {
					line = line.replace('!', '#');
					if (line === '# Syntax: Adblock Plus Filter List') line = '# Syntax: 0.0.0.0 domain.tld';
					modifiedLines++;
				}

				// Split multi-domain lines
				if ((line.startsWith('0.0.0.0') || line.startsWith('127.0.0.1')) && !line.includes('#')) {
					const words = line.split(/\s+/);
					if (words.length > 2) {
						const ipAddress = words.shift();
						line = words
							.filter(Boolean)
							.map(d => `${ipAddress} ${d.toLowerCase()}`)
							.join('\n')
							.trim();
						modifiedLines++;
					}
				}

				// Fix glued IP/domain format
				const match = line.match(/^0\.0\.0\.0([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})(\s+.*)?$/);
				if (match) {
					line = `0.0.0.0 ${match[1].toLowerCase()}${match[2] ? match[2] : ''}`;
					modifiedLines++;
				}

				// domain.tld -> 0.0.0.0 domain.tld
				if (!line.includes(' ') && !line.startsWith('0.0.0.0') && !line.startsWith('127.0.0.1') && !line.startsWith('#') && !line.startsWith('!')) {
					if (validator.isFQDN(line)) {
						line = `0.0.0.0 ${line.toLowerCase()}`;
						modifiedLines++;
						continue;
					}
				}

				// Remove invalid domain lines
				if ((/^(0\.0\.0\.0|127\.0\.0\.1)\s+/).test(line)) {
					const words = line.split(/\s+/);
					const domain = words[1];
					if (domain && !validator.isURL(domain, { require_valid_protocol: false, allow_underscores: true })) {
						invalidLinesRemoved++;
						continue;
					}
				}

				processedLines.push(line);
			}

			// Save
			if (modifiedLines !== 0 || convertedDomains !== 0 || invalidLinesRemoved !== 0 || ipsReplaced !== 0) {
				await writeFile(filePath, processedLines.join('\n').trim(), 'utf8');

				console.log(
					`📝 ${fileName}: ${modifiedLines} ${modifiedLines === 1 ? 'line' : 'lines'} modified; ` +
					`${convertedDomains} ${convertedDomains === 1 ? 'domain' : 'domains'} converted to lowercase; ` +
					`${invalidLinesRemoved} invalid ${invalidLinesRemoved === 1 ? 'line' : 'lines'} removed; ` +
					`${ipsReplaced} ${ipsReplaced === 1 ? 'IP' : 'IPs'} replaced`
				);
			}
		}

		const subDirectories = await readdir(dirPath, { withFileTypes: true });
		for (const subDirectory of subDirectories.filter(subDir => subDir.isDirectory())) {
			await processDirectory(join(dirPath, subDirectory.name));
		}
	} catch (err) {
		console.error(`❌ An error occurred while processing ${dirPath} directory.`, err);
	}
};

const run = async () => {
	try {
		console.log('🔍 Analyzing the `templates` folder...');

		const templateDirPath = join(__dirname, '..', 'blocklists', 'templates');
		await processDirectory(templateDirPath);
		console.log(`✔️ Completed successfully for ${templateDirPath}`);
	} catch (err) {
		console.error(`❌ An error occurred: ${err.message}`);
	}
};

(async () => await run())();

module.exports = () => run;