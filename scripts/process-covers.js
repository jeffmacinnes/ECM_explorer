import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_PATH = path.join(__dirname, '../src/lib/data/ecm-catalog.json');
const ORIGINALS_DIR = path.join(__dirname, '../data/covers-original');
const OUTPUT_DIR = path.join(__dirname, '../static/covers');

// Defaults — override with flags
const args = process.argv.slice(2);
const sizeIndex = args.indexOf('--size');
const SIZE = sizeIndex !== -1 ? parseInt(args[sizeIndex + 1], 10) : 500;
const qualityIndex = args.indexOf('--quality');
const QUALITY = qualityIndex !== -1 ? parseInt(args[qualityIndex + 1], 10) : 90;
const FORCE = args.includes('--force');

const main = async () => {
	fs.mkdirSync(OUTPUT_DIR, { recursive: true });

	const catalog = JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'));

	// Find all original cover files
	const originals = fs.readdirSync(ORIGINALS_DIR);
	const originalsByAlbumId = new Map();
	for (const f of originals) {
		const albumId = f.replace(/\.(jpg|jpeg|png)$/i, '');
		originalsByAlbumId.set(albumId, f);
	}

	console.log(`Processing covers: ${SIZE}px, WebP q${QUALITY}`);
	console.log(`  Originals: ${originals.length}`);

	let processed = 0;
	let skipped = 0;
	let failed = 0;

	for (const album of catalog.albums) {
		const originalFile = originalsByAlbumId.get(album.id);
		if (!originalFile) continue;

		const outputFile = `${album.id}.webp`;
		const outputPath = path.join(OUTPUT_DIR, outputFile);

		// Skip if output exists and not forcing
		if (!FORCE && fs.existsSync(outputPath)) {
			album.localThumb = `/covers/${outputFile}`;
			skipped++;
			continue;
		}

		try {
			const inputPath = path.join(ORIGINALS_DIR, originalFile);
			await sharp(inputPath)
				.resize(SIZE, SIZE, { fit: 'cover' })
				.webp({ quality: QUALITY })
				.toFile(outputPath);

			album.localThumb = `/covers/${outputFile}`;
			processed++;
		} catch (err) {
			console.error(`  Error processing ${album.id}: ${err.message}`);
			failed++;
		}
	}

	// Clear localThumb for albums without originals
	let cleared = 0;
	for (const album of catalog.albums) {
		if (album.localThumb && !originalsByAlbumId.has(album.id)) {
			const outputPath = path.join(OUTPUT_DIR, `${album.id}.webp`);
			if (!fs.existsSync(outputPath)) {
				album.localThumb = undefined;
				cleared++;
			}
		}
	}

	// Save updated catalog
	fs.writeFileSync(DATA_PATH, JSON.stringify(catalog, null, 2));

	// Summary
	const outputFiles = fs.readdirSync(OUTPUT_DIR).filter(f => f.endsWith('.webp'));
	const totalSize = outputFiles.reduce((sum, f) =>
		sum + fs.statSync(path.join(OUTPUT_DIR, f)).size, 0);

	console.log(`\n✓ Done!`);
	console.log(`  Processed: ${processed}, Skipped: ${skipped}, Failed: ${failed}`);
	if (cleared) console.log(`  Cleared stale refs: ${cleared}`);
	console.log(`  Output: ${outputFiles.length} files (${(totalSize / 1024 / 1024).toFixed(1)} MB)`);
	console.log(`  Avg size: ${(totalSize / outputFiles.length / 1024).toFixed(0)} KB per cover`);
};

main().catch(console.error);
