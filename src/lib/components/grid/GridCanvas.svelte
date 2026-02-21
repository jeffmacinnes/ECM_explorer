<script>
	import { onMount } from 'svelte';
	import { createEventDispatcher } from 'svelte';
	import { computeGridLayout } from './gridLayout.js';

	export let yearGroups = [];

	const dispatch = createEventDispatcher();

	let canvas;
	let ctx;
	let containerEl;
	let animationId;

	let width = 0;
	let height = 0;
	let dpr = 1;
	let scrollY = 0;
	let targetScrollY = 0;

	let cells = [];
	let totalHeight = 0;

	let imageCache = new Map();
	const imgVersion = Date.now();
	let loadingImages = new Set();
	let hoveredCell = null;
	let mouseX = -1000;
	let mouseY = -1000;

	const SCROLL_EASE = 0.15;
	const HOVER_SCALE = 1.04;
	const FONT = 'Univers, Helvetica Neue, Helvetica, Arial, sans-serif';

	const recomputeLayout = () => {
		if (!width || !yearGroups?.length) return;
		const result = computeGridLayout(yearGroups, width);
		cells = result.cells;
		totalHeight = result.totalHeight;
		targetScrollY = Math.max(0, Math.min(totalHeight - height, targetScrollY));
	};

	$: if (yearGroups && width > 0) {
		recomputeLayout();
	}

	const truncateText = (text, maxWidth) => {
		if (!text) return '';
		if (ctx.measureText(text).width <= maxWidth) return text;
		let t = text;
		while (t.length > 0 && ctx.measureText(t + '…').width > maxWidth) {
			t = t.slice(0, -1);
		}
		return t + '…';
	};

	const loadImage = (src) => {
		if (imageCache.has(src) || loadingImages.has(src)) return;
		loadingImages.add(src);
		const img = new Image();
		img.onload = () => {
			imageCache.set(src, img);
			loadingImages.delete(src);
		};
		img.onerror = () => {
			loadingImages.delete(src);
		};
		img.src = src + '?v=' + imgVersion;
	};

	const hitTest = (mx, my) => {
		const worldY = my + scrollY;
		for (let i = cells.length - 1; i >= 0; i--) {
			const c = cells[i];
			if (c.type !== 'album') continue;
			if (mx >= c.x && mx < c.x + c.w && worldY >= c.y && worldY < c.y + c.h) {
				return c;
			}
		}
		return null;
	};

	const draw = () => {
		if (!ctx) return;

		const diff = targetScrollY - scrollY;
		scrollY += diff * SCROLL_EASE;

		ctx.fillStyle = '#ffffff';
		ctx.fillRect(0, 0, width * dpr, height * dpr);
		ctx.save();
		ctx.scale(dpr, dpr);
		ctx.imageSmoothingEnabled = true;
		ctx.imageSmoothingQuality = 'high';

		const visTop = scrollY - 200;
		const visBottom = scrollY + height + 200;

		hoveredCell = hitTest(mouseX, mouseY);

		// Pass 1: Year labels
		for (const cell of cells) {
			if (cell.type !== 'year') continue;
			if (cell.y + cell.h < visTop || cell.y > visBottom) continue;

			const sy = cell.y - scrollY;
			const fontSize = Math.min(cell.w * 0.42, 76);

			ctx.fillStyle = 'rgb(230, 230, 230)';
			ctx.font = `700 ${Math.round(fontSize)}px ${FONT}`;
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			ctx.fillText(cell.year, cell.x + cell.w / 2, sy + cell.h / 2 - fontSize * 0.08);

			ctx.fillStyle = 'rgb(200, 200, 200)';
			ctx.font = `400 ${Math.round(fontSize * 0.17)}px ${FONT}`;
			ctx.fillText(`${cell.count} albums`, cell.x + cell.w / 2, sy + cell.h / 2 + fontSize * 0.44);
		}

		// Pass 2: Album covers
		for (const cell of cells) {
			if (cell.type !== 'album') continue;
			if (cell.y + cell.h < visTop || cell.y > visBottom) continue;
			if (cell === hoveredCell) continue;

			const sy = cell.y - scrollY;
			const img = cell.album.localThumb ? imageCache.get(cell.album.localThumb) : null;
			if (!img && cell.album.localThumb) loadImage(cell.album.localThumb);

			if (img) {
				ctx.drawImage(img, cell.x, sy, cell.w, cell.h);
			} else {
				ctx.fillStyle = '#f0f0f0';
				ctx.fillRect(cell.x, sy, cell.w, cell.h);
			}
		}

		// Pass 3: Hovered album (drawn on top)
		if (hoveredCell) {
			const cell = hoveredCell;
			const sy = cell.y - scrollY;
			const img = cell.album.localThumb ? imageCache.get(cell.album.localThumb) : null;

			const cx = cell.x + cell.w / 2;
			const cy = sy + cell.h / 2;
			const sw = cell.w * HOVER_SCALE;
			const sh = cell.h * HOVER_SCALE;

			// Shadow pass — from a rect, not the image
			ctx.save();
			ctx.shadowColor = 'rgba(0,0,0,0.18)';
			ctx.shadowBlur = 24;
			ctx.shadowOffsetY = 8;
			ctx.fillStyle = 'rgba(0,0,0,0)';
			ctx.fillRect(cx - sw / 2, cy - sh / 2, sw, sh);
			ctx.restore();

			// Image pass — no shadows, clean rendering
			if (img) {
				ctx.drawImage(img, cx - sw / 2, cy - sh / 2, sw, sh);
			} else {
				ctx.fillStyle = '#f0f0f0';
				ctx.fillRect(cx - sw / 2, cy - sh / 2, sw, sh);
			}

			ctx.strokeStyle = '#313131';
			ctx.lineWidth = 2;
			ctx.strokeRect(cx - sw / 2, cy - sh / 2, sw, sh);

			const textX = cell.x;
			const textY = sy + cell.h + 12;
			const maxTextW = cell.w;

			ctx.textAlign = 'left';
			ctx.textBaseline = 'top';

			ctx.fillStyle = '#1a1a1a';
			ctx.font = `500 14px ${FONT}`;
			ctx.fillText(truncateText(cell.album.title, maxTextW), textX, textY);

			ctx.fillStyle = '#999999';
			ctx.font = `400 13px ${FONT}`;
			ctx.fillText(truncateText(cell.album.artist, maxTextW), textX, textY + 18);
		}

		ctx.textAlign = 'left';
		ctx.textBaseline = 'alphabetic';

		ctx.restore();
		animationId = requestAnimationFrame(draw);
	};

	const handleWheel = (e) => {
		e.preventDefault();
		targetScrollY = Math.max(0, Math.min(totalHeight - height, targetScrollY + e.deltaY));
	};

	const handleMouseMove = (e) => {
		const rect = canvas.getBoundingClientRect();
		mouseX = e.clientX - rect.left;
		mouseY = e.clientY - rect.top;
	};

	const handleClick = () => {
		if (hoveredCell && hoveredCell.type === 'album') {
			dispatch('albumClick', hoveredCell.album);
		}
	};

	const handleMouseLeave = () => {
		mouseX = -1000;
		mouseY = -1000;
		hoveredCell = null;
	};

	const resize = () => {
		if (!containerEl) return;
		width = containerEl.clientWidth;
		height = containerEl.clientHeight;
		canvas.width = width * dpr;
		canvas.height = height * dpr;
		canvas.style.width = width + 'px';
		canvas.style.height = height + 'px';
		recomputeLayout();
	};

	onMount(() => {
		dpr = window.devicePixelRatio || 1;
		ctx = canvas.getContext('2d');
		resize();
		window.addEventListener('resize', resize);
		draw();

		return () => {
			window.removeEventListener('resize', resize);
			cancelAnimationFrame(animationId);
		};
	});
</script>

<div class="grid-canvas" bind:this={containerEl}>
	<canvas
		bind:this={canvas}
		on:wheel={handleWheel}
		on:mousemove={handleMouseMove}
		on:click={handleClick}
		on:mouseleave={handleMouseLeave}
	></canvas>
</div>

<style lang="scss">
	.grid-canvas {
		flex: 1;
		position: relative;
		overflow: hidden;
		background: #fff;
	}

	canvas {
		display: block;
		cursor: pointer;
	}
</style>
