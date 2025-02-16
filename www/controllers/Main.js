const Marked = require('marked');
const { CronExpressionParser } = require('cron-parser');
const { version } = require('../../package.json');
const formatTime = require('../utils/time.js');
const RequestStats = require('../database/models/RequestStats');

Marked.use({ pedantic: false, gfm: true });

exports.index = async (req, res) => {
	const db = await RequestStats.findOne().lean();
	res.render('index.ejs', { version, db, uptime: formatTime.full(process.uptime()) });
};

exports.falsePositives = (req, res) => {
	res.render('false-positives.ejs');
};

exports.updateSchedule = (req, res) => {
	const tzOptions = { tz: 'Europe/Warsaw', currentDate: Date.now() };
	const github = CronExpressionParser.parse('0 */3 * * *', tzOptions);
	const remote = CronExpressionParser.parse('0 1,6 * * *', tzOptions);

	res.render('update-schedule.ejs', { cron: { github: github.next().toISOString(), remote: remote.next().toISOString() }, version });
};