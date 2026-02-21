const CACHE_TTL = 10 * 60 * 1000; // 10 minutes (within 14-min URL expiry)

// In-memory cache: deezerId -> { tracks, timestamp }
const cache = new Map();

// Word-overlap similarity for track matching
const wordSimilarity = (a, b) => {
	const normalize = (s) => s.toLowerCase()
		.replace(/[^\w\s]/g, '')
		.split(/\s+/)
		.filter(w => w.length > 1);
	const wordsA = normalize(a);
	const wordsB = normalize(b);
	if (!wordsA.length || !wordsB.length) return 0;
	const setB = new Set(wordsB);
	const matches = wordsA.filter(w => setB.has(w)).length;
	return matches / Math.max(wordsA.length, wordsB.length);
};

export const fetchDeezerTracks = async (deezerId) => {
	if (!deezerId) return null;

	// Check cache
	const cached = cache.get(deezerId);
	if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
		return cached.tracks;
	}

	try {
		const res = await fetch(`/api/deezer/${deezerId}`);
		if (!res.ok) return null;

		const data = await res.json();
		if (!data.data?.length) return null;

		const tracks = data.data.map((t, i) => ({
			id: t.id,
			title: t.title,
			position: i + 1,
			duration: t.duration, // seconds
			previewUrl: t.preview
		}));

		cache.set(deezerId, { tracks, timestamp: Date.now() });
		return tracks;
	} catch {
		return null;
	}
};

// Match Deezer tracks to Discogs tracklist by title similarity
// Returns augmented tracklist with previewUrl added where matched
export const matchTracks = (discogsTracklist, deezerTracks) => {
	if (!deezerTracks?.length) return discogsTracklist || [];

	// No Discogs tracklist — use Deezer tracks as display format
	if (!discogsTracklist?.length) {
		return deezerTracks.map(t => ({
			position: String(t.position),
			title: t.title,
			duration: formatDuration(t.duration),
			previewUrl: t.previewUrl
		}));
	}

	// Match each Discogs track to best Deezer track
	const usedDeezer = new Set();

	return discogsTracklist.map(discogsTrack => {
		let bestMatch = null;
		let bestScore = 0;

		for (const deezerTrack of deezerTracks) {
			if (usedDeezer.has(deezerTrack.id)) continue;
			const score = wordSimilarity(discogsTrack.title, deezerTrack.title);
			if (score > bestScore) {
				bestScore = score;
				bestMatch = deezerTrack;
			}
		}

		if (bestMatch && bestScore >= 0.3) {
			usedDeezer.add(bestMatch.id);
			return { ...discogsTrack, previewUrl: bestMatch.previewUrl };
		}

		return discogsTrack;
	});
};

const formatDuration = (seconds) => {
	if (!seconds) return '';
	const m = Math.floor(seconds / 60);
	const s = seconds % 60;
	return `${m}:${String(s).padStart(2, '0')}`;
};
