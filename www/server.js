const express = require('express');
const helmet = require('helmet');

// Middleware imports
const timeout = require('./middleware/timeout.js');
const morgan = require('./middleware/morgan.js');
const limiter = require('./middleware/ratelimit.js');
const updateStats = require('./middleware/other/stats-redis.js');
const { notFound, internalError } = require('./middleware/other/errors.js');

// Create express instance
const app = express();

// App configuration
if (process.env.NODE_ENV === 'production') app.set('trust proxy', 1);
app.set('view engine', 'ejs');
app.set('views', './www/views');

// Middleware configuration
app.use(helmet({
	contentSecurityPolicy: {
		directives: {
			scriptSrc: ['\'self\'', 'https://cdn.jsdelivr.net'],
			imgSrc: ['\'self\'', 'https://sefinek.net', 'https://cdn.sefinek.net'],
			connectSrc: ['\'self\'', 'ws:', 'wss:', 'https://cdn.jsdelivr.net'],
		},
	},
	crossOriginResourcePolicy: false,
}));
app.use(express.static('./www/public'));
app.use(morgan);
app.use(limiter);
app.use(timeout());

// Routes
const IndexRouter = require('./routes/Index.js');
const BlocklistsRouter = require('./routes/Blocklists/Index.js');
const StatsRouter = require('./routes/Stats.js');
const DeprecatedListsRouter = require('./routes/Blocklists/Deprecated.js');


// Stats
app.use(updateStats);
app.use(IndexRouter);
app.use(BlocklistsRouter);
app.use(StatsRouter);
app.use(DeprecatedListsRouter);


// Error handling
app.use(notFound);
app.use(internalError);

// Start the server
const { DOMAIN, PORT } = process.env;
app.listen(PORT, () => process.send ? process.send('ready') : console.log(`Server running at ${DOMAIN}:${PORT}`));