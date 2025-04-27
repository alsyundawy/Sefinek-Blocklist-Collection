const { Schema, model } = require('mongoose');

const CategoriesSchema = new Schema({
	'0000': { type: Number, default: 0 },
	'127001': { type: Number, default: 0 },
	adguard: { type: Number, default: 0 },
	dnsmasq: { type: Number, default: 0 },
	noip: { type: Number, default: 0 },
	rpz: { type: Number, default: 0 },
	unbound: { type: Number, default: 0 },
}, { timestamps: false, _id: false });

const StatsSchema = new Schema({
	total: { type: Number, default: 0 },
	blocklists: { type: Number, default: 0 },

	perDay: { type: Map, of: Number, default: () => ({}) },
	perMonth: { type: Map, of: Number, default: () => ({}) },
	perYear: { type: Map, of: Number, default: () => ({}) },

	categories: { type: CategoriesSchema, default: () => ({}) },

	responses: { type: Map, of: Number, default: () => ({}) },
	updateStatsFail: { type: Number, default: 0 },
}, { timestamps: true, versionKey: false });

module.exports = model('request-stats', StatsSchema);