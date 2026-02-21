import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RAW_DATA_DIR = path.join(__dirname, '../data');
const RAW_DIR = path.join(RAW_DATA_DIR, 'raw');
const OUTPUT_DIR = path.join(__dirname, '../src/lib/data');
const COVERS_DIR = path.join(__dirname, '../static/covers');
const ARTISTS_DIR = path.join(__dirname, '../static/artists');

// Generate a consistent ID from a string
const generateId = (str) => {
	return str.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '');
};

const main = async () => {
	console.log('Loading data sources...\n');

	// Load ecmreviews catalog
	const catalogPath = path.join(RAW_DATA_DIR, 'ecm-catalog-reviews.json');
	if (!fs.existsSync(catalogPath)) {
		console.error('ECM Reviews catalog not found. Run fetch-ecmreviews.js first.');
		process.exit(1);
	}
	const catalogData = JSON.parse(fs.readFileSync(catalogPath, 'utf-8'));
	console.log(`  ECM Reviews: ${catalogData.entries.length} entries`);

	// Load Discogs enrichment (optional)
	const enrichedPath = path.join(RAW_DIR, 'discogs-enriched.json');
	let enriched = {};
	if (fs.existsSync(enrichedPath)) {
		enriched = JSON.parse(fs.readFileSync(enrichedPath, 'utf-8'));
		console.log(`  Discogs albums: ${Object.keys(enriched).length} enriched entries`);
	} else {
		console.log('  Discogs: No enrichment data (run enrich-discogs.js to add credits)');
	}

	// Load Discogs artist details (optional)
	const artistsPath = path.join(RAW_DIR, 'discogs-artists.json');
	let artistDetails = {};
	if (fs.existsSync(artistsPath)) {
		artistDetails = JSON.parse(fs.readFileSync(artistsPath, 'utf-8'));
		console.log(`  Discogs artists: ${Object.keys(artistDetails).length} artist profiles`);
	}

	// Load Deezer matches (optional)
	const deezerPath = path.join(RAW_DIR, 'deezer-matches.json');
	let deezerMatches = {};
	if (fs.existsSync(deezerPath)) {
		deezerMatches = JSON.parse(fs.readFileSync(deezerPath, 'utf-8'));
		const matched = Object.values(deezerMatches).filter(m => m.deezerId).length;
		console.log(`  Deezer matches: ${matched} albums`);
	}

	console.log('\nMerging data...\n');

	// Build the merged dataset
	const albums = [];
	const artistsMap = new Map();
	const credits = [];

	for (const entry of catalogData.entries) {
		const catNo = entry.catalogNumber;
		const albumId = `album-${generateId(catNo)}`;

		// Check for local cover image
		const coverFile = `${albumId}.webp`;
		const hasLocalCover = fs.existsSync(path.join(COVERS_DIR, coverFile));

		// Base album data from ecmreviews
		const album = {
			id: albumId,
			catalogNumber: catNo,
			series: entry.series,
			artist: entry.artist,
			title: entry.title,
			recordingDate: entry.recordingDate || null,
			review: entry.review || null,
			reviewUrl: entry.reviewUrl || null,
			localThumb: hasLocalCover ? `/covers/${coverFile}` : null,
			// Will be enriched from Discogs
			year: null,
			coverUrl: null,
			thumbUrl: null,
			genres: [],
			styles: [],
			discogsId: null,
			discogsUrl: null,
			deezerId: deezerMatches[catNo]?.deezerId || null
		};

		// Enrich from Discogs if available
		const discogsData = enriched[catNo];
		if (discogsData && discogsData.found) {
			album.year = discogsData.year;
			album.coverUrl = discogsData.coverUrl;
			album.thumbUrl = discogsData.thumbUrl;
			album.genres = discogsData.genres || [];
			album.styles = discogsData.styles || [];
			album.discogsId = discogsData.discogsId;
			album.discogsUrl = discogsData.discogsType === 'master'
				? `https://www.discogs.com/master/${discogsData.discogsId}`
				: `https://www.discogs.com/release/${discogsData.discogsId}`;
			album.community = discogsData.community || null;
			album.tracklist = discogsData.tracklist || [];

			// Process credits
			if (discogsData.credits) {
				for (const credit of discogsData.credits) {
					const artistId = `artist-${credit.artistId}`;

					// Add/update artist
					if (!artistsMap.has(artistId)) {
						const details = artistDetails[credit.artistId] || {};
						const artistFile = `${artistId}.webp`;
						const hasLocalImage = fs.existsSync(path.join(ARTISTS_DIR, artistFile));
						artistsMap.set(artistId, {
							id: artistId,
							discogsId: credit.artistId,
							name: credit.artistName,
							realName: details.realName || null,
							imageUrl: details.imageUrl || null,
							thumbUrl: details.thumbUrl || null,
							localImage: hasLocalImage ? `/artists/${artistFile}` : null,
							profile: details.profile || null,
							instruments: new Set()
						});
					}

					// Parse and add instruments from role
					const artist = artistsMap.get(artistId);
					const roles = credit.role.split(',').map(r => r.trim());
					for (const role of roles) {
						// Skip non-instrument roles for instrument list
						if (!isNonMusicalRole(role)) {
							artist.instruments.add(role);
						}
					}

					// Add credit
					credits.push({
						albumId,
						artistId,
						role: credit.role
					});
				}
			}
		}

		albums.push(album);
	}

	// Convert artist instruments from Set to Array
	const artists = Array.from(artistsMap.values()).map(artist => ({
		...artist,
		instruments: Array.from(artist.instruments)
	}));

	// Build final dataset
	const dataset = {
		albums,
		artists,
		credits,
		meta: {
			generatedAt: new Date().toISOString(),
			sources: {
				ecmreviews: {
					fetchedAt: catalogData.meta.fetchedAt,
					totalAlbums: catalogData.meta.totalEntries,
					albumsWithReviews: catalogData.meta.entriesWithReviews
				},
				discogs: {
					enrichedAlbums: Object.values(enriched).filter(e => e.found).length
				}
			},
			totals: {
				albums: albums.length,
				artists: artists.length,
				credits: credits.length,
				albumsWithCover: albums.filter(a => a.coverUrl).length,
				albumsWithReview: albums.filter(a => a.review).length,
				artistsWithImage: artists.filter(a => a.imageUrl).length
			}
		}
	};

	// Ensure output directory exists
	fs.mkdirSync(OUTPUT_DIR, { recursive: true });

	// Save merged dataset
	const outputPath = path.join(OUTPUT_DIR, 'ecm-catalog.json');
	fs.writeFileSync(outputPath, JSON.stringify(dataset, null, 2));

	console.log('✓ Done!\n');
	console.log('Summary:');
	console.log(`  Albums: ${dataset.meta.totals.albums}`);
	console.log(`  Artists: ${dataset.meta.totals.artists}`);
	console.log(`  Credits: ${dataset.meta.totals.credits}`);
	console.log(`  Albums with cover art: ${dataset.meta.totals.albumsWithCover}`);
	console.log(`  Albums with reviews: ${dataset.meta.totals.albumsWithReview}`);
	console.log(`  Artists with images: ${dataset.meta.totals.artistsWithImage}`);
	console.log(`\nSaved to: ${outputPath}`);
};

// Check if a role is non-musical (production, design, etc.)
const isNonMusicalRole = (role) => {
	const nonMusical = [
		'producer', 'engineer', 'mixed', 'mastered', 'design', 'cover',
		'photography', 'photo', 'artwork', 'liner notes', 'written-by',
		'composed', 'arranged', 'executive', 'coordinator', 'supervisor',
		'lacquer', 'cut', 'pressed', 'manufactured', 'copyright', 'published',
		'recorded at', 'studio', 'management', 'a&r'
	];
	const lowerRole = role.toLowerCase();
	return nonMusical.some(term => lowerRole.includes(term));
};

main().catch(console.error);
