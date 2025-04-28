const { mkdir, readdir, readFile, writeFile } = require('node:fs/promises');
const { join } = require('node:path');
const validator = require('validator');
const local = require('./utils/local.js');

const emoji = key => ({
	modifiedLines: '🧹', convertedDomains: '🔡', invalidLinesRemoved: '❌',
	ipsReplaced: '🛑', domainToLower: '🔡', convertedAdGuard: '🔄',
	splitMultiDomain: '✂️', normalizedSpacing: '🔧', fixedGlued: '🩹',
	commentsConverted: '💬', fqdnConverted: '🌐',
}[key] || '');

const isSuspiciousDomain = domain =>
	typeof domain !== 'string' ||
	domain.length > 255 ||
	(domain.match(/\./g) || []).length > 32 ||
	!(/^[a-z0-9._-]+$/i).test(domain);

const processDirectory = async dirPath => {
	try {
		await mkdir(dirPath, { recursive: true });

		const fileNames = await readdir(dirPath);
		const txtFiles = fileNames.filter(name => name.endsWith('.txt'));

		for (const fileName of txtFiles) {
			const filePath = join(dirPath, fileName);
			const fileContents = await readFile(filePath, 'utf8');
			const lines = fileContents.split('\n');

			const stats = {
				modifiedLines: 0, convertedDomains: 0, invalidLinesRemoved: 0, ipsReplaced: 0,
				domainToLower: 0, convertedAdGuard: 0, splitMultiDomain: 0, normalizedSpacing: 0,
				fixedGlued: 0, commentsConverted: 0, fqdnConverted: 0,
			};

			const processedLines = [];

			for (let line of lines) {
				line = line.trim();
				if (!line || line === '0.0.0.0') {
					stats.invalidLinesRemoved++;
					continue;
				}

				if (local.test(line) || line.startsWith('#')) {
					processedLines.push(line);
					continue;
				}

				// IP replacements
				if ((/^127\.0\.0\.1\s+/).test(line) || (/^195\.187\.6\.3[3-5]\s+/).test(line)) {
					line = line.replace(/^127\.0\.0\.1\s+|^195\.187\.6\.3[3-5]\s+/, '0.0.0.0 ');
					stats.ipsReplaced++;
					stats.modifiedLines++;
				}

				// AdGuard rule
				if (line.startsWith('||') && line.endsWith('^')) {
					line = `0.0.0.0 ${line.slice(2, -1)}`;
					stats.convertedAdGuard++;
					stats.modifiedLines++;
				}

				// Remove trailing slash
				if (line.endsWith('/')) {
					line = line.slice(0, -1);
					stats.modifiedLines++;
				}

				// FQDN conversion
				if (!line.startsWith('0.0.0.0 ')) {
					line = `0.0.0.0 ${line.toLowerCase()}`;
					stats.fqdnConverted++;
					stats.modifiedLines++;
				}

				// Fix glued IP/domain
				const glued = line.match(/^0\.0\.0\.0([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})(\s+.*)?$/);
				if (glued) {
					line = `0.0.0.0 ${glued[1].toLowerCase()}${glued[2] || ''}`;
					stats.fixedGlued++;
					stats.modifiedLines++;
				}

				// Lowercase domains
				if ((/^0\.0\.0\.0\s+/).test(line)) {
					const words = line.split(/\s+/);
					const domain = words[1];
					if ((/[A-Z]/).test(domain)) {
						line = `${words[0]} ${domain.toLowerCase()} ${words.slice(2).join(' ')}`.trim();
						stats.domainToLower++;
						stats.convertedDomains++;
						stats.modifiedLines++;
					}
				}

				// Normalize spacing
				if ((/^0\.0\.0\.0\s{2,}|\t+/).test(line)) {
					line = line.replace(/^0\.0\.0\.0\s+/, '0.0.0.0 ');
					stats.normalizedSpacing++;
					stats.modifiedLines++;
				}

				// Split multi-domain lines
				if (line.startsWith('0.0.0.0')) {
					const [mainPart, comment] = line.split('#', 2);
					const parts = mainPart.trim().split(/\s+/);
					if (parts.length > 2) {
						const ip = parts.shift();
						const newLines = parts.map((d, i) => {
							let l = `${ip} ${d.toLowerCase()}`;
							if (comment && i === parts.length - 1) l += ` #${comment.trim()}`;
							return l;
						});
						line = newLines.join('\n');
						stats.splitMultiDomain++;
						stats.modifiedLines++;
					}
				}

				// Convert comments
				if (line.startsWith('!')) {
					line = line.replace(/^!+/, '#');
					if (line === '# Syntax: Adblock Plus Filter List') {
						line = '# Syntax: 0.0.0.0 domain.tld';
					}
					stats.commentsConverted++;
					stats.modifiedLines++;
				}

				// Validate domain and remove port if present
				if (line.startsWith('0.0.0.0')) {
					const [, rawDomain, ...rest] = line.split(/\s+/);
					if (!rawDomain) {
						stats.invalidLinesRemoved++;
						continue;
					}

					const domain = rawDomain.split(':')[0];
					if (!validator.isFQDN(domain, { allow_underscores: true }) || isSuspiciousDomain(domain)) {
						stats.invalidLinesRemoved++;
						continue;
					}

					line = `0.0.0.0 ${domain}${rest.length ? ' ' + rest.join(' ') : ''}`;
					if (domain !== rawDomain) stats.modifiedLines++;
				}

				processedLines.push(line);
			}

			if (Object.values(stats).some(Boolean)) {
				await writeFile(filePath, processedLines.join('\n').trim(), 'utf8');

				console.log('📝', dirPath);
				Object.entries(stats).forEach(([k, v]) => {
					if (v) console.log(`   ${emoji(k)} ${v} ${k.replace(/([A-Z])/g, ' $1').toLowerCase()}`);
				});
			}
		}

		const subDirs = (await readdir(dirPath, { withFileTypes: true })).filter(d => d.isDirectory());
		for (const sub of subDirs) {
			await processDirectory(join(dirPath, sub.name));
		}
	} catch (err) {
		console.error(`❌ Error processing ${dirPath}:`, err);
	}
};

(async () => {
	try {
		await processDirectory(join(__dirname, '..', 'blocklists', 'templates'));
	} catch (err) {
		console.error('❌ Fatal error:', err);
	}
})();