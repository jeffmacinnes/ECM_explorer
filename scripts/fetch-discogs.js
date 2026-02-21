import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '../data');
const RAW_DIR = path.join(DATA_DIR, 'raw');

// ECM Records label ID on Discogs (Manfred Eicher's jazz label)
// https://www.discogs.com/label/6785-ECM-Records
const ECM_LABEL_ID = 6785;
const API_BASE = 'https://api.discogs.com';

// Rate limiting: 60 requests/minute = 1 per second to be safe
const RATE_LIMIT_MS = 1000;

// Parse command line args
const args = process.argv.slice(2);
const limitIndex = args.indexOf('--limit');
const LIMIT = limitIndex !== -1 ? parseInt(args[limitIndex + 1], 10) : null;

if (LIMIT) {
	console.log(`Running in test mode: limiting to ${LIMIT} releases\n`);
}

// Load credentials from environment or .env file
const loadEnv = () => {
	const envPath = path.join(__dirname, '../.env');
	if (fs.existsSync(envPath)) {
		const envContent = fs.readFileSync(envPath, 'utf-8');
		envContent.split('\n').forEach(line => {
			const [key, ...valueParts] = line.split('=');
			if (key && valueParts.length) {
				process.env[key.trim()] = valueParts.join('=').trim();
			}
		});
	}
};

loadEnv();

const DISCOGS_KEY = process.env.DISCOGS_CONSUMER_KEY;
const DISCOGS_SECRET = process.env.DISCOGS_CONSUMER_SECRET;

