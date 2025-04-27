module.exports = (buffer, updateQuery) => {
	if (updateQuery.inc) {
		for (const [key, value] of Object.entries(updateQuery.inc)) {
			buffer.inc[key] = (buffer.inc[key] ?? 0) + value;
		}
	}

	if (updateQuery.set) Object.assign(buffer.set, updateQuery.set);
};