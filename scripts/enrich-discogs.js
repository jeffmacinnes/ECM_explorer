import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '../data');
const RAW_DIR = path.join(DATA_DIR, 'raw');

const API_BASE = 'https://api.discogs.com';

// Rate limiting: 60 requests/minute = 1 per second to be safe
const RATE_LIMIT_MS = 1000;

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
		if (response.status === 429) {
			// Rate limited - wait and retry
			console.log('  Rate limited, waiting 60s...');
			await sleep(60000);
			return fetchWithAuth(url);
		}
		throw new Error(`HTTP ${response.status}: ${response.statusText}`);
	}

	return response.json();
};

// Simple word-overlap similarity: fraction of words in common
const titleSimilarity = (a, b) => {
	const normalize = (s) => s.toLowerCase()
		.replace(/\s*\(\d+\)\s*/g, '') // Discogs disambiguation "(2)"
		.replace(/[^\w\s]/g, '')
		.split(/\s+/)
		.filter(w => w.length > 1);
	const wordsA = normalize(a);
	const wordsB = normalize(b);
	if (wordsA.length === 0 || wordsB.length === 0) return 0;
	const setB = new Set(wordsB);
	const matches = wordsA.filter(w => setB.has(w)).length;
	return matches / Math.max(wordsA.length, wordsB.length);
};

// Check if a Discogs result plausibly matches the expected album
const isPlausibleMatch = (result, artist, title) => {
	if (!result.title) return false;
	const discogsTitle = result.title; // format: "Artist - Title"
	const similarity = titleSimilarity(discogsTitle, `${artist} ${title}`);
	// Also check just artist name or just album title separately
	const artistSim = titleSimilarity(discogsTitle, artist);
	const titleSim = titleSimilarity(discogsTitle, title === 's/t' ? artist : title);
	return similarity > 0.25 || artistSim > 0.4 || titleSim > 0.4;
};

// Check if result has an ECM-family label
const hasEcmLabel = (r) =>
	r.label && r.label.some(l => {
		const low = l.toLowerCase();
		return low.includes('ecm') || low.includes('watt') || low.includes('japo') || low.includes('carmo');
	});

// Search Discogs for an album
const searchAlbum = async (artist, title, catalogNumber) => {
	// Clean up catalog number for search (remove spaces, standardize)
	const cleanCatNo = catalogNumber.replace(/\s+/g, ' ').trim();
	const catNoVariants = [
		cleanCatNo,
		cleanCatNo.replace(/\s+/g, ''),  // "ECM1001"
		cleanCatNo.replace('ECM ', 'ECM'),  // "ECM1001"
	];

	// Try searching with catalog number first (most accurate)
	for (const catQuery of catNoVariants) {
		try {
			const catResult = await fetchWithAuth(
				`${API_BASE}/database/search?catno=${encodeURIComponent(catQuery)}&type=master`
			);
			if (catResult.results && catResult.results.length > 0) {
				// Only accept catalog number results if ECM label AND plausible title match
				// Discogs catno search is fuzzy and often returns wrong ECM albums
				for (const r of catResult.results) {
					if (hasEcmLabel(r) && isPlausibleMatch(r, artist, title)) {
						return r;
					}
				}
				// No plausible match — fall through to title+artist search
			}
			await sleep(RATE_LIMIT_MS);
		} catch (err) {
			// Continue to next variant
		}
	}

	// Clean up search terms for title/artist search
	const cleanArtist = artist.replace(/\s*\/\s*/g, ' ').replace(/[^\w\s]/g, '').replace(/&nbsp;/g, '');
	const cleanTitle = title === 's/t' ? artist : title.replace(/[^\w\s]/g, '');

	// Fall back to title + artist search with ECM label filter
	const query = encodeURIComponent(`${cleanArtist} ${cleanTitle}`.trim());
	const result = await fetchWithAuth(
		`${API_BASE}/database/search?q=${query}&type=master&label=ECM+Records`
	);

	if (result.results && result.results.length > 0) {
		// Best: catalog number + plausible match
		for (const r of result.results) {
			if (r.catno) {
				const resultCatNo = r.catno.replace(/\s+/g, '').toUpperCase();
				for (const variant of catNoVariants) {
					if (resultCatNo.includes(variant.replace(/\s+/g, '').toUpperCase())) {
						return r;
					}
				}
			}
		}
		// Good: ECM label + plausible artist/title
		for (const r of result.results) {
			if (hasEcmLabel(r) && isPlausibleMatch(r, artist, title)) {
				return r;
			}
		}
	}

	return null;
};

