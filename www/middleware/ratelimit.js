const rateLimit = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');
const error = require('./other/errors.js');
const RedisClient = require('../services/redis.js');

const limiter = rateLimit({
	windowMs: 2 * 60 * 1000,
	limit: 225,
	standardHeaders: 'draft-7',
	legacyHeaders: false,
	store: new RedisStore({ sendCommand: (...args) => RedisClient.sendCommand(args), prefix: 'ratelimit:www:' }),
	skip: () => process.env.NODE_ENV === 'development',
	handler: (req, res) => error.rateLimit(req, res),
});

module.exports = limiter;