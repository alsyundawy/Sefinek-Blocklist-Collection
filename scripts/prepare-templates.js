const { mkdir, readdir, readFile, writeFile } = require('node:fs/promises');
const { join } = require('node:path');
const validator = require('validator');
const local = require('./utils/local.js');

const emoji = key => ({
	modifiedLines: '🔧', convertedDomains: '✨', invalidLinesRemoved: '🧹',
	ipsReplaced: '🔄', domainToLower: '🔡', convertedAdGuard: '🔄',
	splitMultiDomain: '✂️', normalizedSpacing: '🔃', fixedGlued: '🩹',
	commentsConverted: '💬', fqdnConverted: '🌐', portRemoved: '🔪',
}[key] || '');

const isSuspiciousDomain = domain =>
	typeof domain !== 'string' ||
	domain.length > 255 ||
	(domain.match(/\./g) || []).length > 32 ||
	!(/^[a-z0-9._-]+$/i).test(domain);

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
				fixedGlued: 0, commentsConverted: 0, fqdnConverted: 0, portRemoved: 0,
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

				// ! comment → # comment
				if (line.startsWith('!')) {
					line = line.replace(/^!+/, '#');
					if (line === '# Syntax: Adblock Plus Filter List') line = '# Syntax: 0.0.0.0 domain.tld';
					stats.modifiedLines++;
					stats.commentsConverted++;
				}

				// 127.0.0.1 || 195.187.6.33-35 → 0.0.0.0
				if ((/^127\.0\.0\.1\s+|^195\.187\.6\.3[3-5]\s+/).test(line)) {
					line = line.replace(/^127\.0\.0\.1\s+|^195\.187\.6\.3[3-5]\s+/, '0.0.0.0 ');
					stats.ipsReplaced++;
					stats.modifiedLines++;
				}

				// ||example.com^ → 0.0.0.0 example.com
				if (line.startsWith('||') && line.endsWith('^')) {
					line = `0.0.0.0 ${line.replace(/^(\|\|)/, '').replace(/\^$/, '')}`;
					stats.modifiedLines++;
					stats.convertedAdGuard++;
				}

				// example.com/ → example.com
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

				// 0.0.0.0 DOMAIN.tld → 0.0.0.0 domain.tld
				if ((/^0\.0\.0\.0\s+/).test(line)) {
					const words = line.split(/\s+/);
					const domain = words[1];
					if ((/[A-Z]/).test(domain)) {
						line = `${words[0]} ${domain.toLowerCase()} ${words.slice(2).join(' ')}`.trim();
						stats.modifiedLines++;
						stats.convertedDomains++;
						stats.domainToLower++;
					}
				}

				// 0.0.0.0\t... or 0.0.0.0  ... → 0.0.0.0 ...
				if (line.startsWith('0.0.0.0\t') || line.startsWith('0.0.0.0  ')) {
					line = line.replace(/0\.0\.0\.0\s+/, '0.0.0.0 ');
					stats.modifiedLines++;
					stats.normalizedSpacing++;
				}

				// Split multi-domain line and preserve comment if any
				// . . .

				// 0.0.0.0 example.com:1234 → 0.0.0.0 example.com
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

					line = `0.0.0.0 ${domain}${rest.length ? ` ${rest.join(' ')}` : ''}`;
					if (domain !== rawDomain) stats.modifiedLines++;
				}

				processedLines.push(line);
			}

			// Summary
			if (Object.values(stats).some(Boolean)) {
				await writeFile(filePath, processedLines.join('\n'), 'utf8');

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