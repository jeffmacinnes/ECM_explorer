import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_PATH = path.join(__dirname, '../src/lib/data/ecm-catalog.json');
const STATIC_DIR = path.join(__dirname, '../static');
const COVERS_DIR = path.join(STATIC_DIR, 'covers');
const ARTISTS_DIR = path.join(STATIC_DIR, 'artists');
const PROGRESS_FILE = path.join(__dirname, '../data/image-download-progress.json');

// Rate limiting - be nice to Discogs
const RATE_LIMIT_MS = 200;
const BATCH_SIZE = 50;

// Parse command line args
const args = process.argv.slice(2);
const limitIndex = args.indexOf('--limit');
const LIMIT = limitIndex !== -1 ? parseInt(args[limitIndex + 1], 10) : null;
const ALBUMS_ONLY = args.includes('--albums-only');
const ARTISTS_ONLY = args.includes('--artists-only');
const SKIP_EXISTING = !args.includes('--force');

if (LIMIT) console.log(`Limiting to ${LIMIT} images per type\n`);
if (ALBUMS_ONLY) console.log('Downloading album covers only\n');
if (ARTISTS_ONLY) console.log('Downloading artist images only\n');

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Download image and convert to WebP
const downloadImage = async (url, outputPath, size = 500) => {
	try {
		const response = await fetch(url, {
			headers: {
				'User-Agent': 'ECMExplorer/1.0'
			}
		});

		if (!response.ok) {
			throw new Error(`HTTP ${response.status}`);
		}

		const buffer = Buffer.from(await response.arrayBuffer());

		// Convert to WebP and resize
		await sharp(buffer)
			.resize(size, size, { fit: 'cover' })
			.webp({ quality: 90 })
			.toFile(outputPath);

		return true;
	} catch (err) {
		console.error(`  Error: ${err.message}`);
		return false;
	}
};

// Load or initialize progress
const loadProgress = () => {
	if (fs.existsSync(PROGRESS_FILE)) {
		return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8'));
	}
	return { albums: {}, artists: {} };
};

const saveProgress = (progress) => {
	fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
};

// Download album covers
const downloadAlbumCovers = async (albums, progress) => {
	console.log(`\nDownloading album covers (${albums.length} total)...`);

	const toDownload = albums
		.filter(a => a.coverUrl || a.thumbUrl)
		.filter(a => !progress.albums[a.id] || !SKIP_EXISTING)
		.slice(0, LIMIT || Infinity);

	console.log(`  ${toDownload.length} to download (${albums.filter(a => progress.albums[a.id]).length} already done)\n`);

	let downloaded = 0;
	let failed = 0;

	for (const album of toDownload) {
		const filename = `${album.id}.webp`;
		const outputPath = path.join(COVERS_DIR, filename);

		// Skip if exists and not forcing
		if (SKIP_EXISTING && fs.existsSync(outputPath)) {
			progress.albums[album.id] = `/covers/${filename}`;
			continue;
		}

		process.stdout.write(`  [${downloaded + failed + 1}/${toDownload.length}] ${album.catalogNumber}...`);

		const success = await downloadImage(album.coverUrl || album.thumbUrl, outputPath);

		if (success) {
			progress.albums[album.id] = `/covers/${filename}`;
			downloaded++;
			console.log(' ✓');
		} else {
			failed++;
			console.log(' ✗');
		}

		// Save progress periodically
		if ((downloaded + failed) % BATCH_SIZE === 0) {
			saveProgress(progress);
		}

		await sleep(RATE_LIMIT_MS);
	}

	saveProgress(progress);
	console.log(`\n  Downloaded: ${downloaded}, Failed: ${failed}`);
	return progress;
};

