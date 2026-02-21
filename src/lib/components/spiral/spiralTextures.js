import * as THREE from 'three';

const TILE_SIZE = 64;
const ATLAS_SIZE = 4096;
const TILES_PER_ROW = ATLAS_SIZE / TILE_SIZE;
const TILE_UV = 1 / TILES_PER_ROW;

const NEARBY_RANGE = 14;

const createTextureManager = (albums) => {
	const loader = new THREE.TextureLoader();
	let atlasTexture = null;
	let uvMap = null;

	const mediumCache = new Map();

	const loadAtlas = () => new Promise((resolve, reject) => {
		const img = new Image();
		img.crossOrigin = 'anonymous';
		img.onload = () => {
			const tex = new THREE.Texture(img);
			tex.flipY = false;
			tex.generateMipmaps = true;
			tex.minFilter = THREE.LinearMipmapLinearFilter;
			tex.magFilter = THREE.LinearFilter;
			tex.colorSpace = THREE.NoColorSpace;
			tex.needsUpdate = true;
			atlasTexture = tex;
			resolve(tex);
		};
		img.onerror = reject;
		img.src = '/covers/atlas.webp';
	});

	const loadUVMap = async () => {
		const res = await fetch('/data/atlas-uv-map.json');
		uvMap = await res.json();
		return uvMap;
	};

	const getAtlasUV = (albumId) => {
		if (!uvMap || !uvMap[albumId]) return null;
		const { u, v } = uvMap[albumId];
		return { u, v, size: TILE_UV };
	};

	const loadMedium = (albumId) => {
		if (mediumCache.has(albumId)) return mediumCache.get(albumId);

		const album = albums.find(a => a.id === albumId);
		if (!album?.localThumb) return null;

		const promise = new Promise((resolve) => {
			loader.load(album.localThumb, (tex) => {
				tex.generateMipmaps = true;
				tex.minFilter = THREE.LinearMipmapLinearFilter;
				tex.magFilter = THREE.LinearFilter;
				tex.colorSpace = THREE.NoColorSpace;
				mediumCache.set(albumId, tex);
				resolve(tex);
			}, undefined, () => resolve(null));
		});

		mediumCache.set(albumId, promise);
		return promise;
	};

	const updateNearby = (activeIdx) => {
		const start = Math.max(0, activeIdx - NEARBY_RANGE);
		const end = Math.min(albums.length - 1, activeIdx + NEARBY_RANGE);

		for (let i = start; i <= end; i++) {
			loadMedium(albums[i].id);
		}

		for (const [id, tex] of mediumCache) {
			const idx = albums.findIndex(a => a.id === id);
			if (idx < start || idx > end) {
				if (tex instanceof THREE.Texture) tex.dispose();
				mediumCache.delete(id);
			}
		}
	};

	const getTexture = (albumId) => {
		const cached = mediumCache.get(albumId);
		return cached instanceof THREE.Texture ? cached : null;
	};

	const dispose = () => {
		atlasTexture?.dispose();
		for (const [, tex] of mediumCache) {
			if (tex instanceof THREE.Texture) tex.dispose();
		}
		mediumCache.clear();
	};

	return {
		loadAtlas,
		loadUVMap,
		getAtlasUV,
		updateNearby,
		getTexture,
		dispose
	};
};

export { createTextureManager, TILE_UV, TILES_PER_ROW };
