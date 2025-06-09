const WebSocket = require('ws');
const { getFullDate } = require('./utils/time.js');
const RequestStats = require('./database/models/request-stats.model');

const wss = new WebSocket.Server({ port: process.env.WS_PORT });

wss.on('connection', ws => {
	console.log('New WebSocket connection established');

	const interval = setInterval(async () => {
		const db = await RequestStats.findOne({}).lean();

		ws.send(JSON.stringify({
			stats: {
				total: db.total,
				blocklists: db.blocklists,
				categories: db.categories,
			},
			uptime: getFullDate(process.uptime()),
			coll: {
				createdAt: db.createdAt,
				updatedAt: db.updatedAt,
			},
		}));
	}, 2000);

	ws.on('close', () => {
		console.log('WebSocket connection was closed');
		clearInterval(interval);
	});

	ws.on('error', console.error);
});

console.log(`WebSocket server is running at ${process.env.WS_ADDRESS}:${process.env.WS_PORT}`);