if (!DISCOGS_KEY || !DISCOGS_SECRET) {
	console.error('Missing Discogs credentials. Copy .env.example to .env and add your keys.');
	process.exit(1);
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const fetchWithAuth = async (url) => {
	const separator = url.includes('?') ? '&' : '?';
	const authUrl = `${url}${separator}key=${DISCOGS_KEY}&secret=${DISCOGS_SECRET}`;

	const response = await fetch(authUrl, {
		headers: {
			'User-Agent': 'ECMExplorer/1.0'
		}
	});

	if (!response.ok) {
		throw new Error(`HTTP ${response.status}: ${response.statusText}`);
	}

	return response.json();
};

// Fetch all releases from ECM label with pagination
const fetchLabelReleases = async () => {
	console.log('Fetching ECM label releases...');
	const releases = [];
	let page = 1;
	let hasMore = true;

	// Check for existing progress
	const progressFile = path.join(RAW_DIR, 'label-releases-progress.json');
	if (fs.existsSync(progressFile)) {
		const progress = JSON.parse(fs.readFileSync(progressFile, 'utf-8'));
		releases.push(...progress.releases);
		page = progress.nextPage;
		console.log(`Resuming from page ${page}, ${releases.length} releases loaded`);
	}

	while (hasMore) {
		console.log(`Fetching page ${page}...`);

		try {
			const data = await fetchWithAuth(
				`${API_BASE}/labels/${ECM_LABEL_ID}/releases?page=${page}&per_page=100`
			);

			releases.push(...data.releases);
			console.log(`  Got ${data.releases.length} releases (total: ${releases.length})`);

			// Save progress
			fs.writeFileSync(progressFile, JSON.stringify({
				releases,
				nextPage: page + 1,
				timestamp: new Date().toISOString()
			}));

			// Check if we've hit the limit
			if (LIMIT && releases.length >= LIMIT) {
				releases.length = LIMIT; // Trim to exact limit
				hasMore = false;
			} else {
				hasMore = data.pagination.page < data.pagination.pages;
				page++;

				if (hasMore) {
					await sleep(RATE_LIMIT_MS);
				}
			}
		} catch (err) {
			console.error(`Error on page ${page}:`, err.message);
			console.log('Progress saved. Run again to resume.');
			break;
		}
	}

	return releases;
};

// Fetch detailed release info including credits
const fetchReleaseDetails = async (releaseId) => {
	return fetchWithAuth(`${API_BASE}/releases/${releaseId}`);
};

// Fetch details for all releases (with resume support)
const fetchAllReleaseDetails = async (releases) => {
	console.log(`\nFetching details for ${releases.length} releases...`);

	const detailsFile = path.join(RAW_DIR, 'release-details.json');
	const progressFile = path.join(RAW_DIR, 'details-progress.json');

	let details = {};
	let startIndex = 0;

	// Load existing progress
	if (fs.existsSync(detailsFile)) {
		details = JSON.parse(fs.readFileSync(detailsFile, 'utf-8'));
		startIndex = Object.keys(details).length;
		console.log(`Resuming from index ${startIndex}`);
	}

	for (let i = startIndex; i < releases.length; i++) {
		const release = releases[i];
		const releaseId = release.id;

		// Skip if already fetched
		if (details[releaseId]) continue;

		console.log(`[${i + 1}/${releases.length}] Fetching: ${release.title}`);

		try {
			const detail = await fetchReleaseDetails(releaseId);
			details[releaseId] = detail;

			// Save progress every 10 releases
			if ((i + 1) % 10 === 0) {
				fs.writeFileSync(detailsFile, JSON.stringify(details, null, 2));
				fs.writeFileSync(progressFile, JSON.stringify({ lastIndex: i }));
			}

			await sleep(RATE_LIMIT_MS);
		} catch (err) {
			console.error(`Error fetching ${releaseId}:`, err.message);
			// Save progress and continue
			fs.writeFileSync(detailsFile, JSON.stringify(details, null, 2));
			await sleep(RATE_LIMIT_MS * 2); // Extra wait on error
		}
	}

	// Final save
	fs.writeFileSync(detailsFile, JSON.stringify(details, null, 2));
	console.log(`\nSaved ${Object.keys(details).length} release details`);

	return details;
};

// Check if a catalog number is a proper ECM release
const isEcmCatalogNumber = (catNo) => {
	if (!catNo) return false;
	const upper = catNo.toUpperCase();
	// ECM main series: ECM 1001, ECM 2001, etc.
	// ECM New Series: ECM New Series 1001, ECM-S, etc.
	// JAPO: JAPO 60001, etc.
	// WATT: WATT 1, WATT/6, etc.
	// Carmo: Carmo 001, etc.
	// :rarum - ECM retrospective series
	return /^ECM[\s-]*\d/.test(upper) ||
		   /^ECM[\s-]*NEW/.test(upper) ||
		   /^JAPO/.test(upper) ||
		   /^WATT/.test(upper) ||
		   /^CARMO/.test(upper) ||
		   /^:?RARUM/.test(upper);
};

// Transform raw Discogs data to our app schema
const transformToAppSchema = (releases, details) => {
	console.log('\nTransforming data to app schema...');

	const albums = [];
	const artists = new Map();
	const credits = [];
	const seenAlbumIds = new Set();
	let skippedNonEcm = 0;
	let skippedDuplicates = 0;

	for (const release of releases) {
		const detail = details[release.id];
		if (!detail) continue;

		// Skip duplicates
		if (seenAlbumIds.has(release.id)) {
			skippedDuplicates++;
			continue;
		}
		seenAlbumIds.add(release.id);

		// Extract catalog number (e.g., "ECM 1064")
		const catNo = release.catno || detail.labels?.[0]?.catno || '';

		// Filter to only true ECM releases
		if (!isEcmCatalogNumber(catNo)) {
			skippedNonEcm++;
			continue;
		}

		// Create album entry
		const albumId = `album-${release.id}`;
		const album = {
			id: albumId,
			discogsId: release.id,
			catalogNumber: catNo,
			title: release.title,
			year: detail.year || release.year || null,
			artistIds: [],
			coverUrl: detail.images?.[0]?.uri || null,
			thumb: release.thumb || null
		};

		// Process artists
		const releaseArtists = detail.artists || [];
		for (const artist of releaseArtists) {
			const artistId = `artist-${artist.id}`;

			if (!artists.has(artistId)) {
				artists.set(artistId, {
					id: artistId,
					discogsId: artist.id,
					name: artist.name.replace(/\s*\(\d+\)$/, ''), // Remove disambiguation numbers
					instruments: []
				});
			}

			album.artistIds.push(artistId);
		}

		// Process credits (extraartists in Discogs)
		const extraArtists = detail.extraartists || [];
		for (const credit of extraArtists) {
			const artistId = `artist-${credit.id}`;
			const role = credit.role || 'Unknown';

			if (!artists.has(artistId)) {
				artists.set(artistId, {
					id: artistId,
					discogsId: credit.id,
					name: credit.name.replace(/\s*\(\d+\)$/, ''),
					instruments: []
				});
			}

			// Add instrument to artist's list
			const artistData = artists.get(artistId);
			const instruments = role.split(',').map(r => r.trim());
			for (const inst of instruments) {
				if (!artistData.instruments.includes(inst)) {
					artistData.instruments.push(inst);
				}
			}

			credits.push({
				albumId,
				artistId,
				role
			});
		}

		// Also add main artists to credits
		for (const artist of releaseArtists) {
			credits.push({
				albumId,
				artistId: `artist-${artist.id}`,
				role: 'Primary Artist'
			});
		}

		albums.push(album);
	}

	console.log(`  Skipped ${skippedNonEcm} non-ECM releases`);
	console.log(`  Skipped ${skippedDuplicates} duplicates`);

	return {
		albums,
		artists: Array.from(artists.values()),
		credits,
		meta: {
			source: 'Discogs',
			labelId: ECM_LABEL_ID,
			fetchedAt: new Date().toISOString(),
			totalAlbums: albums.length,
			totalArtists: artists.size,
			totalCredits: credits.length,
			skippedNonEcm,
			skippedDuplicates
		}
	};
};

// Main execution
const main = async () => {
	// Ensure directories exist
	fs.mkdirSync(DATA_DIR, { recursive: true });
	fs.mkdirSync(RAW_DIR, { recursive: true });

	// Step 1: Fetch label releases
	const releases = await fetchLabelReleases();
	fs.writeFileSync(
		path.join(RAW_DIR, 'label-releases.json'),
		JSON.stringify(releases, null, 2)
	);
	console.log(`\nSaved ${releases.length} label releases`);

	// Step 2: Fetch release details
	const details = await fetchAllReleaseDetails(releases);

	// Step 3: Transform to app schema
	const catalog = transformToAppSchema(releases, details);

	// Save final catalog
	fs.writeFileSync(
		path.join(DATA_DIR, 'ecm-catalog.json'),
		JSON.stringify(catalog, null, 2)
	);

	console.log('\n✓ Done!');
	console.log(`  Albums: ${catalog.meta.totalAlbums}`);
	console.log(`  Artists: ${catalog.meta.totalArtists}`);
	console.log(`  Credits: ${catalog.meta.totalCredits}`);
	console.log(`\nData saved to: src/lib/data/ecm-catalog.json`);
};

main().catch(console.error);