// Get master release details
const getMasterRelease = async (masterId) => {
	return fetchWithAuth(`${API_BASE}/masters/${masterId}`);
};

// Get a specific release (for credits if master doesn't have them)
const getRelease = async (releaseId) => {
	return fetchWithAuth(`${API_BASE}/releases/${releaseId}`);
};

// Extract credits from a release
const extractCredits = (release) => {
	const credits = [];

	// Primary artists
	if (release.artists) {
		for (const artist of release.artists) {
			credits.push({
				artistId: artist.id,
				artistName: artist.name.replace(/\s*\(\d+\)$/, ''),
				role: 'Primary Artist'
			});
		}
	}

	// Extra artists (musicians, producers, etc.)
	if (release.extraartists) {
		for (const artist of release.extraartists) {
			credits.push({
				artistId: artist.id,
				artistName: artist.name.replace(/\s*\(\d+\)$/, ''),
				role: artist.role || 'Unknown'
			});
		}
	}

	return credits;
};

// Get artist details (image, profile)
const getArtistDetails = async (artistId) => {
	return fetchWithAuth(`${API_BASE}/artists/${artistId}`);
};

// Fetch details for all unique artists
const fetchArtistDetails = async (enriched, artistsPath) => {
	// Collect unique artist IDs from all enriched albums
	const artistIds = new Set();
	for (const album of Object.values(enriched)) {
		if (album.credits) {
			for (const credit of album.credits) {
				if (credit.artistId) {
					artistIds.add(credit.artistId);
				}
			}
		}
	}

	console.log(`\nFetching details for ${artistIds.size} unique artists...`);

	// Load existing artist data
	let artists = {};
	if (fs.existsSync(artistsPath)) {
		artists = JSON.parse(fs.readFileSync(artistsPath, 'utf-8'));
		console.log(`Loaded ${Object.keys(artists).length} existing artist entries`);
	}

	let fetched = 0;
	let skipped = 0;
	const artistIdArray = Array.from(artistIds);

	for (let i = 0; i < artistIdArray.length; i++) {
		const artistId = artistIdArray[i];

		// Skip if already fetched
		if (artists[artistId]) {
			skipped++;
			continue;
		}

		try {
			console.log(`[${i + 1}/${artistIdArray.length}] Fetching artist ${artistId}...`);
			const artistData = await getArtistDetails(artistId);

			artists[artistId] = {
				id: artistId,
				name: artistData.name?.replace(/\s*\(\d+\)$/, ''),
				realName: artistData.realname || null,
				profile: artistData.profile || null,
				imageUrl: artistData.images?.[0]?.uri || null,
				thumbUrl: artistData.images?.[0]?.uri150 || null,
				discogsUrl: artistData.uri || null
			};

			fetched++;

			// Save progress every 20 artists
			if (fetched % 20 === 0) {
				fs.writeFileSync(artistsPath, JSON.stringify(artists, null, 2));
			}

			await sleep(RATE_LIMIT_MS);
		} catch (err) {
			console.error(`  Error fetching artist ${artistId}: ${err.message}`);
			artists[artistId] = { id: artistId, error: err.message };
		}
	}

	// Final save
	fs.writeFileSync(artistsPath, JSON.stringify(artists, null, 2));

	console.log(`\n  Fetched: ${fetched}`);
	console.log(`  Skipped (already fetched): ${skipped}`);

	return artists;
};

