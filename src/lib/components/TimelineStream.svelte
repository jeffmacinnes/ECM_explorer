<script>
	import { onMount, onDestroy } from 'svelte';
	import { albumsByYear, selectedAlbum, selectedArtist, artistsIndex, catalogData } from '$lib/stores/catalog.js';

	// Canvas and context
	let canvas;
	let ctx;
	let animationId;
	let containerEl;

	// Layout config
	const CARD_SIZE = 140;
	const GAP = 16;
	const YEAR_COL_WIDTH = 160;
	const HEADER_HEIGHT = 80;
	const YEAR_GAP = 40;
	const TEXT_SPACE = 36;
	const ROW_HEIGHT = CARD_SIZE + TEXT_SPACE + GAP;
	const PADDING = 24;
	const TOP_MARGIN = 60;

	// Organic placement
	const OFFSET_X = 20;
	const OFFSET_Y = 14;
	const MAX_ROT = 0.035;

	// Idle floating
	const FLOAT_AMP = 3;
	const FLOAT_SPEED = 0.00035;

	// Mouse repulsion
	const REPEL_RADIUS = 200;
	const REPEL_FORCE = 0.5;

	// Physics config - critically damped (no bounce)
	const FRICTION = 0.65;
	const SPRING = 0.06;
	const EXIT_SPEED = 18;

	// Year label animation thresholds
	const TRANSITION_START = HEADER_HEIGHT;
	const TRANSITION_END = 20;
	const STICKY_TARGET_Y = 35;

	// Deterministic hash from string
	const hashId = (id) => {
		let h = 0;
		for (let i = 0; i < id.length; i++) {
			h = Math.imul(31, h) + id.charCodeAt(i) | 0;
		}
		return h;
	};

	// State
	let width = 0;
	let height = 0;
	let scrollY = 0;
	let targetScrollY = 0;
	let scrollVelocity = 0;
	let contentHeight = 0;
	let dpr = 1;

	// Albums as physics objects
	let particles = []; // {id, x, y, targetX, targetY, vx, vy, scale, rotation, opacity, img, album, year}
	let yearLabels = []; // {year, y, count}
	let imageCache = new Map();
	const imgVersion = Date.now();
	let hoveredParticle = null;
	let mouseX = 0;
	let mouseY = 0;
	let now = 0;

	// Export for minimap
	export let yearPositions = [];
	export let currentScrollY = 0;
	export { contentHeight };
	export { height as viewportHeight };

	// Tooltip state
	let tooltipAlbum = null;
	let tooltipX = 0;
	let tooltipY = 0;
	let tooltipCredits = [];

	// Build lookups
	$: artistNameMap = new Map($artistsIndex.map(a => [a.id, a.name]));
	$: albumCreditsMap = (() => {
		if (!$catalogData?.credits) return new Map();
		const map = new Map();
		for (const c of $catalogData.credits) {
			if (!map.has(c.albumId)) map.set(c.albumId, []);
			map.get(c.albumId).push(c);
		}
		return map;
	})();

	// Calculate layout positions — stream layout (continuous flow across year boundaries)
	const calculateLayout = (data, w) => {
		if (!w || w < 300 || !data?.length) return { particles: [], labels: [], height: 0 };

		const cols = Math.max(1, Math.floor((w - YEAR_COL_WIDTH - PADDING * 2) / (CARD_SIZE + GAP)));
		const newParticles = [];
		const labels = [];
		let y = PADDING + TOP_MARGIN;
		let col = 0;

		for (const group of data) {
			// Finish current row and add breathing gap between years
			if (col > 0) {
				y += ROW_HEIGHT;
				col = 0;
			}
			if (labels.length > 0) {
				y += YEAR_GAP;
			}

			labels.push({ year: group.year, y, count: group.albums.length });

			group.albums.forEach((album) => {
				// Deterministic organic offsets seeded from album ID
				const h = hashId(album.id);
				const offsetX = ((h & 0xFF) / 255 - 0.5) * OFFSET_X;
				const offsetY = (((h >>> 8) & 0xFF) / 255 - 0.5) * OFFSET_Y;
				const rotation = (((h >>> 16) & 0xFF) / 255 - 0.5) * MAX_ROT * 2;

				const x = YEAR_COL_WIDTH + PADDING + col * (CARD_SIZE + GAP) + offsetX;
				const py = y + offsetY;

				const existing = particles.find(p => p.id === album.id);

				// Float animation parameters (independent seed)
				const floatH = hashId(album.id + 'float');

				newParticles.push({
					id: album.id,
					album,
					year: group.year,
					x: existing?.x ?? x,
					y: existing?.y ?? py,
					targetX: x,
					targetY: py,
					vx: existing?.vx ?? 0,
					vy: existing?.vy ?? 0,
					scale: existing?.scale ?? 1,
					targetScale: 1,
					rotation: existing?.rotation ?? 0,
					organicRotation: rotation,
					opacity: existing?.opacity ?? 1,
					targetOpacity: 1,
					img: imageCache.get(album.localThumb) || null,
					exiting: false,
					delay: existing ? 0 : newParticles.length * 0.02,
					delayTimer: 0,
					floatPhaseX: (floatH & 0xFF) / 255 * Math.PI * 2,
					floatPhaseY: ((floatH >>> 8) & 0xFF) / 255 * Math.PI * 2,
					floatSpeedX: 0.8 + ((floatH >>> 16) & 0xFF) / 255 * 0.4,
					floatSpeedY: 0.8 + ((floatH >>> 24) & 0xFF) / 255 * 0.4
				});

				// Load image if needed
				if (album.localThumb && !imageCache.has(album.localThumb)) {
					const img = new Image();
					img.onload = () => {
						imageCache.set(album.localThumb, img);
						const p = newParticles.find(p => p.id === album.id);
						if (p) p.img = img;
					};
					img.src = album.localThumb + '?v=' + imgVersion;
				}

				col++;
				if (col >= cols) {
					col = 0;
					y += ROW_HEIGHT;
				}
			});
		}

		// Account for final partial row
		if (col > 0) {
			y += ROW_HEIGHT;
		}

		return { particles: newParticles, labels, height: y + 100 };
	};

	// Handle filter changes
	let currentFilter = null;
	$: if ($selectedArtist?.id !== currentFilter) {
		const prevFilter = currentFilter;
		currentFilter = $selectedArtist?.id || null;

		if (prevFilter !== null || currentFilter !== null) {
			// Mark exiting particles with staggered delays
			const newLayout = calculateLayout($albumsByYear, width);
			const newIds = new Set(newLayout.particles.map(p => p.id));

			let exitIndex = 0;
			particles.forEach(p => {
				if (!newIds.has(p.id)) {
					p.exiting = true;
					p.exitDelay = exitIndex * 0.008;
					p.exitTimer = 0;
					exitIndex++;
				}
			});

			// Add new particles after a delay
			setTimeout(() => {
				const layout = calculateLayout($albumsByYear, width);

				// Keep non-exiting particles, add new ones
				const existingIds = new Set(particles.filter(p => !p.exiting).map(p => p.id));

				layout.particles.forEach(p => {
					if (!existingIds.has(p.id)) {
						// New particle - start from below
						p.y = p.targetY + 200;
						p.opacity = 0;
						p.scale = 0.8;
					}
				});

				particles = layout.particles;
				yearLabels = layout.labels;
				contentHeight = layout.height;
				targetScrollY = 0;
			}, 400);
		}
	}

	// Draw a single particle
	const drawParticle = (p, screenY) => {
		// Float displacement (visual only — doesn't affect physics)
		const floatX = Math.sin(now * FLOAT_SPEED * p.floatSpeedX + p.floatPhaseX) * FLOAT_AMP;
		const floatY = Math.sin(now * FLOAT_SPEED * p.floatSpeedY + p.floatPhaseY) * FLOAT_AMP;

		// Check hover (against physics position, not float)
		const isHovered = !p.exiting &&
			mouseX > p.x && mouseX < p.x + CARD_SIZE &&
			mouseY + scrollY > p.y && mouseY + scrollY < p.y + CARD_SIZE;

		if (isHovered && !hoveredParticle) {
			hoveredParticle = p;
			p.targetScale = 1.06;
		} else if (!isHovered && hoveredParticle === p) {
			hoveredParticle = null;
			p.targetScale = 1;
		}

		const halfSize = CARD_SIZE / 2;

		// Shadow pass — drawn from a simple rect, not the image
		if (p.scale > 1.02) {
			ctx.save();
			ctx.translate(p.x + floatX + CARD_SIZE / 2, screenY + floatY + CARD_SIZE / 2);
			ctx.rotate(p.rotation);
			ctx.scale(p.scale, p.scale);
			ctx.globalAlpha = p.opacity;
			ctx.shadowColor = 'rgba(0,0,0,0.15)';
			ctx.shadowBlur = 20;
			ctx.shadowOffsetY = 8;
			ctx.fillStyle = 'rgba(0,0,0,0)';
			ctx.fillRect(-halfSize, -halfSize, CARD_SIZE, CARD_SIZE);
			ctx.restore();
		}

		// Image pass — no shadows, clean rendering
		ctx.save();
		ctx.translate(p.x + floatX + CARD_SIZE / 2, screenY + floatY + CARD_SIZE / 2);
		ctx.rotate(p.rotation);
		ctx.scale(p.scale, p.scale);
		ctx.globalAlpha = p.opacity;

		if (p.img) {
			ctx.drawImage(p.img, -halfSize, -halfSize, CARD_SIZE, CARD_SIZE);
		} else {
			ctx.fillStyle = '#f0f0f0';
			ctx.fillRect(-halfSize, -halfSize, CARD_SIZE, CARD_SIZE);
		}

		// Hover outline
		if (p === hoveredParticle) {
			ctx.strokeStyle = '#313131';
			ctx.lineWidth = 2;
			ctx.strokeRect(-halfSize, -halfSize, CARD_SIZE, CARD_SIZE);
		}

		ctx.restore();

		// Draw text below image (with float offset)
		if (p.opacity > 0.5 && !p.exiting) {
			const textY = screenY + floatY + CARD_SIZE + 16;
			ctx.globalAlpha = p.opacity;

			ctx.fillStyle = p === hoveredParticle ? '#1a1a1a' : '#313131';
			ctx.font = '500 13px Univers, Helvetica Neue, Helvetica, Arial, sans-serif';
			ctx.fillText(truncateText(ctx, p.album.title, CARD_SIZE), p.x + floatX, textY);

			ctx.fillStyle = '#999999';
			ctx.font = '400 12px Univers, Helvetica Neue, Helvetica, Arial, sans-serif';
			ctx.fillText(truncateText(ctx, p.album.artist, CARD_SIZE), p.x + floatX, textY + 16);
		}

		ctx.globalAlpha = 1;
	};

	// Draw a single year label at given progress (0=at-rest, 1=sticky)
	const drawYearLabel = (label, index, screenY, progress) => {
		const nextLabel = yearLabels[index + 1];
		let nextProgress = 0;
		if (nextLabel) {
			const nextScreenY = nextLabel.y - scrollY;
			nextProgress = Math.max(0, Math.min(1, (TRANSITION_START - nextScreenY) / (TRANSITION_START - TRANSITION_END)));
		}

		// Skip if sticky and next year is transitioning (being pushed out)
		if (progress >= 1 && nextProgress > 0) return;

		const fontSize = 140 - (progress * 116);
		const fontWeight = Math.round(300 + (progress * 100));

		const labelX = PADDING + (progress * (YEAR_COL_WIDTH - PADDING));
		const normalY = screenY + 55;
		const labelY = Math.max(STICKY_TARGET_Y, normalY - (progress * (normalY - STICKY_TARGET_Y)));
		const yearTextY = labelY + (40 * (1 - progress));

		// Light grey to dark transition
		const greyValue = Math.round(220 - (progress * 171));
		ctx.globalAlpha = 1;
		ctx.fillStyle = `rgb(${greyValue}, ${greyValue}, ${greyValue})`;
		ctx.font = `${fontWeight} ${Math.round(fontSize)}px Univers, Helvetica Neue, Helvetica, Arial, sans-serif`;
		ctx.letterSpacing = `${-0.1 * fontSize}px`;
		ctx.fillText(label.year, labelX, yearTextY);
		ctx.letterSpacing = '0px';

		// Album count below the year
		if (progress < 0.5) {
			const countGrey = Math.round(180 - (progress * 2 * 40));
			ctx.font = '400 13px Univers, Helvetica Neue, Helvetica, Arial, sans-serif';
			ctx.fillStyle = `rgb(${countGrey}, ${countGrey}, ${countGrey})`;
			ctx.fillText(`${label.count} albums`, PADDING, yearTextY + 20);
		}

		// Divider line at year boundary
		const normalLineY = screenY;
		const stickyLineY = 50;
		const lineY = Math.max(stickyLineY, normalLineY - (progress * (normalLineY - stickyLineY)));
		const lineGrey = Math.round(230 - (progress * 50));
		ctx.strokeStyle = `rgb(${lineGrey}, ${lineGrey}, ${lineGrey})`;
		ctx.lineWidth = 1;
		ctx.beginPath();
		ctx.moveTo(YEAR_COL_WIDTH, lineY);
		ctx.lineTo(width - PADDING, lineY);
		ctx.stroke();

		ctx.globalAlpha = 1;
	};

	// Animation loop
	const animate = () => {
		if (!ctx) return;

		// Update scroll - smooth easing, no bounce
		const scrollDiff = targetScrollY - scrollY;
		scrollY += scrollDiff * 0.18;
		currentScrollY = scrollY;

		// Timestamp for float animation
		now = performance.now();

		// Clear canvas
		ctx.fillStyle = '#ffffff';
		ctx.fillRect(0, 0, width * dpr, height * dpr);
		ctx.save();
		ctx.scale(dpr, dpr);
		ctx.imageSmoothingEnabled = true;
		ctx.imageSmoothingQuality = 'high';

		let hasMotion = Math.abs(scrollDiff) > 0.1;

		// --- Pass 1: At-rest year labels (behind particles) ---
		yearLabels.forEach((label, index) => {
			const screenY = label.y - scrollY;
			const progress = Math.max(0, Math.min(1, (TRANSITION_START - screenY) / (TRANSITION_START - TRANSITION_END)));

			if (progress >= 1) return; // Sticky labels drawn later
			if (screenY < -200 || screenY > height + 200) return;

			drawYearLabel(label, index, screenY, progress);
		});

		// --- Pass 2: Update physics and draw particles ---
		const worldMouseX = mouseX;
		const worldMouseY = mouseY + scrollY;

		particles = particles.filter(p => {
			if (p.exiting && p.opacity < 0.01) return false;

			// Handle staggered exit
			if (p.exiting && p.exitDelay > 0) {
				p.exitTimer += 0.016;
				if (p.exitTimer < p.exitDelay) {
					const screenY = p.y - scrollY;
					if (screenY >= -CARD_SIZE - 100 && screenY <= height + 100) {
						drawParticle(p, screenY);
					}
					return true;
				}
				// Start exit animation
				p.exitDelay = 0;
				p.vx = (Math.random() - 0.5) * EXIT_SPEED;
				p.vy = -Math.random() * EXIT_SPEED - 8;
				p.targetOpacity = 0;
				p.targetScale = 0.6;
			}

			// Handle entrance stagger delay
			if (p.delay > 0) {
				p.delayTimer += 0.016;
				if (p.delayTimer < p.delay) {
					return true;
				}
				p.delay = 0;
			}

			// Physics update
			const dx = p.targetX - p.x;
			const dy = p.targetY - p.y;

			p.vx += dx * SPRING;
			p.vy += dy * SPRING;

			// Mouse proximity repulsion
			if (!p.exiting) {
				const pcx = p.x + CARD_SIZE / 2;
				const pcy = p.y + CARD_SIZE / 2;
				const dxm = pcx - worldMouseX;
				const dym = pcy - worldMouseY;
				const distSq = dxm * dxm + dym * dym;
				if (distSq < REPEL_RADIUS * REPEL_RADIUS && distSq > 1) {
					const dist = Math.sqrt(distSq);
					const force = (1 - dist / REPEL_RADIUS) * REPEL_FORCE;
					p.vx += (dxm / dist) * force;
					p.vy += (dym / dist) * force;
				}
			}

			p.vx *= FRICTION;
			p.vy *= FRICTION;
			p.x += p.vx;
			p.y += p.vy;

			// Scale and opacity - smooth easing, no bounce
			p.scale += (p.targetScale - p.scale) * 0.12;
			p.opacity += (p.targetOpacity - p.opacity) * 0.1;

			// Rotation eases toward organic resting angle
			p.rotation += (p.organicRotation - p.rotation) * 0.08;

			if (Math.abs(p.vx) > 0.1 || Math.abs(p.vy) > 0.1) hasMotion = true;

			// Check if visible
			const screenY = p.y - scrollY;
			if (screenY < -CARD_SIZE - 100 || screenY > height + 100) return true;

			drawParticle(p, screenY);
			return true;
		});

		// --- Pass 3: Sticky header background and sticky year labels ---
		let needsBackground = false;
		yearLabels.forEach(label => {
			const screenY = label.y - scrollY;
			if (screenY < TRANSITION_START) needsBackground = true;
		});

		if (needsBackground) {
			ctx.fillStyle = 'rgba(255, 255, 255, 0.97)';
			ctx.fillRect(0, 0, width, 50);
		}

		yearLabels.forEach((label, index) => {
			const screenY = label.y - scrollY;
			const progress = Math.max(0, Math.min(1, (TRANSITION_START - screenY) / (TRANSITION_START - TRANSITION_END)));

			if (progress < 1) return; // Only sticky labels in this pass

			drawYearLabel(label, index, screenY, progress);
		});

		ctx.restore();

		// Update tooltip
		if (hoveredParticle && !hoveredParticle.exiting) {
			tooltipAlbum = hoveredParticle.album;
			tooltipX = hoveredParticle.x + CARD_SIZE / 2;
			tooltipY = hoveredParticle.y - scrollY;
			updateTooltipCredits(hoveredParticle.album);
		} else {
			tooltipAlbum = null;
		}

		// Update year positions for minimap
		yearPositions = yearLabels.map(l => ({ year: l.year, top: l.y, height: 200 }));

		animationId = requestAnimationFrame(animate);
	};

	const truncateText = (ctx, text, maxWidth) => {
		if (!text) return '';
		if (ctx.measureText(text).width <= maxWidth) return text;
		let truncated = text;
		while (truncated.length > 0 && ctx.measureText(truncated + '...').width > maxWidth) {
			truncated = truncated.slice(0, -1);
		}
		return truncated + '...';
	};

	const updateTooltipCredits = (album) => {
		const credits = albumCreditsMap.get(album.id) || [];
		const roles = ['Primary Artist', 'Piano', 'Bass', 'Drums', 'Saxophone', 'Trumpet', 'Guitar', 'Violin', 'Cello', 'Voice', 'Vocals', 'Percussion', 'Vibraphone', 'Trombone', 'Clarinet', 'Flute', 'Organ', 'Synthesizer', 'Electronics', 'Composed By', 'Conductor'];
		tooltipCredits = credits
			.filter(c => roles.some(r => c.role?.includes(r)))
			.map(c => ({ ...c, name: artistNameMap.get(c.artistId) || c.artistId }))
			.slice(0, 6);
	};

	// Event handlers
	const handleWheel = (e) => {
		e.preventDefault();
		targetScrollY = Math.max(0, Math.min(contentHeight - height, targetScrollY + e.deltaY));
	};

	const handleMouseMove = (e) => {
		const rect = canvas.getBoundingClientRect();
		mouseX = e.clientX - rect.left;
		mouseY = e.clientY - rect.top;
	};

	const handleClick = () => {
		if (hoveredParticle && !hoveredParticle.exiting) {
			selectedAlbum.set(hoveredParticle.album);
		}
	};

	const handleMouseLeave = () => {
		mouseX = -1000;
		mouseY = -1000;
		if (hoveredParticle) {
			hoveredParticle.targetScale = 1;
			hoveredParticle = null;
		}
		tooltipAlbum = null;
	};

	const filterByArtist = (artistId) => {
		const artist = $artistsIndex.find(a => a.id === artistId);
		if (artist) {
			selectedArtist.set(artist);
			tooltipAlbum = null;
		}
	};

	export const scrollToYear = (year, targetScroll = null) => {
		if (targetScroll !== null) {
			targetScrollY = Math.max(0, Math.min(contentHeight - height, targetScroll));
		} else {
			const label = yearLabels.find(l => l.year == year);
			if (label) targetScrollY = Math.max(0, label.y - 20);
		}
	};

	// Setup
	onMount(() => {
		dpr = window.devicePixelRatio || 1;
		ctx = canvas.getContext('2d');

		const resize = () => {
			width = containerEl.clientWidth;
			height = containerEl.clientHeight;
			canvas.width = width * dpr;
			canvas.height = height * dpr;
			canvas.style.width = width + 'px';
			canvas.style.height = height + 'px';

			const layout = calculateLayout($albumsByYear, width);
			particles = layout.particles;
			yearLabels = layout.labels;
			contentHeight = layout.height;
		};

		resize();
		window.addEventListener('resize', resize);
		animate();

		return () => {
			window.removeEventListener('resize', resize);
			cancelAnimationFrame(animationId);
		};
	});

	// Initial data load
	$: if ($albumsByYear?.length && width > 0 && particles.length === 0) {
		const layout = calculateLayout($albumsByYear, width);
		particles = layout.particles;
		yearLabels = layout.labels;
		contentHeight = layout.height;
	}
