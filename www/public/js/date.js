const options = {
	year: 'numeric',
	month: 'long',
	day: 'numeric',
	hour: '2-digit',
	minute: '2-digit',
	second: '2-digit',
	timeZoneName: 'short',
};

const formatDate = str => new Date(str).toLocaleDateString(undefined, options);

document.addEventListener('DOMContentLoaded', () => {
	['stats-content-coll-cAt', 'stats-content-coll-uAt'].forEach(id => {
		const el = document.getElementById(id);
		if (el) el.textContent = formatDate(el.textContent);
	});
});