// Main execution
const main = async () => {
	// Parse command line args
	const args = process.argv.slice(2);
	const limitIndex = args.indexOf('--limit');
	const LIMIT = limitIndex !== -1 ? parseInt(args[limitIndex + 1], 10) : null;
	const startIndex = args.indexOf('--start');
	const START = startIndex !== -1 ? parseInt(args[startIndex + 1], 10) : 0;
	const skipArtists = args.includes('--skip-artists');
	const artistsOnly = args.includes('--artists-only');

	if (LIMIT) {
		console.log(`Running in test mode: limiting to ${LIMIT} entries\n`);
	}

	// Ensure directories exist
	fs.mkdirSync(RAW_DIR, { recursive: true });

	// Load ecmreviews catalog
	const catalogPath = path.join(RAW_DIR, 'ecmreviews-catalog.json');
	if (!fs.existsSync(catalogPath)) {
		console.error('ECM Reviews catalog not found. Run fetch-ecmreviews.js first.');
		process.exit(1);
	}

	let entries = JSON.parse(fs.readFileSync(catalogPath, 'utf-8'));
	console.log(`Loaded ${entries.length} catalog entries\n`);

	// Apply start/limit
	if (START > 0) {
		entries = entries.slice(START);
		console.log(`Starting from index ${START}`);
	}
	if (LIMIT) {
		entries = entries.slice(0, LIMIT);
	}

	// Load existing progress
	const enrichedPath = path.join(RAW_DIR, 'discogs-enriched.json');
	let enriched = {};
	if (fs.existsSync(enrichedPath)) {
		enriched = JSON.parse(fs.readFileSync(enrichedPath, 'utf-8'));
		console.log(`Loaded ${Object.keys(enriched).length} existing enriched entries\n`);
	}

	// Process entries
	let found = 0;
	let notFound = 0;
	let skipped = 0;

	for (let i = 0; i < entries.length; i++) {
		const entry = entries[i];
		const catNo = entry.catalogNumber;

		// Skip if already enriched
		if (enriched[catNo]) {
			skipped++;
			continue;
		}

		console.log(`[${i + 1 + START}/${entries.length + START}] Searching: ${catNo} - ${entry.artist} - ${entry.title}`);

		try {
			// Search for the album
			const searchResult = await searchAlbum(entry.artist, entry.title, catNo);
			await sleep(RATE_LIMIT_MS);

			if (!searchResult) {
				console.log('  Not found');
				enriched[catNo] = { found: false };
				notFound++;
				continue;
			}

			console.log(`  Found: ${searchResult.title} (Master ${searchResult.master_id || searchResult.id})`);

			// Get master release details
			let masterData = null;
			let credits = [];

			if (searchResult.master_id) {
				masterData = await getMasterRelease(searchResult.master_id);
				await sleep(RATE_LIMIT_MS);

				// Master releases often don't have full credits, get main release
				if (masterData.main_release) {
					const mainRelease = await getRelease(masterData.main_release);
					await sleep(RATE_LIMIT_MS);
					credits = extractCredits(mainRelease);
				}
			} else if (searchResult.id) {
				// It's a release, not a master
				const releaseData = await getRelease(searchResult.id);
				await sleep(RATE_LIMIT_MS);
				credits = extractCredits(releaseData);
				masterData = releaseData;
			}

			// Extract community data from the release we already fetched
			const community = masterData?.community ? {
				have: masterData.community.have || 0,
				want: masterData.community.want || 0,
				rating: masterData.community.rating?.average || 0,
				ratingCount: masterData.community.rating?.count || 0
			} : null;

			enriched[catNo] = {
				found: true,
				discogsId: searchResult.master_id || searchResult.id,
				discogsType: searchResult.master_id ? 'master' : 'release',
				discogsUrl: searchResult.resource_url,
				title: searchResult.title,
				year: masterData?.year || searchResult.year,
				genres: masterData?.genres || [],
				styles: masterData?.styles || [],
				coverUrl: searchResult.cover_image || masterData?.images?.[0]?.uri,
				thumbUrl: searchResult.thumb,
				credits,
				community
			};

			found++;

			// Save progress every 10 entries
			if ((found + notFound) % 10 === 0) {
				fs.writeFileSync(enrichedPath, JSON.stringify(enriched, null, 2));
			}

		} catch (err) {
			console.error(`  Error: ${err.message}`);
			enriched[catNo] = { found: false, error: err.message };
			notFound++;
		}
	}

	// Final save
	fs.writeFileSync(enrichedPath, JSON.stringify(enriched, null, 2));

	console.log('\n✓ Album enrichment done!');
	console.log(`  Found: ${found}`);
	console.log(`  Not found: ${notFound}`);
	console.log(`  Skipped (already enriched): ${skipped}`);

	// Fetch artist details unless skipped
	const artistsPath = path.join(RAW_DIR, 'discogs-artists.json');
	if (!skipArtists) {
		await fetchArtistDetails(enriched, artistsPath);
	}

	console.log(`\n✓ All done!`);
	console.log(`\nData saved to:`);
	console.log(`  Albums: ${enrichedPath}`);
	if (!skipArtists) {
		console.log(`  Artists: ${artistsPath}`);
	}
};