</script>

<div class="timeline" bind:this={containerEl}>
	<canvas
		bind:this={canvas}
		on:wheel={handleWheel}
		on:mousemove={handleMouseMove}
		on:click={handleClick}
		on:mouseleave={handleMouseLeave}
	></canvas>

	{#if tooltipAlbum && tooltipCredits.length > 0}
		<div class="tooltip" style="left: {tooltipX}px; top: {tooltipY}px;">
			<div class="tooltip-header">Personnel</div>
			{#each tooltipCredits as credit}
				<button class="tooltip-artist" on:click={() => filterByArtist(credit.artistId)}>
					<span class="name">{credit.name}</span>
					<span class="role">{credit.role}</span>
				</button>
			{/each}
			<div class="tooltip-hint">Click to filter</div>
		</div>
	{/if}
</div>

<style lang="scss">
	.timeline {
		flex: 1;
		position: relative;
		overflow: hidden;
		background: #fff;
	}

	canvas {
		display: block;
		cursor: pointer;
	}

	.tooltip {
		position: absolute;
		transform: translate(-50%, -100%);
		margin-top: -20px;
		background: #fff;
		border: 1px solid var(--color-border);
		border-radius: 6px;
		padding: 12px;
		min-width: 200px;
		z-index: 100;
		box-shadow: 0 8px 30px rgba(0, 0, 0, 0.12);
		pointer-events: auto;

		&::after {
			content: '';
			position: absolute;
			bottom: -6px;
			left: 50%;
			transform: translateX(-50%) rotate(45deg);
			width: 10px;
			height: 10px;
			background: #fff;
			border-right: 1px solid var(--color-border);
			border-bottom: 1px solid var(--color-border);
		}
	}

	.tooltip-header {
		font-size: 10px;
		text-transform: uppercase;
		letter-spacing: 0.15em;
		color: var(--color-g3);
		margin-bottom: 8px;
		padding-bottom: 8px;
		border-bottom: 1px solid var(--color-border-light);
		font-weight: 600;
	}

	.tooltip-artist {
		display: flex;
		justify-content: space-between;
		width: 100%;
		padding: 6px 8px;
		background: none;
		border: none;
		border-radius: 3px;
		cursor: pointer;
		color: var(--color-text);
		text-align: left;
		transition: background 0.15s;

		&:hover {
			background: var(--color-g5);
			.name { color: var(--color-black); }
		}

		.name {
			font-size: 12px;
			font-weight: 500;
		}

		.role {
			font-size: 11px;
			color: var(--color-g3);
			font-style: italic;
		}
	}

	.tooltip-hint {
		font-size: 10px;
		color: var(--color-g4);
		text-align: center;
		margin-top: 8px;
		padding-top: 8px;
		border-top: 1px solid var(--color-border-light);
	}
</style>
