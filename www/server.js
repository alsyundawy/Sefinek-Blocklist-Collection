const express = require('express');
const helmet = require('helmet');

// Middleware imports
const timeout = require('./middlewares/timeout.js');
const morgan = require('./middlewares/morgan.js');
const limiter = require('./middlewares/ratelimit.js');
const updateStats = require('./middlewares/other/updateStats.js');
const { notFound, internalError } = require('./middlewares/other/errors.js');

// Express instance
const app = express();

// Set
app.set('trust proxy', 1);
app.set('view engine', 'ejs');
app.set('views', './www/views');

// Use
app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: false }));

// Static (public)
app.use(express.static('./www/public'));

// Morgan & ratelimits & timeout
app.use(morgan);
app.use(limiter);
app.use(timeout());


// Stats
if (process.env.NODE_ENV === 'production') app.use(updateStats);

// Endpoints
app.use(require('./routes/Main.js'));

// Blocklists
app.use(require('./routes/Blocklists/Deprecated.js'));
app.use(require('./routes/Blocklists/Main.js'));


// Errors
app.use(notFound);
app.use(internalError);

// Run server
const { DOMAIN, PORT } = process.env;
app.listen(PORT, () => process.send ? process.send('ready') : console.log(`Server running at ${DOMAIN}:${PORT}`));