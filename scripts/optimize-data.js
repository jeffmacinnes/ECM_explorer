import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '../src/lib/data');
const STATIC_DIR = path.join(__dirname, '../static/data');
const CATALOG_PATH = path.join(DATA_DIR, 'ecm-catalog.json');

const main = () => {
	console.log('Loading catalog...\n');
	const catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf-8'));

	console.log(`  Albums: ${catalog.albums.length}`);
	console.log(`  Artists: ${catalog.artists.length}`);
	console.log(`  Credits: ${catalog.credits.length}`);

	// 1. Create minimal index for album grid
	// Just enough to render the grid and basic filtering
	console.log('\nCreating catalog-index.json...');
	const catalogIndex = {
		albums: catalog.albums.map(album => ({
			id: album.id,
			catalogNumber: album.catalogNumber,
			series: album.series,
			artist: album.artist,
			title: album.title,
			year: album.year,
			localThumb: album.localThumb || null,
			genres: album.genres || [],
			styles: album.styles || [],
			community: album.community || null,
			reviewUrl: album.reviewUrl || null,
			discogsUrl: album.discogsUrl || null,
			deezerId: album.deezerId || null
		})),
		meta: {
			totalAlbums: catalog.albums.length,
			totalArtists: catalog.artists.length,
			generatedAt: new Date().toISOString()
		}
	};

	// 2. Create full album details (keyed by ID for quick lookup)
	console.log('Creating albums-detail.json...');
	const albumsDetail = {};
	for (const album of catalog.albums) {
		albumsDetail[album.id] = {
			...album,
			tracklist: album.tracklist || [],
			credits: catalog.credits
				.filter(c => c.albumId === album.id)
				.map(c => ({
					artistId: c.artistId,
					role: c.role
				}))
		};
	}

	// 3. Create full artist details (keyed by ID)
	console.log('Creating artists-detail.json...');
	const artistsDetail = {};
	for (const artist of catalog.artists) {
		// Find all albums this artist appears on
		const artistCredits = catalog.credits.filter(c => c.artistId === artist.id);
		const albumIds = [...new Set(artistCredits.map(c => c.albumId))];

		artistsDetail[artist.id] = {
			...artist,
			albumCount: albumIds.length,
			albums: artistCredits.map(c => ({
				albumId: c.albumId,
				role: c.role
			}))
		};
	}

	// 4. Create graph data (nodes + edges for network visualization)
	console.log('Creating graph-data.json...');
	const graphData = {
		nodes: [
			// Album nodes
			...catalog.albums.map(album => ({
				id: album.id,
				type: 'album',
				label: album.title,
				artist: album.artist,
				year: album.year,
				series: album.series,
				localThumb: album.localThumb || null
			})),
			// Artist nodes
			...catalog.artists.map(artist => ({
				id: artist.id,
				type: 'artist',
				label: artist.name,
				localImage: artist.localImage || null,
				albumCount: catalog.credits.filter(c => c.artistId === artist.id)
					.map(c => c.albumId)
					.filter((v, i, a) => a.indexOf(v) === i).length
			}))
		],
		edges: catalog.credits.map(credit => ({
			source: credit.albumId,
			target: credit.artistId,
			role: credit.role
		})),
		meta: {
			nodeCount: catalog.albums.length + catalog.artists.length,
			edgeCount: catalog.credits.length
		}
	};

	// 5. Create artist index for quick lookups and autocomplete
	console.log('Creating artists-index.json...');
	const artistsIndex = catalog.artists.map(artist => ({
		id: artist.id,
		name: artist.name,
		localImage: artist.localImage || null,
		albumCount: catalog.credits.filter(c => c.artistId === artist.id)
			.map(c => c.albumId)
			.filter((v, i, a) => a.indexOf(v) === i).length
	}));

	// 6. Create standalone credits array (lightweight, for startup load)
	console.log('Creating credits.json...');
	const creditsData = catalog.credits.map(c => ({
		albumId: c.albumId,
		artistId: c.artistId,
		role: c.role
	}));

	// Write split files to static/data (served by Vite)
	fs.mkdirSync(STATIC_DIR, { recursive: true });

	const staticFiles = [
		{ name: 'catalog-index.json', data: catalogIndex },
		{ name: 'albums-detail.json', data: albumsDetail },
		{ name: 'artists-detail.json', data: artistsDetail },
		{ name: 'artists-index.json', data: artistsIndex },
		{ name: 'graph-data.json', data: graphData },
		{ name: 'credits.json', data: creditsData }
	];

	console.log('\nWriting files...\n');

	let totalSize = 0;
	for (const file of staticFiles) {
		const filePath = path.join(STATIC_DIR, file.name);
		const content = JSON.stringify(file.data);
		fs.writeFileSync(filePath, content);
		const size = Buffer.byteLength(content, 'utf8');
		totalSize += size;
		console.log(`  ${file.name}: ${(size / 1024).toFixed(1)} KB`);
	}

	console.log(`\n  Total: ${(totalSize / 1024).toFixed(1)} KB`);

	// Compare to original
	const originalSize = fs.statSync(CATALOG_PATH).size;
	console.log(`  Original ecm-catalog.json: ${(originalSize / 1024).toFixed(1)} KB`);
	const creditsSize = Buffer.byteLength(JSON.stringify(creditsData), 'utf8');
	console.log(`\nInitial load (catalog-index + artists-index + credits): ${((Buffer.byteLength(JSON.stringify(catalogIndex), 'utf8') + Buffer.byteLength(JSON.stringify(artistsIndex), 'utf8') + creditsSize) / 1024).toFixed(1)} KB`);

	console.log('\n✓ Done!');
};

main();
