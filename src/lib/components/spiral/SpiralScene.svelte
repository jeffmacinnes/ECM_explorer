<script>
	import { onMount, onDestroy, createEventDispatcher } from 'svelte';
	import * as THREE from 'three';
	import { createTextureManager, TILE_UV, TILES_PER_ROW } from './spiralTextures.js';

	export let albums = [];

	const dispatch = createEventDispatcher();

	let canvas;
	let renderer, scene, camera;
	let instancedMesh;
	let rafId;
	let texManager;
	let lastActiveIdx = -1;
	let isInitialized = false;
	let pendingAlbums = null;
	let buildVersion = 0;

	// Scroll state
	let currentCenter = 0;
	let targetCenter = 0;
	let velocity = 0;
	let prevVisStart = 0;
	let prevVisEnd = -1;

	const LERP_SPEED = 0.12;
	const SCROLL_SENSITIVITY = 0.012;

	// V1 spiral constants
	const ANGLE_STEP = 0.4;
	const RADIUS = 700;
	const Y_STEP = 70;
	const MAX_ROTATE = 75;
	const CARD_SIZE = 450;
	const VISIBLE_HALF = 40;
	const CSS_PERSPECTIVE = 1200;

	// Hi-res overlay: individual meshes for nearby albums
	const HIRES_HALF = 12;
	const HIRES_COUNT = HIRES_HALF * 2 + 1;

	const DEG2RAD = Math.PI / 180;

	// Deterministic noise — returns -1..1, unique per seed
	const noise = (i, seed = 0) =>
		Math.sin((i + seed) * 127.1 + Math.cos((i + seed) * 311.7) * 43758.5453) % 1;

	// Named seeds for each noise channel used in transforms
	const SEED_ANGLE = 0;
	const SEED_RADIUS = 1000;
	const SEED_Y = 2000;
	const SEED_TILT_X = 3000;
	const SEED_TILT_Y = 4000;

	const _dummy = new THREE.Object3D();
	const _euler = new THREE.Euler();
	const _hiddenMatrix = new THREE.Matrix4();

	let opacityAttr;

	let hiresPool = [];
	let hiresGeo;

	let xCenter = 0;

	const FOG_NEAR = 900;
	const FOG_FAR = 3800;

	// Sort transition state
	const TRANSITION_MS = 1400;
	let isTransitioning = false;
	let transitionStart = 0;
	let transitionMap = null;
	let oldCenter = 0;
	let newCenter = 0;
	let oldAlbumOrder = [];
	let pendingNewAlbums = null;
	let skipTransitionCheck = false;

	const atlasVertexShader = `
		attribute vec3 instanceUvOffset;
		attribute float instanceOpacity;
		varying vec2 vUv;
		varying vec2 vLocalUv;
		varying float vOpacity;
		varying float vFogDepth;

		void main() {
			vec2 localUv = vec2(uv.x, 1.0 - uv.y);
			vLocalUv = localUv;
			vUv = instanceUvOffset.xy + localUv * instanceUvOffset.z;
			vOpacity = instanceOpacity;
			vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
			vFogDepth = -mvPosition.z;
			gl_Position = projectionMatrix * mvPosition;
		}
	`;

	const atlasFragmentShader = `
		uniform sampler2D atlas;
		uniform float fogNear;
		uniform float fogFar;
		varying vec2 vUv;
		varying vec2 vLocalUv;
		varying float vOpacity;
		varying float vFogDepth;

		void main() {
			vec3 texColor = texture2D(atlas, vUv).rgb;
			float bw = 0.005;
			float border = smoothstep(0.0, bw, vLocalUv.x)
			             * smoothstep(0.0, bw, 1.0 - vLocalUv.x)
			             * smoothstep(0.0, bw, vLocalUv.y)
			             * smoothstep(0.0, bw, 1.0 - vLocalUv.y);
			vec3 faceColor = mix(vec3(0.0), texColor, border);
			vec3 color = mix(vec3(1.0), faceColor, vOpacity);
			float fogFactor = smoothstep(fogNear, fogFar, vFogDepth);
			gl_FragColor = vec4(mix(color, vec3(1.0), fogFactor), 1.0);
		}
	`;

	const hiresVertexShader = `
		varying vec2 vUv;
		varying float vFogDepth;

		void main() {
			vUv = uv;
			vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
			vFogDepth = -mvPosition.z;
			gl_Position = projectionMatrix * mvPosition;
		}
	`;

	const hiresFragmentShader = `
		uniform sampler2D map;
		uniform float opacity;
		uniform float fogNear;
		uniform float fogFar;
		varying vec2 vUv;
		varying float vFogDepth;

		void main() {
			vec3 texColor = texture2D(map, vUv).rgb;
			float bw = 0.005;
			float border = smoothstep(0.0, bw, vUv.x)
			             * smoothstep(0.0, bw, 1.0 - vUv.x)
			             * smoothstep(0.0, bw, vUv.y)
			             * smoothstep(0.0, bw, 1.0 - vUv.y);
			vec3 faceColor = mix(vec3(0.0), texColor, border);
			vec3 color = mix(vec3(1.0), faceColor, opacity);
			float fogFactor = smoothstep(fogNear, fogFar, vFogDepth);
			gl_FragColor = vec4(mix(color, vec3(1.0), fogFactor), 1.0);
		}
	`;

	// Precompute hidden matrix once
	_dummy.position.set(0, -99999, 0);
	_dummy.scale.setScalar(0.001);
	_dummy.updateMatrix();
	_hiddenMatrix.copy(_dummy.matrix);

	const hideInstance = (i) => {
		instancedMesh.setMatrixAt(i, _hiddenMatrix);
		opacityAttr.array[i] = 0;
	};

	const computeSpiralTransform = (i, d) => {
		const absD = Math.abs(d);

		const jitterStrength = Math.min(1, absD / 3);
		const angleJitter = noise(i, SEED_ANGLE) * 0.35 * jitterStrength;
		const radiusJitter =
			(noise(i, SEED_RADIUS) * 120 + noise(i, SEED_TILT_X) * 60) * jitterStrength;
		const yJitter = (noise(i, SEED_Y) * 35 + noise(i, SEED_TILT_Y) * 20) * jitterStrength;

		const angle = d * ANGLE_STEP + angleJitter;
		const r = RADIUS + radiusJitter;

		const x = r * Math.sin(angle);
		const z = r * Math.cos(angle) - r;
		const y = -(d * Y_STEP + yJitter);

		const rawRotate = -(angle * 180) / Math.PI;
		const rotateYDeg = Math.max(-MAX_ROTATE, Math.min(MAX_ROTATE, rawRotate));
		const rotateXDeg = Math.min(absD, 10) * 4.0 * jitterStrength;

		const scale = (0.9 + 2.0 * Math.exp(-absD * absD * 2.5)) / 3;
		const opacity = 0.12 + 0.88 * Math.exp(-absD * 0.12);

		return { x, y, z, rotateXDeg, rotateYDeg, scale, opacity };
	};

	const init = () => {
		const w = canvas.clientWidth;
		const h = canvas.clientHeight;
		const dpr = Math.min(window.devicePixelRatio, 2);

		renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
		renderer.setPixelRatio(dpr);
		renderer.setSize(w, h);
		renderer.setClearColor(0xffffff, 1);
		renderer.toneMapping = THREE.NoToneMapping;

		scene = new THREE.Scene();

		const fov = 2 * Math.atan(h / 2 / CSS_PERSPECTIVE) * (180 / Math.PI);
		camera = new THREE.PerspectiveCamera(fov, w / h, 1, 8000);

		xCenter = w * -0.15;
		camera.position.set(xCenter, 0, CSS_PERSPECTIVE);
		camera.lookAt(xCenter, 0, 0);

		hiresGeo = new THREE.PlaneGeometry(CARD_SIZE, CARD_SIZE);
		for (let i = 0; i < HIRES_COUNT; i++) {
			const mat = new THREE.ShaderMaterial({
				vertexShader: hiresVertexShader,
				fragmentShader: hiresFragmentShader,
				uniforms: {
					map: { value: null },
					opacity: { value: 1.0 },
					fogNear: { value: FOG_NEAR },
					fogFar: { value: FOG_FAR }
				},
				side: THREE.DoubleSide,
				depthTest: true,
				depthWrite: true,
				transparent: false
			});
			const mesh = new THREE.Mesh(hiresGeo, mat);
			mesh.visible = false;
			mesh.renderOrder = 1;
			scene.add(mesh);
			hiresPool.push({ mesh, mat, albumId: null });
		}

		isInitialized = true;

		if (pendingAlbums) {
			buildMesh(pendingAlbums);
			pendingAlbums = null;
		}
	};

	const buildMesh = async (albumList) => {
		if (!albumList.length) return;
		if (!isInitialized) {
			pendingAlbums = albumList;
			return;
		}
		if (isTransitioning) return;

		if (!skipTransitionCheck && instancedMesh && oldAlbumOrder.length === albumList.length) {
			const orderChanged = albumList.some((a, i) => a.id !== oldAlbumOrder[i]?.id);
			if (orderChanged) {
				startTransition(albumList);
				return;
			}
		}
		skipTransitionCheck = false;

		const version = ++buildVersion;
		const count = albumList.length;

		if (instancedMesh) {
			scene.remove(instancedMesh);
			instancedMesh.geometry.dispose();
			instancedMesh.material.dispose();
			instancedMesh = null;
		}

		for (const slot of hiresPool) {
			slot.mesh.visible = false;
			slot.albumId = null;
		}

		if (texManager) texManager.dispose();
		texManager = createTextureManager(albumList);

		const [atlasTexture] = await Promise.all([texManager.loadAtlas(), texManager.loadUVMap()]);

		if (version !== buildVersion) return;

		const geometry = new THREE.PlaneGeometry(CARD_SIZE, CARD_SIZE);

		const uvOffsets = new Float32Array(count * 3);
		for (let i = 0; i < count; i++) {
			const uv = texManager.getAtlasUV(albumList[i].id);
			if (uv) {
				uvOffsets[i * 3] = uv.u;
				uvOffsets[i * 3 + 1] = uv.v;
				uvOffsets[i * 3 + 2] = uv.size;
			} else {
				uvOffsets[i * 3] = (TILES_PER_ROW - 1) / TILES_PER_ROW;
				uvOffsets[i * 3 + 1] = (TILES_PER_ROW - 1) / TILES_PER_ROW;
				uvOffsets[i * 3 + 2] = TILE_UV;
			}
		}

		geometry.setAttribute('instanceUvOffset', new THREE.InstancedBufferAttribute(uvOffsets, 3));

		const opacities = new Float32Array(count);
		opacityAttr = new THREE.InstancedBufferAttribute(opacities, 1);
		opacityAttr.setUsage(THREE.DynamicDrawUsage);
		geometry.setAttribute('instanceOpacity', opacityAttr);

		const material = new THREE.ShaderMaterial({
			vertexShader: atlasVertexShader,
			fragmentShader: atlasFragmentShader,
			uniforms: {
				atlas: { value: atlasTexture },
				fogNear: { value: FOG_NEAR },
				fogFar: { value: FOG_FAR }
			},
			side: THREE.DoubleSide,
			depthTest: true,
			depthWrite: true,
			transparent: false
		});

		instancedMesh = new THREE.InstancedMesh(geometry, material, count);
		instancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
		instancedMesh.renderOrder = 0;

		for (let i = 0; i < count; i++) {
			instancedMesh.setMatrixAt(i, _hiddenMatrix);
		}

		instancedMesh.instanceMatrix.needsUpdate = true;
		scene.add(instancedMesh);

		prevVisStart = 0;
		prevVisEnd = -1;
		lastActiveIdx = -1;
		oldAlbumOrder = [...albumList];

		dispatch('ready');
	};

	const updateTransforms = () => {
		if (!instancedMesh || !albums.length) return;

		const count = albums.length;
		const start = Math.max(0, Math.floor(currentCenter) - VISIBLE_HALF);
		const end = Math.min(count - 1, Math.ceil(currentCenter) + VISIBLE_HALF);

		const hiStart = Math.max(0, Math.floor(currentCenter) - HIRES_HALF);
		const hiEnd = Math.min(count - 1, Math.ceil(currentCenter) + HIRES_HALF);

		let slotIdx = 0;

		for (let i = prevVisStart; i < start; i++) hideInstance(i);
		for (let i = end + 1; i <= prevVisEnd; i++) hideInstance(i);

		for (let i = start; i <= end; i++) {
			const d = i - currentCenter;
			const t = computeSpiralTransform(i, d);

			const inHiresRange = i >= hiStart && i <= hiEnd;
			const albumId = albums[i]?.id;
			const hiresTex = inHiresRange ? texManager?.getTexture(albumId) : null;

			if (hiresTex && slotIdx < HIRES_COUNT) {
				hideInstance(i);

				const slot = hiresPool[slotIdx];
				const mesh = slot.mesh;

				_dummy.position.set(t.x, t.y, t.z);
				_euler.set(-t.rotateXDeg * DEG2RAD, t.rotateYDeg * DEG2RAD, 0, 'XYZ');
				_dummy.quaternion.setFromEuler(_euler);
				_dummy.scale.setScalar(t.scale);
				_dummy.updateMatrix();

				mesh.position.copy(_dummy.position);
				mesh.quaternion.copy(_dummy.quaternion);
				mesh.scale.copy(_dummy.scale);

				if (slot.albumId !== albumId) {
					slot.mat.uniforms.map.value = hiresTex;
					slot.albumId = albumId;
				}
				slot.mat.uniforms.opacity.value = t.opacity;
				mesh.visible = true;
				slotIdx++;
			} else {
				_dummy.position.set(t.x, t.y, t.z);
				_euler.set(-t.rotateXDeg * DEG2RAD, t.rotateYDeg * DEG2RAD, 0, 'XYZ');
				_dummy.quaternion.setFromEuler(_euler);
				_dummy.scale.setScalar(t.scale);
				_dummy.updateMatrix();
				instancedMesh.setMatrixAt(i, _dummy.matrix);
				opacityAttr.array[i] = t.opacity;
			}
		}

		for (let i = slotIdx; i < HIRES_COUNT; i++) {
			hiresPool[i].mesh.visible = false;
		}

		prevVisStart = start;
		prevVisEnd = end;

		instancedMesh.instanceMatrix.needsUpdate = true;
		opacityAttr.needsUpdate = true;

		const activeIdx = Math.round(currentCenter);
		const clampedIdx = Math.max(0, Math.min(count - 1, activeIdx));

		if (clampedIdx !== lastActiveIdx) {
			lastActiveIdx = clampedIdx;
			texManager?.updateNearby(clampedIdx);
		}
	};

	const startTransition = (newAlbums) => {
		const newIdxMap = new Map();
		newAlbums.forEach((a, i) => newIdxMap.set(a.id, i));

		oldCenter = currentCenter;
		newCenter = 0;

		transitionMap = new Map();
		oldAlbumOrder.forEach((a, oldIdx) => {
			const newIdx = newIdxMap.get(a.id);
			if (newIdx !== undefined) {
				transitionMap.set(a.id, { oldIdx, newIdx });
			}
		});

		pendingNewAlbums = newAlbums;
		isTransitioning = true;
		transitionStart = performance.now();
	};

	const EXPLODE_DIST = 1800;
	const EXPLODE_PHASE = 0.35;

	const updateTransitionTransforms = () => {
		if (!instancedMesh) return;

		const elapsed = performance.now() - transitionStart;
		const rawT = Math.min(1, elapsed / TRANSITION_MS);
		const count = oldAlbumOrder.length;

		for (let i = 0; i < count; i++) {
			const album = oldAlbumOrder[i];
			const mapping = transitionMap.get(album.id);

			if (!mapping) {
				hideInstance(i);
				continue;
			}

			const { oldIdx, newIdx } = mapping;
			const oldD = oldIdx - oldCenter;
			const newD = newIdx - newCenter;

			if (Math.abs(oldD) > VISIBLE_HALF + 5 && Math.abs(newD) > VISIBLE_HALF + 5) {
				hideInstance(i);
				continue;
			}

			const from = computeSpiralTransform(oldIdx, oldD);
			const to = computeSpiralTransform(newIdx, newD);

			let x, y, z, rx, ry, sc, op;

			if (rawT < EXPLODE_PHASE) {
				const pt = rawT / EXPLODE_PHASE;
				const e = 1 - Math.pow(1 - pt, 2);

				const angle = oldIdx * 2.399 + noise(oldIdx, SEED_ANGLE) * 0.5;
				const dirX = Math.cos(angle);
				const dirY = Math.sin(angle);

				x = from.x + dirX * EXPLODE_DIST * e;
				y = from.y + dirY * EXPLODE_DIST * e;
				z = from.z - 300 * e * (0.5 + Math.abs(noise(oldIdx, SEED_Y)));
				rx = from.rotateXDeg + e * noise(oldIdx, SEED_TILT_X) * 40;
				ry = from.rotateYDeg + e * noise(oldIdx, SEED_TILT_Y) * 60;
				sc = from.scale * (1 - e * 0.6);
				op = from.opacity * (1 - e);
			} else {
				const pt = (rawT - EXPLODE_PHASE) / (1 - EXPLODE_PHASE);
				const e = 1 - Math.pow(1 - pt, 3);

				const angle = newIdx * 2.399 + noise(newIdx, SEED_ANGLE) * 0.5;
				const dirX = Math.cos(angle);
				const dirY = Math.sin(angle);

				const startX = to.x + dirX * EXPLODE_DIST;
				const startY = to.y + dirY * EXPLODE_DIST;
				const startZ = to.z - 300 * (0.5 + Math.abs(noise(newIdx, SEED_Y)));

				x = startX + (to.x - startX) * e;
				y = startY + (to.y - startY) * e;
				z = startZ + (to.z - startZ) * e;
				rx = to.rotateXDeg * e;
				ry = to.rotateYDeg + (1 - e) * noise(newIdx, SEED_TILT_Y) * 60;
				sc = to.scale * (0.4 + 0.6 * e);
				op = to.opacity * e;
			}

			_dummy.position.set(x, y, z);
			_euler.set(-rx * DEG2RAD, ry * DEG2RAD, 0, 'XYZ');
			_dummy.quaternion.setFromEuler(_euler);
			_dummy.scale.setScalar(sc);
			_dummy.updateMatrix();
			instancedMesh.setMatrixAt(i, _dummy.matrix);
			opacityAttr.array[i] = op;
		}

		instancedMesh.instanceMatrix.needsUpdate = true;
		opacityAttr.needsUpdate = true;

		for (const slot of hiresPool) {
			slot.mesh.visible = false;
		}

		if (rawT >= 1) {
			isTransitioning = false;
			currentCenter = newCenter;
			targetCenter = newCenter;
			skipTransitionCheck = true;
			buildMesh(pendingNewAlbums);
			pendingNewAlbums = null;
		}
	};

	const animate = () => {
		rafId = requestAnimationFrame(animate);
		if (!instancedMesh) return;

		if (isTransitioning) {
			updateTransitionTransforms();
			renderer.render(scene, camera);
			return;
		}

		const diff = targetCenter - currentCenter;
		if (Math.abs(diff) > 0.001) {
			currentCenter += diff * LERP_SPEED;
		} else {
			currentCenter = targetCenter;
		}

		if (Math.abs(velocity) < 0.01) {
			const nearest = Math.round(currentCenter);
			const snapDiff = nearest - targetCenter;
			if (Math.abs(snapDiff) > 0.001) {
				targetCenter += snapDiff * 0.05;
			}
		}

		velocity *= 0.92;

		updateTransforms();
		renderer.render(scene, camera);

		const idx = Math.max(0, Math.min(albums.length - 1, Math.round(currentCenter)));
		if (albums[idx]) {
			dispatch('activeAlbum', albums[idx]);
		}
	};

	const handleWheel = (e) => {
		e.preventDefault();
		velocity = e.deltaY * SCROLL_SENSITIVITY;
		targetCenter = Math.max(0, Math.min(albums.length - 1, targetCenter + velocity));
	};

	const handleKeydown = (e) => {
		if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
			e.preventDefault();
			targetCenter = Math.min(albums.length - 1, Math.round(currentCenter) + 1);
		} else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
			e.preventDefault();
			targetCenter = Math.max(0, Math.round(currentCenter) - 1);
		}
	};

	const handleResize = () => {
		if (!renderer || !canvas) return;
		const w = canvas.clientWidth;
		const h = canvas.clientHeight;
		renderer.setSize(w, h);

		const fov = 2 * Math.atan(h / 2 / CSS_PERSPECTIVE) * (180 / Math.PI);
		xCenter = w * -0.15;
		camera.fov = fov;
		camera.aspect = w / h;
		camera.position.set(xCenter, 0, CSS_PERSPECTIVE);
		camera.lookAt(xCenter, 0, 0);
		camera.updateProjectionMatrix();
	};

	onMount(() => {
		init();
		animate();
		window.addEventListener('resize', handleResize);
	});

	onDestroy(() => {
		if (rafId) cancelAnimationFrame(rafId);
		window.removeEventListener('resize', handleResize);
		renderer?.dispose();
		texManager?.dispose();
		if (instancedMesh) {
			instancedMesh.geometry.dispose();
			instancedMesh.material.dispose();
		}
		for (const slot of hiresPool) {
			slot.mat.dispose();
		}
		hiresGeo?.dispose();
	});

	$: if (isInitialized && albums.length > 0) {
		buildMesh(albums);
	}

	export const navigateTo = (index) => {
		targetCenter = Math.max(0, Math.min(albums.length - 1, index));
	};

	export const resetScroll = () => {
		targetCenter = 0;
		currentCenter = 0;
	};
</script>

<canvas
	bind:this={canvas}
	class="spiral-canvas"
	on:wheel={handleWheel}
	on:keydown={handleKeydown}
	tabindex="0"
></canvas>

<style lang="scss">
	.spiral-canvas {
		width: 100%;
		height: 100%;
		display: block;
		outline: none;
	}
</style>
