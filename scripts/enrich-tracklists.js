import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '../data');
const RAW_DIR = path.join(DATA_DIR, 'raw');

const API_BASE = 'https://api.discogs.com';
const RATE_LIMIT_MS = 1050;

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
		headers: { 'User-Agent': 'ECMExplorer/1.0' }
	});

	if (!response.ok) {
		if (response.status === 429) {
			console.log('  Rate limited, waiting 60s...');
			await sleep(60000);
			return fetchWithAuth(url);
		}
		throw new Error(`HTTP ${response.status}: ${response.statusText}`);
	}

	return response.json();
};

const main = async () => {
	const enrichedPath = path.join(RAW_DIR, 'discogs-enriched.json');
	if (!fs.existsSync(enrichedPath)) {
		console.error('No enriched data found. Run enrich-discogs.js first.');
		process.exit(1);
	}

	const enriched = JSON.parse(fs.readFileSync(enrichedPath, 'utf-8'));

	// Find albums that have a Discogs match but no tracklist yet
	const entries = Object.entries(enriched).filter(
		([, data]) => data.found && !data.tracklist
	);

	console.log(`Found ${entries.length} albums missing tracklists\n`);

	if (entries.length === 0) {
		console.log('Nothing to do.');
		return;
	}

	let fetched = 0;
	let errors = 0;

	for (let i = 0; i < entries.length; i++) {
		const [catNo, data] = entries[i];

		try {
			console.log(`[${i + 1}/${entries.length}] ${catNo} (${data.discogsType} ${data.discogsId})`);

			let releaseData;

			if (data.discogsType === 'master') {
				// Fetch master to get main_release, then fetch that release for tracklist
				const master = await fetchWithAuth(`${API_BASE}/masters/${data.discogsId}`);
				await sleep(RATE_LIMIT_MS);

				if (master.main_release) {
					releaseData = await fetchWithAuth(`${API_BASE}/releases/${master.main_release}`);
					await sleep(RATE_LIMIT_MS);
				} else if (master.tracklist && master.tracklist.length > 0) {
					// Some masters have tracklist directly
					releaseData = master;
				}
			} else {
				// Direct release
				releaseData = await fetchWithAuth(`${API_BASE}/releases/${data.discogsId}`);
				await sleep(RATE_LIMIT_MS);
			}

			if (releaseData?.tracklist && releaseData.tracklist.length > 0) {
				data.tracklist = releaseData.tracklist
					.filter(t => t.type_ === 'track') // skip headings/index entries
					.map(t => ({
						position: t.position || '',
						title: t.title || '',
						duration: t.duration || ''
					}));
				console.log(`  ${data.tracklist.length} tracks`);
			} else {
				data.tracklist = [];
				console.log('  No tracklist available');
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

	const withTracklist = Object.values(enriched).filter(d => d.tracklist && d.tracklist.length > 0).length;

	console.log(`\n✓ Tracklist enrichment done!`);
	console.log(`  Fetched: ${fetched}`);
	console.log(`  Errors: ${errors}`);
	console.log(`  Albums with tracklists: ${withTracklist}`);
	console.log(`\nSaved to: ${enrichedPath}`);
};

main().catch(console.error);
