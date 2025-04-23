const { mkdir, readdir, readFile, writeFile } = require('node:fs/promises');
const { join } = require('node:path');
const validator = require('validator');
const local = require('./utils/local.js');

const isSuspiciousDomain = domain => {
	if (!domain) return true;
	if (domain.length > 255) return true;
	if ((domain.match(/\./g) || []).length > 32) return true;
	return !(/^[a-z0-9._-]+$/i).test(domain);
};

const processDirectory = async dirPath => {
	try {
		await mkdir(dirPath, { recursive: true });

		const fileNames = await readdir(dirPath);
		const txtFiles = fileNames.filter(fileName => fileName.endsWith('.txt'));

		for (const fileName of txtFiles) {
			const filePath = join(dirPath, fileName);
			const fileContents = await readFile(filePath, 'utf8');

			const stats = {
				modifiedLines: 0,
				convertedDomains: 0,
				invalidLinesRemoved: 0,
				ipsReplaced: 0,
				domainToLower: 0,
				convertedAdguard: 0,
				splitMultiDomain: 0,
				normalizedSpacing: 0,
				fixedGlued: 0,
				commentsConverted: 0,
				fqdnConverted: 0,
			};

			const lines = fileContents.split('\n');
			const processedLines = [];

			for (let line of lines) {
				line = line.trim();
				if (line === '') continue;

				// Remove empty IP mapping like: "0.0.0.0"
				if (line === '0.0.0.0') {
					stats.invalidLinesRemoved++;
					continue;
				}

				// Skip trusted local patterns (e.g., localhost)
				if (local.test(line)) {
					processedLines.push(line);
					continue;
				}

				// Keep regular comments
				if (line.startsWith('#')) {
					processedLines.push(line);
					continue;
				}

				// ||domain.tld^ → 0.0.0.0 domain.tld
				if (line.startsWith('||') && line.endsWith('^')) {
					line = `0.0.0.0 ${line.replace(/^(\|\|)/, '').replace(/\^$/, '')}`;
					stats.modifiedLines++;
					stats.convertedAdguard++;
				}

				// example.tld/ → example.tld
				if (line.endsWith('/')) {
					line = line.replace(/\/$/, '');
					stats.modifiedLines++;
				}

				// example.com → 0.0.0.0 example.com
				if (!line.startsWith('0.0.0.0 ')) {
					line = `0.0.0.0 ${line.toLowerCase()}`;
					stats.modifiedLines++;
					stats.fqdnConverted++;
				}

				// 0.0.0.0example.com → 0.0.0.0 example.com
				const match = line.match(/^0\.0\.0\.0([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})(\s+.*)?$/);
				if (match) {
					line = `0.0.0.0 ${match[1].toLowerCase()}${match[2] || ''}`;
					stats.modifiedLines++;
					stats.fixedGlued++;
				}

				// 0.0.0.0 Domain.tld → 0.0.0.0 domain.tld
				if ((/^(0\.0\.0\.0|127\.0\.0\.1)\s+/).test(line)) {
					const words = line.split(/\s+/);
					const domain = words[1];
					if ((/[A-Z]/).test(domain)) {
						line = `${words[0]} ${domain.toLowerCase()} ${words.slice(2).join(' ')}`.trim();
						stats.convertedDomains++;
						stats.domainToLower++;
					}
				}

				// 127.0.0.1 or 195.187.6.33-35 → 0.0.0.0
				if ((/^(127\.0\.0\.1|195\.187\.6\.3[3-5])\s+/).test(line)) {
					line = line.replace(/^(\d{1,3}\.){3}\d{1,3}/, '0.0.0.0');
					stats.ipsReplaced++;
				}

				// 0.0.0.0\t... or 0.0.0.0  ... → 0.0.0.0 ...
				if (line.startsWith('0.0.0.0\t') || line.startsWith('0.0.0.0  ')) {
					line = line.replace(/0\.0\.0\.0\s+/, '0.0.0.0 ');
					stats.modifiedLines++;
					stats.normalizedSpacing++;
				}

				// 0.0.0.0 a.com b.com → split into multiple lines
				if ((line.startsWith('0.0.0.0') || line.startsWith('127.0.0.1')) && !line.includes('#')) {
					const words = line.split(/\s+/);
					if (words.length > 2) {
						const ipAddress = words.shift();
						line = words
							.filter(Boolean)
							.map(d => `${ipAddress} ${d.toLowerCase()}`)
							.join('\n')
							.trim();
						stats.modifiedLines++;
						stats.splitMultiDomain++;
					}
				}

				// ! comment → # comment
				if (line.startsWith('!')) {
					line = line.replace('!', '#');
					if (line === '# Syntax: Adblock Plus Filter List') {
						line = '# Syntax: 0.0.0.0 domain.tld'; // Adblock header → custom format
						stats.modifiedLines++;
						stats.commentsConverted++;
					}
					stats.modifiedLines++;
					stats.commentsConverted++;
				}

				// Validate and remove invalid or suspicious host entries
				if (line.startsWith('0.0.0.0')) {
					const words = line.split(/\s+/);
					const raw = words[1];
					const domain = raw.split(':')[0];
					if (!validator.isFQDN(domain, { allow_underscores: true }) || isSuspiciousDomain(domain)) {
						stats.invalidLinesRemoved++;
						continue;
					}
				}

				processedLines.push(line);
			}

			if (Object.values(stats).some(v => v > 0)) {
				await writeFile(filePath, processedLines.join('\n').trim(), 'utf8');

				console.log(`📝 ${fileName}:`);
				console.log(`   🧹 ${stats.modifiedLines} line(s) modified`);
				if (stats.domainToLower) console.log(`   🔡 ${stats.domainToLower} domain(s) lowercased`);
				if (stats.convertedAdguard) console.log(`   🔄 ${stats.convertedAdguard} AdGuard rule(s) converted`);
				if (stats.splitMultiDomain) console.log(`   ✂️ ${stats.splitMultiDomain} line(s) split into multiple entries`);
				if (stats.normalizedSpacing) console.log(`   🔧 ${stats.normalizedSpacing} spacing normalized`);
				if (stats.fixedGlued) console.log(`   🩹 ${stats.fixedGlued} glued IP/domain fixed`);
				if (stats.commentsConverted) console.log(`   💬 ${stats.commentsConverted} comment(s) reformatted`);
				if (stats.fqdnConverted) console.log(`   🌐 ${stats.fqdnConverted} plain FQDN(s) converted to 0.0.0.0`);
				if (stats.ipsReplaced) console.log(`   🛑 ${stats.ipsReplaced} IP(s) replaced`);
				if (stats.invalidLinesRemoved) console.log(`   ❌ ${stats.invalidLinesRemoved} invalid line(s) removed`);
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