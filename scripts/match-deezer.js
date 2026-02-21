import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '../data');
const RAW_DIR = path.join(DATA_DIR, 'raw');
const OUTPUT_PATH = path.join(RAW_DIR, 'deezer-matches.json');

const DEEZER_API = 'https://api.deezer.com';
const DELAY_MS = 200;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Word-overlap similarity between two strings
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

// Search Deezer and find best match
const searchDeezer = async (artist, title) => {
	const cleanArtist = artist.replace(/\s*\/\s*/g, ' ').replace(/[^\w\s]/g, '').trim();
	const cleanTitle = title === 's/t' ? cleanArtist : title.replace(/[^\w\s]/g, '').trim();
	const query = `${cleanArtist} ${cleanTitle}`;

	const url = `${DEEZER_API}/search/album?q=${encodeURIComponent(query)}&limit=10`;

	const res = await fetch(url);
	if (!res.ok) {
		if (res.status === 429) {
			console.log('  Rate limited, waiting 5s...');
			await sleep(5000);
			return searchDeezer(artist, title);
		}
		throw new Error(`HTTP ${res.status}`);
	}

	const data = await res.json();
	if (!data.data?.length) return null;

	// Score each result by combined artist + title word overlap
	const scored = data.data.map(result => {
		const artistSim = wordSimilarity(result.artist?.name || '', artist);
		const titleSim = wordSimilarity(result.title || '', title === 's/t' ? artist : title);
		const score = artistSim * 0.4 + titleSim * 0.6;
		return { result, score, artistSim, titleSim };
	});

	scored.sort((a, b) => b.score - a.score);

	const best = scored[0];
	if (best.score < 0.2) return null;

	return {
		deezerId: best.result.id,
		title: best.result.title,
		artist: best.result.artist?.name,
		score: Math.round(best.score * 100) / 100,
		trackCount: best.result.nb_tracks
	};
};

const main = async () => {
	// Load catalog
	const catalogPath = path.join(DATA_DIR, 'ecm-catalog-reviews.json');
	if (!fs.existsSync(catalogPath)) {
		console.error('Catalog not found. Run fetch:ecmreviews first.');
		process.exit(1);
	}

	const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf-8'));
	const entries = catalog.entries;
	console.log(`Loaded ${entries.length} catalog entries\n`);

	// Load existing matches (resume support)
	let matches = {};
	if (fs.existsSync(OUTPUT_PATH)) {
		matches = JSON.parse(fs.readFileSync(OUTPUT_PATH, 'utf-8'));
		console.log(`Loaded ${Object.keys(matches).length} existing matches\n`);
	}

	let found = 0;
	let notFound = 0;
	let skipped = 0;

	for (let i = 0; i < entries.length; i++) {
		const entry = entries[i];
		const catNo = entry.catalogNumber;

		if (matches[catNo]) {
			skipped++;
			continue;
		}

		console.log(`[${i + 1}/${entries.length}] ${catNo} — ${entry.artist} — ${entry.title}`);

		try {
			const match = await searchDeezer(entry.artist, entry.title);

			if (match) {
				matches[catNo] = match;
				console.log(`  ✓ ${match.artist} — ${match.title} (score: ${match.score}, ${match.trackCount} tracks)`);
				found++;
			} else {
				matches[catNo] = { deezerId: null };
				console.log('  ✗ No match');
				notFound++;
			}

			// Save progress every 25 entries
			if ((found + notFound) % 25 === 0) {
				fs.writeFileSync(OUTPUT_PATH, JSON.stringify(matches, null, 2));
			}

			await sleep(DELAY_MS);
		} catch (err) {
			console.error(`  Error: ${err.message}`);
			matches[catNo] = { deezerId: null, error: err.message };
			notFound++;
		}
	}

	// Final save
	fs.writeFileSync(OUTPUT_PATH, JSON.stringify(matches, null, 2));

	const totalMatched = Object.values(matches).filter(m => m.deezerId).length;
	console.log('\n✓ Done!');
	console.log(`  Matched: ${totalMatched}/${entries.length}`);
	console.log(`  New found: ${found}`);
	console.log(`  New not found: ${notFound}`);
	console.log(`  Skipped (already matched): ${skipped}`);
	console.log(`\nSaved to: ${OUTPUT_PATH}`);
};

main().catch(console.error);
