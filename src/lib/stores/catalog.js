import { writable, derived } from 'svelte/store';

// Raw catalog data
export const catalogData = writable(null);
export const artistsIndex = writable([]);

// Loading states
export const isLoading = writable(true);

// Layout mode
export const layoutMode = writable('stream');

// Selected artist filter (null = show all)
export const selectedArtist = writable(null);

// Selected album (for modal)
export const selectedAlbum = writable(null);

// Derived: albums grouped by year
export const albumsByYear = derived(
	[catalogData, selectedArtist],
	([$catalogData, $selectedArtist]) => {
		if (!$catalogData) return [];

		let albums = $catalogData.albums;

		// Filter by artist if selected
		if ($selectedArtist) {
			const artistAlbumIds = new Set(
				$catalogData.credits
					.filter(c => c.artistId === $selectedArtist.id)
					.map(c => c.albumId)
			);
			albums = albums.filter(a => artistAlbumIds.has(a.id));
		}

		// Group by year
		const byYear = new Map();
		for (const album of albums) {
			const year = album.year || 'Unknown';
			if (!byYear.has(year)) {
				byYear.set(year, []);
			}
			byYear.get(year).push(album);
		}

		// Sort years descending (newest first), then albums within each year
		const sorted = Array.from(byYear.entries())
			.sort((a, b) => {
				if (a[0] === 'Unknown') return 1;
				if (b[0] === 'Unknown') return -1;
				return b[0] - a[0];
			})
			.map(([year, albums]) => ({
				year,
				albums: albums.sort((a, b) => {
					// Sort by catalog number within year
					return a.catalogNumber.localeCompare(b.catalogNumber);
				})
			}));

		return sorted;
	}
);

// Derived: all years for minimap (from filtered view)
export const allYears = derived(albumsByYear, ($albumsByYear) => {
	return $albumsByYear.map(g => ({
		year: g.year,
		count: g.albums.length
	}));
});

// Derived: all years with FULL counts (unfiltered) for histogram
export const allYearsUnfiltered = derived(catalogData, ($catalogData) => {
	if (!$catalogData) return [];

	const byYear = new Map();
	for (const album of $catalogData.albums) {
		const year = album.year || 'Unknown';
		byYear.set(year, (byYear.get(year) || 0) + 1);
	}

	return Array.from(byYear.entries())
		.filter(([year]) => year !== 'Unknown')
		.sort((a, b) => b[0] - a[0])
		.map(([year, count]) => ({ year, count }));
});

// Derived: artists sorted by album count
export const artistsByAlbumCount = derived(
	[catalogData, artistsIndex],
	([$catalogData, $artistsIndex]) => {
		if (!$catalogData || !$artistsIndex.length) return [];

		// Count albums per artist from credits
		const counts = new Map();
		for (const credit of $catalogData.credits) {
			const current = counts.get(credit.artistId) || 0;
			counts.set(credit.artistId, current + 1);
		}

		// Get unique album counts (not credit counts)
		const albumCounts = new Map();
		for (const credit of $catalogData.credits) {
			if (!albumCounts.has(credit.artistId)) {
				albumCounts.set(credit.artistId, new Set());
			}
			albumCounts.get(credit.artistId).add(credit.albumId);
		}

		// Merge with artist index and sort
		return $artistsIndex
			.map(artist => ({
				...artist,
				albumCount: albumCounts.get(artist.id)?.size || 0
			}))
			.filter(a => a.albumCount > 0)
			.sort((a, b) => b.albumCount - a.albumCount);
	}
);

// Load catalog data
export const loadCatalog = async () => {
	isLoading.set(true);
	try {
		const [catalogRes, artistsRes, creditsRes] = await Promise.all([
			fetch('/data/catalog-index.json'),
			fetch('/data/artists-index.json'),
			fetch('/data/credits.json')
		]);

		const catalog = await catalogRes.json();
		const artists = await artistsRes.json();
		const credits = await creditsRes.json();

		catalogData.set({ ...catalog, credits });
		artistsIndex.set(artists);
	} catch (error) {
		console.error('Failed to load catalog:', error);
	} finally {
		isLoading.set(false);
	}
};

// Get album detail (for modal)
let albumsDetailCache = null;
export const getAlbumWithCredits = async (albumId) => {
	if (!albumsDetailCache) {
		const res = await fetch('/data/albums-detail.json');
		albumsDetailCache = await res.json();
	}
	return albumsDetailCache[albumId];
};

// Get artist detail (for expanded header)
let artistsDetailCache = null;
export const getArtistDetail = async (artistId) => {
	if (!artistsDetailCache) {
		const res = await fetch('/data/artists-detail.json');
		artistsDetailCache = await res.json();
	}
	return artistsDetailCache[artistId];
};

// Selected artist detail (full info including bio)
export const selectedArtistDetail = writable(null);