// Download artist images
const downloadArtistImages = async (artists, progress) => {
	console.log(`\nDownloading artist images (${artists.length} total)...`);

	const toDownload = artists
		.filter(a => a.imageUrl)
		.filter(a => !progress.artists[a.id] || !SKIP_EXISTING)
		.slice(0, LIMIT || Infinity);

	console.log(`  ${toDownload.length} to download (${artists.filter(a => progress.artists[a.id]).length} already done)\n`);

	let downloaded = 0;
	let failed = 0;

	for (const artist of toDownload) {
		const filename = `${artist.id}.webp`;
		const outputPath = path.join(ARTISTS_DIR, filename);

		// Skip if exists and not forcing
		if (SKIP_EXISTING && fs.existsSync(outputPath)) {
			progress.artists[artist.id] = `/artists/${filename}`;
			continue;
		}

		process.stdout.write(`  [${downloaded + failed + 1}/${toDownload.length}] ${artist.name}...`);

		const success = await downloadImage(artist.imageUrl, outputPath);

		if (success) {
			progress.artists[artist.id] = `/artists/${filename}`;
			downloaded++;
			console.log(' ✓');
		} else {
			failed++;
			console.log(' ✗');
		}

		// Save progress periodically
		if ((downloaded + failed) % BATCH_SIZE === 0) {
			saveProgress(progress);
		}

		await sleep(RATE_LIMIT_MS);
	}

	saveProgress(progress);
	console.log(`\n  Downloaded: ${downloaded}, Failed: ${failed}`);
	return progress;
};

// Update catalog with local paths
const updateCatalog = (catalog, progress) => {
	console.log('\nUpdating catalog with local paths...');

	let albumsUpdated = 0;
	let artistsUpdated = 0;

	for (const album of catalog.albums) {
		if (progress.albums[album.id]) {
			album.localThumb = progress.albums[album.id];
			albumsUpdated++;
		}
	}

	for (const artist of catalog.artists) {
		if (progress.artists[artist.id]) {
			artist.localImage = progress.artists[artist.id];
			artistsUpdated++;
		}
	}

	console.log(`  Albums updated: ${albumsUpdated}`);
	console.log(`  Artists updated: ${artistsUpdated}`);

	return catalog;
};

// Main
const main = async () => {
	// Ensure directories exist
	fs.mkdirSync(COVERS_DIR, { recursive: true });
	fs.mkdirSync(ARTISTS_DIR, { recursive: true });
	fs.mkdirSync(path.dirname(PROGRESS_FILE), { recursive: true });

	// Load catalog
	const catalog = JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'));
	console.log(`Loaded catalog: ${catalog.albums.length} albums, ${catalog.artists.length} artists`);

	// Load progress
	let progress = loadProgress();

	// Download images
	if (!ARTISTS_ONLY) {
		progress = await downloadAlbumCovers(catalog.albums, progress);
	}

	if (!ALBUMS_ONLY) {
		progress = await downloadArtistImages(catalog.artists, progress);
	}

	// Update catalog with local paths
	const updatedCatalog = updateCatalog(catalog, progress);

	// Save updated catalog
	fs.writeFileSync(DATA_PATH, JSON.stringify(updatedCatalog, null, 2));

	// Summary
	const coverFiles = fs.readdirSync(COVERS_DIR).filter(f => f.endsWith('.webp'));
	const artistFiles = fs.readdirSync(ARTISTS_DIR).filter(f => f.endsWith('.webp'));

	console.log('\n✓ Done!');
	console.log(`  Album covers: ${coverFiles.length} files`);
	console.log(`  Artist images: ${artistFiles.length} files`);

	// Calculate total size
	const coverSize = coverFiles.reduce((sum, f) =>
		sum + fs.statSync(path.join(COVERS_DIR, f)).size, 0);
	const artistSize = artistFiles.reduce((sum, f) =>
		sum + fs.statSync(path.join(ARTISTS_DIR, f)).size, 0);

	console.log(`  Total size: ${((coverSize + artistSize) / 1024 / 1024).toFixed(1)} MB`);
};

main().catch(console.error);
