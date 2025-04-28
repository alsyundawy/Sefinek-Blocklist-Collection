const parseCategoryFromLink = require('../../utils/parseCategoryFromLink.js');
const { getDate } = require('../../utils/time.js');

const BOT_REGEX1 = /netcraftsurveyagent|domainsproject\.org|f(?:reepublicapis|acebook)|screaming frog|i(?:a_archiv|ndex)er|s(?:istrix|crapy|lurp)|scraper|(?:s(?:cann|pid)|fetch)er|lychee\/|crawl|yahoo|jest\/|bot/i;

const updateStats = (req, res) => {
	if (req.method !== 'GET' || BOT_REGEX1.test(req.headers['user-agent'])) return;

	try {
		const { url, type } = parseCategoryFromLink(req.originalUrl || req.url);
		const { dateKey, yearKey, monthKey } = getDate();

		const statusCode = res?.statusCode ?? 'unknown';
		const inc = {
			total: 1,
			[`responses.${statusCode}`]: 1,
		};

		if (type && statusCode >= 200 && statusCode <= 304 && (url.includes('.txt') || url.includes('.conf'))) {
			inc.blocklists = 1;
			inc[`categories.${type}`] = 1;
			inc[`perDay.${dateKey}`] = 1;
			inc[`perMonth.${monthKey}-${yearKey}`] = 1;
			inc[`perYear.${yearKey}`] = 1;
			// console.debug(`Updated stats for ${type}`);
		}

		process.send({ type: 'updateStats', data: { inc } });
	} catch (err) {
		console.error('updateStats failed', err);
		process.send({ type: 'updateStats', data: { inc: { updateStatsFail: 1 } } });
	}
};

module.exports = (req, res, next) => {
	res.on('finish', () => updateStats(req, res));
	next();
};