const { mkdir, readdir, readFile, writeFile } = require('node:fs/promises');
const { join } = require('node:path');
const validator = require('validator');
const local = require('./utils/local.js');

const emoji = key => ({
	modifiedLines: '🔧', convertedDomains: '✨', invalidLinesRemoved: '🧹',
	ipsReplaced: '🔄', domainToLower: '🔡', convertedAdGuard: '🔄',
	splitMultiDomain: '✂️', normalizedSpacing: '🔃', fixedGlued: '🩹',
	commentsConverted: '💬', fqdnConverted: '🌐',
	portRemoved: '🔪', trailingSlashRemoved: '✂️',
}[key] || '');

const isSuspiciousDomain = domain =>
	typeof domain !== 'string' ||
	domain.length > 255 ||
	(domain.match(/\./g) || []).length > 32 ||
	!(/^[a-z0-9._-]+$/i).test(domain);

const isIPAddress = text => (/^(\d{1,3}\.){3}\d{1,3}$/).test(text);

const processDirectory = async dirPath => {
	try {
		await mkdir(dirPath, { recursive: true });
		const fileNames = (await readdir(dirPath)).filter(name => name.endsWith('.txt'));

		for (const fileName of fileNames) {
			const filePath = join(dirPath, fileName);
			const fileContents = await readFile(filePath, 'utf8');
			const lines = fileContents.split('\n');

			const stats = {
				modifiedLines: 0, convertedDomains: 0, invalidLinesRemoved: 0, ipsReplaced: 0,
				domainToLower: 0, convertedAdGuard: 0, splitMultiDomain: 0, normalizedSpacing: 0,
				fixedGlued: 0, commentsConverted: 0, fqdnConverted: 0,
				portRemoved: 0, trailingSlashRemoved: 0,
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

				// 127.0.0.1 → 0.0.0.0
				if ((/^127\.0\.0\.1\s+|^195\.187\.6\.3[3-5]\s+/).test(line)) {
					line = line.replace(/^127\.0\.0\.1\s+|^195\.187\.6\.3[3-5]\s+/, '0.0.0.0 ');
					stats.ipsReplaced++;
					stats.modifiedLines++;
				}

				// ||example.com^ → 0.0.0.0 example.com
				if (line.startsWith('||') && line.endsWith('^')) {
					line = `0.0.0.0 ${line.slice(2, -1)}`;
					stats.convertedAdGuard++;
					stats.modifiedLines++;
				}

				// example.com/ → example.com
				if (line.endsWith('/')) {
					line = line.slice(0, -1);
					stats.trailingSlashRemoved++;
					stats.modifiedLines++;
				}

				// example.com → 0.0.0.0 example.com
				if (!line.startsWith('0.0.0.0 ')) {
					line = `0.0.0.0 ${line.toLowerCase()}`;
					stats.fqdnConverted++;
					stats.modifiedLines++;
				}

				// 0.0.0.0example.com → 0.0.0.0 example.com
				const glued = line.match(/^0\.0\.0\.0([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})(\s+.*)?$/);
				if (glued) {
					line = `0.0.0.0 ${glued[1].toLowerCase()}${glued[2] || ''}`;
					stats.fixedGlued++;
					stats.modifiedLines++;
				}

				// 0.0.0.0 EXAMPLE.com → 0.0.0.0 example.com
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

				// 0.0.0.0   example.com → 0.0.0.0 example.com
				if ((/^0\.0\.0\.0\s{2,}|\t+/).test(line)) {
					line = line.replace(/^0\.0\.0\.0\s+/, '0.0.0.0 ');
					stats.normalizedSpacing++;
					stats.modifiedLines++;
				}

				// 0.0.0.0 multi-domain handling (with port fix)
				if (line.startsWith('0.0.0.0')) {
					const commentIndex = line.indexOf('#');
					const hasComment = commentIndex !== -1;
					const commentText = hasComment ? line.slice(commentIndex).trim() : '';
					const mainPart = hasComment ? line.slice(0, commentIndex).trim() : line.trim();
					const parts = mainPart.split(/\s+/);

					if (parts.length >= 2) {
						const newLines = [];
						for (let i = 0; i < parts.length - 1; i++) {
							const current = parts[i];
							const next = parts[i + 1];

							if (isIPAddress(current)) {
								if (next && !isIPAddress(next)) {
									// 0.0.0.0 example.com:1234 → 0.0.0.0 example.com
									const domain = next.split(':')[0];
									let entry = `${current} ${domain.toLowerCase()}`;

									if (newLines.length === 0 && commentText) {
										entry += ` ${commentText}`;
									}

									newLines.push(entry);
									if (domain !== next) stats.portRemoved++;

									i++;
								}
							}
						}

						if (newLines.length) {
							const joined = newLines.join('\n');
							if (joined !== line) {
								line = joined;
								stats.modifiedLines++;
							}
							if (newLines.length > 1) {
								stats.splitMultiDomain++;
							}
						}
					}
				}

				// ! comment → # comment
				if (line.startsWith('!')) {
					line = line.replace(/^!+/, '#');
					if (line === '# Syntax: Adblock Plus Filter List') {
						line = '# Syntax: 0.0.0.0 domain.tld';
					}
					stats.commentsConverted++;
					stats.modifiedLines++;
				}

				processedLines.push(line);
			}

			if (Object.values(stats).some(Boolean)) {
				await writeFile(filePath, processedLines.join('\n').trim(), 'utf8');

				console.log('📝', filePath);
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