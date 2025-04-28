const express = require('express');
const helmet = require('helmet');

// Middleware imports
const timeout = require('./middlewares/timeout.js');
const morgan = require('./middlewares/morgan.js');
const limiter = require('./middlewares/ratelimit.js');
const updateStats = require('./middlewares/other/stats.js');
const { notFound, internalError } = require('./middlewares/other/errors.js');

// Create express instance
const app = express();

// App configuration
app.set('trust proxy', 1);
app.set('view engine', 'ejs');
app.set('views', './www/views');

// Middleware configuration
app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: false }));
app.use(express.static('./www/public'));
app.use(morgan);
app.use(limiter);
app.use(timeout());

// Routes
const IndexRouter = require('./routes/Index.js');
const BlocklistsRouter = require('./routes/Blocklists/Index.js');
const DeprecatedListsRouter = require('./routes/Blocklists/Deprecated.js');


// Stats
app.use(updateStats);
app.use(IndexRouter);
app.use(BlocklistsRouter);
app.use(DeprecatedListsRouter);


// Error handling
app.use(notFound);
app.use(internalError);

// Start the server
const { DOMAIN, PORT } = process.env;
app.listen(PORT, () => process.send ? process.send('ready') : console.log(`Server running at ${DOMAIN}:${PORT}`));