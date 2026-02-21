import sharp from 'sharp';
import { readFileSync, existsSync, writeFileSync } from 'fs';
import { resolve, join } from 'path';

const TILE_SIZE = 64;
const ATLAS_SIZE = 4096;
const TILES_PER_ROW = ATLAS_SIZE / TILE_SIZE; // 64
const MAX_TILES = TILES_PER_ROW * TILES_PER_ROW; // 4096

const COVERS_DIR = resolve('static/covers');
const OUTPUT_PATH = resolve('static/covers/atlas.webp');
const UV_MAP_PATH = resolve('static/data/atlas-uv-map.json');

const catalog = JSON.parse(readFileSync(resolve('src/lib/data/catalog-index.json'), 'utf-8'));

const run = async () => {
	const albums = catalog.albums;
	console.log(`Building atlas for ${albums.length} albums (${TILE_SIZE}px tiles, ${ATLAS_SIZE}x${ATLAS_SIZE})`);

	if (albums.length > MAX_TILES) {
		console.error(`Too many albums (${albums.length}) for atlas size (max ${MAX_TILES})`);
		process.exit(1);
	}

	// Build composite operations
	const composites = [];
	const uvMap = {};
	let placed = 0;

	for (let i = 0; i < albums.length; i++) {
		const album = albums[i];
		const coverPath = join(COVERS_DIR, `${album.id}.webp`);

		if (!existsSync(coverPath)) continue;

		const col = placed % TILES_PER_ROW;
		const row = Math.floor(placed / TILES_PER_ROW);
		const x = col * TILE_SIZE;
		const y = row * TILE_SIZE;

		try {
			const resized = await sharp(coverPath)
				.resize(TILE_SIZE, TILE_SIZE, { fit: 'cover' })
				.toBuffer();

			composites.push({ input: resized, left: x, top: y });

			// Store UV coordinates (normalized 0-1)
			uvMap[album.id] = {
				u: col / TILES_PER_ROW,
				v: row / TILES_PER_ROW,
				index: placed
			};

			placed++;
		} catch (err) {
			console.warn(`Skipping ${album.id}: ${err.message}`);
		}

		if ((i + 1) % 200 === 0) {
			console.log(`  Processed ${i + 1}/${albums.length}...`);
		}
	}

	console.log(`Compositing ${placed} tiles into atlas...`);

	// Create blank atlas and composite all tiles
	const atlas = sharp({
		create: {
			width: ATLAS_SIZE,
			height: ATLAS_SIZE,
			channels: 3,
			background: { r: 242, g: 242, b: 242 }
		}
	});

	const result = await atlas
		.composite(composites)
		.webp({ quality: 75 })
		.toBuffer();

	writeFileSync(OUTPUT_PATH, result);
	writeFileSync(UV_MAP_PATH, JSON.stringify(uvMap));

	const sizeMB = (result.length / 1024 / 1024).toFixed(1);
	console.log(`Atlas saved: ${OUTPUT_PATH} (${sizeMB} MB, ${placed} tiles)`);
	console.log(`UV map saved: ${UV_MAP_PATH}`);
};

run().catch(console.error);
