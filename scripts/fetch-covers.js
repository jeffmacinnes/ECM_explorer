import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_PATH = path.join(__dirname, '../src/lib/data/ecm-catalog.json');
const ORIGINALS_DIR = path.join(__dirname, '../data/covers-original');
const PROGRESS_FILE = path.join(__dirname, '../data/cover-scrape-progress.json');

const RATE_LIMIT_MS = 500;
const BATCH_SIZE = 50;
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const args = process.argv.slice(2);
const limitIndex = args.indexOf('--limit');
const LIMIT = limitIndex !== -1 ? parseInt(args[limitIndex + 1], 10) : null;
const FORCE = args.includes('--force');

// Extract the first content image URL from an ecmreviews page
const extractCoverUrl = async (reviewUrl) => {
	const response = await fetch(reviewUrl, {
		headers: { 'User-Agent': 'ECMExplorer/1.0' }
	});
	if (!response.ok) throw new Error(`HTTP ${response.status}`);

	const html = await response.text();

	// First image in entry-content that's in wp-content/uploads
	const contentMatch = html.match(/class="entry-content"[\s\S]*?<img[^>]+src="([^"]+wp-content\/uploads\/[^"]+\.(?:jpg|jpeg|png))[^"]*"/i);
	if (contentMatch) {
		return contentMatch[1].replace(/\?.*$/, '');
	}

	// Fallback: any wp-content image that's not site chrome
	const imgMatches = [...html.matchAll(/src="(https:\/\/ecmreviews\.com\/wp-content\/uploads\/[^"]+\.(?:jpg|jpeg|png))[^"]*"/gi)];
	for (const m of imgMatches) {
		const url = m[1].replace(/\?.*$/, '');
		if (url.includes('ecm.jpg') || url.includes('cropped-dsc') || url.includes('ecm-logo')) continue;
		return url;
	}

	return null;
};

// Download image and save as-is (native resolution, original format)
const downloadOriginal = async (url, outputPath) => {
	const response = await fetch(url, {
		headers: { 'User-Agent': 'ECMExplorer/1.0' }
	});
	if (!response.ok) throw new Error(`HTTP ${response.status}`);

	const buffer = Buffer.from(await response.arrayBuffer());
	fs.writeFileSync(outputPath, buffer);
	return buffer.length;
};

// Load/save progress
const loadProgress = () => {
	if (fs.existsSync(PROGRESS_FILE)) {
		return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8'));
	}
	return {};
};

const saveProgress = (progress) => {
	fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
};

const main = async () => {
	fs.mkdirSync(ORIGINALS_DIR, { recursive: true });
	fs.mkdirSync(path.dirname(PROGRESS_FILE), { recursive: true });

	const catalog = JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'));
	const progress = loadProgress();

	let albums = catalog.albums.filter(a => a.reviewUrl);
	if (!FORCE) {
		albums = albums.filter(a => !progress[a.id]);
	}
	if (LIMIT) {
		albums = albums.slice(0, LIMIT);
	}

	const alreadyDone = Object.keys(progress).length;
	console.log(`Fetching cover originals from ecmreviews.com`);
	console.log(`  ${albums.length} to fetch (${alreadyDone} already done)\n`);

	let fetched = 0;
	let failed = 0;

	for (let i = 0; i < albums.length; i++) {
		const album = albums[i];
		process.stdout.write(`[${i + 1}/${albums.length}] ${album.catalogNumber} - ${album.artist}...`);

		try {
			const coverUrl = await extractCoverUrl(album.reviewUrl);
			if (!coverUrl) {
				console.log(' no image found');
				failed++;
				await sleep(RATE_LIMIT_MS);
				continue;
			}

			// Preserve original extension
			const ext = path.extname(new URL(coverUrl).pathname) || '.jpg';
			const filename = `${album.id}${ext}`;
			const outputPath = path.join(ORIGINALS_DIR, filename);

			const size = await downloadOriginal(coverUrl, outputPath);
			progress[album.id] = { url: coverUrl, file: filename, size };
			fetched++;
			console.log(` ${(size / 1024).toFixed(0)} KB`);

		} catch (err) {
			console.log(` error: ${err.message}`);
			failed++;
		}

		if ((fetched + failed) % BATCH_SIZE === 0) {
			saveProgress(progress);
		}

		await sleep(RATE_LIMIT_MS);
	}

	saveProgress(progress);

	// Summary
	const files = fs.readdirSync(ORIGINALS_DIR);
	const totalSize = files.reduce((sum, f) =>
		sum + fs.statSync(path.join(ORIGINALS_DIR, f)).size, 0);

	console.log(`\n✓ Done!`);
	console.log(`  Fetched: ${fetched}, Failed: ${failed}`);
	console.log(`  Total originals: ${files.length} files (${(totalSize / 1024 / 1024).toFixed(1)} MB)`);
};

main().catch(console.error);
