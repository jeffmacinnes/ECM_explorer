import { writable, get } from 'svelte/store';

// Cache for loaded detail data
const albumsCache = writable({});
const artistsCache = writable({});

// Loading states
export const isLoadingAlbums = writable(false);
export const isLoadingArtists = writable(false);

// Full detail datasets (loaded on demand)
let albumsDetailData = null;
let artistsDetailData = null;

// Load albums detail data (once, on first album click)
const loadAlbumsDetail = async () => {
	if (albumsDetailData) return albumsDetailData;

	isLoadingAlbums.set(true);
	try {
		const response = await fetch('/data/albums-detail.json');
		albumsDetailData = await response.json();
		return albumsDetailData;
	} catch (error) {
		console.error('Failed to load albums detail:', error);
		return null;
	} finally {
		isLoadingAlbums.set(false);
	}
};

// Load artists detail data (once, on first artist click)
const loadArtistsDetail = async () => {
	if (artistsDetailData) return artistsDetailData;

	isLoadingArtists.set(true);
	try {
		const response = await fetch('/data/artists-detail.json');
		artistsDetailData = await response.json();
		return artistsDetailData;
	} catch (error) {
		console.error('Failed to load artists detail:', error);
		return null;
	} finally {
		isLoadingArtists.set(false);
	}
};

// Get album detail by ID
export const getAlbumDetail = async (albumId) => {
	// Check cache first
	const cache = get(albumsCache);
	if (cache[albumId]) return cache[albumId];

	// Load full dataset if needed
	const data = await loadAlbumsDetail();
	if (!data || !data[albumId]) return null;

	// Cache and return
	albumsCache.update(c => ({ ...c, [albumId]: data[albumId] }));
	return data[albumId];
};

// Get artist detail by ID
export const getArtistDetail = async (artistId) => {
	// Check cache first
	const cache = get(artistsCache);
	if (cache[artistId]) return cache[artistId];

	// Load full dataset if needed
	const data = await loadArtistsDetail();
	if (!data || !data[artistId]) return null;

	// Cache and return
	artistsCache.update(c => ({ ...c, [artistId]: data[artistId] }));
	return data[artistId];
};

// Preload detail data (call on hover for instant modal)
export const preloadAlbumDetail = (albumId) => {
	getAlbumDetail(albumId); // Fire and forget
};

export const preloadArtistDetail = (artistId) => {
	getArtistDetail(artistId); // Fire and forget
};
