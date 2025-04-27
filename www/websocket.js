const WebSocket = require('ws');
const formatTime = require('./utils/time.js');
const RequestStats = require('./database/models/RequestStats');

const wss = new WebSocket.Server({ port: process.env.WS_PORT });

wss.on('connection', ws => {
	console.log('New WebSocket connection established');

	const interval = setInterval(async () => {
		const db = await RequestStats.findOne({}).lean();

		ws.send(JSON.stringify({
			stats: {
				total: db.total,
				blocklists: db.blocklists,
				perDay: db.perDay,
				perMonth: db.perMonth,
				perYear: db.perYear,
				categories: db.categories,
				responses: db.responses,
			},
			uptime: formatTime.full(process.uptime()),
			coll: {
				createdAt: db.createdAt,
				updatedAt: db.updatedAt,
			},
		}));
	}, 2500);

	ws.on('close', () => {
		console.log('WebSocket connection was closed');
		clearInterval(interval);
	});

	ws.on('error', console.error);
});

console.log(`WebSocket server is running on ${process.env.WS_ADDRESS} (port ${process.env.WS_PORT})`);