// Artists-only mode - just fetch artist details from existing enriched data
const mainArtistsOnly = async () => {
	const enrichedPath = path.join(RAW_DIR, 'discogs-enriched.json');
	const artistsPath = path.join(RAW_DIR, 'discogs-artists.json');

	if (!fs.existsSync(enrichedPath)) {
		console.error('No enriched album data found. Run without --artists-only first.');
		process.exit(1);
	}

	const enriched = JSON.parse(fs.readFileSync(enrichedPath, 'utf-8'));
	console.log(`Loaded ${Object.keys(enriched).length} enriched albums\n`);

	await fetchArtistDetails(enriched, artistsPath);

	console.log(`\n✓ Done! Artists saved to: ${artistsPath}`);
};

// Community-only mode - backfill community data for existing enriched albums
const mainCommunityOnly = async () => {
	const enrichedPath = path.join(RAW_DIR, 'discogs-enriched.json');

	if (!fs.existsSync(enrichedPath)) {
		console.error('No enriched album data found. Run without --community-only first.');
		process.exit(1);
	}

	const enriched = JSON.parse(fs.readFileSync(enrichedPath, 'utf-8'));
	const entries = Object.entries(enriched).filter(([, data]) => data.found && !data.community);

	console.log(`Found ${entries.length} albums missing community data\n`);

	let fetched = 0;
	let errors = 0;

	for (let i = 0; i < entries.length; i++) {
		const [catNo, data] = entries[i];

		try {
			console.log(`[${i + 1}/${entries.length}] ${catNo} (${data.discogsType} ${data.discogsId})`);

			let releaseData;
			if (data.discogsType === 'master') {
				// Need to get main release for community data
				const master = await getMasterRelease(data.discogsId);
				await sleep(RATE_LIMIT_MS);
				if (master.main_release) {
					releaseData = await getRelease(master.main_release);
					await sleep(RATE_LIMIT_MS);
				}
			} else {
				releaseData = await getRelease(data.discogsId);
				await sleep(RATE_LIMIT_MS);
			}

			if (releaseData?.community) {
				data.community = {
					have: releaseData.community.have || 0,
					want: releaseData.community.want || 0,
					rating: releaseData.community.rating?.average || 0,
					ratingCount: releaseData.community.rating?.count || 0
				};
				console.log(`  have:${data.community.have} want:${data.community.want} rating:${data.community.rating} (${data.community.ratingCount} votes)`);
			} else {
				data.community = { have: 0, want: 0, rating: 0, ratingCount: 0 };
				console.log('  No community data available');
			}

			fetched++;

			// Save progress every 20 entries
			if (fetched % 20 === 0) {
				fs.writeFileSync(enrichedPath, JSON.stringify(enriched, null, 2));
				console.log('  (saved progress)');
			}
		} catch (err) {
			console.error(`  Error: ${err.message}`);
			errors++;
		}
	}

	// Final save
	fs.writeFileSync(enrichedPath, JSON.stringify(enriched, null, 2));

	console.log(`\n✓ Community backfill done!`);
	console.log(`  Fetched: ${fetched}`);
	console.log(`  Errors: ${errors}`);
	console.log(`\nSaved to: ${enrichedPath}`);
};

// Check which mode to run
const args = process.argv.slice(2);
if (args.includes('--community-only')) {
	mainCommunityOnly().catch(console.error);
} else if (args.includes('--artists-only')) {
	mainArtistsOnly().catch(console.error);
} else {
	main().catch(console.error);
}
