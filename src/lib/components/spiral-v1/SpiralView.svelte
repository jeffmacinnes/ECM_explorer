<script>
	import { onMount, onDestroy } from 'svelte';
	import { selectedAlbum } from '$lib/stores/catalog.js';
	import { computeSpiralPosition, positionToTransform, VISIBLE_RANGE, Y_STEP } from './spiralMath.js';

	export let albums = [];

	const SCROLL_PER_ALBUM = 80;
	const LERP_SPEED = 0.12;

	let scrollContainer;
	let currentCenter = 0;
	let targetCenter = 0;
	let activeAlbum = null;
	let rafId = null;
	let visibleCards = [];

	$: spacerHeight = albums.length * SCROLL_PER_ALBUM;

	const updateVisibleCards = (center) => {
		if (albums.length === 0) return;

		const idx = Math.round(center);
		const clamped = Math.max(0, Math.min(idx, albums.length - 1));
		activeAlbum = albums[clamped] || null;

		const start = Math.max(0, Math.floor(center) - VISIBLE_RANGE);
		const end = Math.min(albums.length - 1, Math.ceil(center) + VISIBLE_RANGE);
		const cards = [];

		for (let i = start; i <= end; i++) {
			const d = i - center;
			const pos = computeSpiralPosition(d, i);
			cards.push({
				album: albums[i],
				index: i,
				transform: positionToTransform(pos),
				opacity: pos.opacity,
				zIndex: pos.zIndex,
				isActive: Math.abs(d) < 0.5
			});
		}
		visibleCards = cards;
	};

	const onScroll = () => {
		if (!scrollContainer) return;
		const scrollTop = scrollContainer.scrollTop;
		const maxScroll = spacerHeight - scrollContainer.clientHeight;
		if (maxScroll <= 0) return;

		targetCenter = (scrollTop / maxScroll) * (albums.length - 1);
	};

	const animate = () => {
		const diff = targetCenter - currentCenter;
		if (Math.abs(diff) > 0.001) {
			currentCenter += diff * LERP_SPEED;
		} else {
			currentCenter = targetCenter;
		}
		updateVisibleCards(currentCenter);
		rafId = requestAnimationFrame(animate);
	};

	const handleCardClick = (card) => {
		if (!card.isActive) return;
		selectedAlbum.set(card.album);
	};

	onMount(() => {
		rafId = requestAnimationFrame(animate);
		if (albums.length > 0) {
			activeAlbum = albums[0];
		}
	});

	onDestroy(() => {
		if (rafId) cancelAnimationFrame(rafId);
	});

	export const resetScroll = () => {
		if (scrollContainer) {
			scrollContainer.scrollTop = 0;
			currentCenter = 0;
			targetCenter = 0;
		}
	};
</script>

<div class="spiral-layout">
	<div class="info-panel">
		{#if activeAlbum}
			<span class="info-catalog">{activeAlbum.catalogNumber}</span>
			<h2 class="info-title">{activeAlbum.title}</h2>
			<p class="info-artist">{activeAlbum.artist}</p>
			{#if activeAlbum.year}
				<p class="info-year">{activeAlbum.year}</p>
			{/if}
		{/if}
	</div>

	<div class="spiral-scroll" bind:this={scrollContainer} on:scroll={onScroll}>
		<div class="scroll-spacer" style="height: {spacerHeight}px;">
			<div class="spiral-stage">
				<div class="spiral-scene">
					{#each visibleCards as card (card.album.id)}
						<div
							class="spiral-card"
							class:active={card.isActive}
							style="transform: {card.transform}; opacity: {card.opacity}; z-index: {card.zIndex};"
							on:click={() => handleCardClick(card)}
							on:keydown={(e) => e.key === 'Enter' && handleCardClick(card)}
							role="button"
							tabindex={card.isActive ? 0 : -1}
						>
							{#if card.album.localThumb}
								<img
									src={card.album.localThumb}
									alt="{card.album.artist} — {card.album.title}"
									loading="lazy"
									draggable="false"
								/>
							{:else}
								<div class="placeholder"></div>
							{/if}
						</div>
					{/each}
				</div>
			</div>
		</div>
	</div>
</div>

<style lang="scss">
	.spiral-layout {
		position: relative;
		width: 100%;
		height: 100%;
		overflow: hidden;
		background: #fff;
	}

	.info-panel {
		position: absolute;
		left: 0;
		top: 0;
		bottom: 0;
		width: 35%;
		z-index: 10;
		display: flex;
		flex-direction: column;
		justify-content: center;
		padding: 3rem 3.5rem;
		background: linear-gradient(to right, rgba(255, 255, 255, 0.95) 60%, transparent);
		pointer-events: none;
	}

	.info-catalog {
		font-size: 1.1rem;
		letter-spacing: 0.15em;
		text-transform: uppercase;
		color: var(--color-g3);
		margin-bottom: 0.75rem;
	}

	.info-title {
		font-size: 3.2rem;
		font-weight: 300;
		color: var(--color-text);
		margin: 0 0 0.5rem;
		line-height: 1.15;
		letter-spacing: -0.01em;
	}

	.info-artist {
		font-size: 1.8rem;
		font-weight: 300;
		color: var(--color-g2);
		margin: 0 0 0.75rem;
	}

	.info-year {
		font-size: 1.3rem;
		color: var(--color-g3);
		margin: 0;
		letter-spacing: 0.1em;
	}

	.spiral-scroll {
		position: absolute;
		inset: 0;
		overflow-y: auto;
		-ms-overflow-style: none;
		scrollbar-width: none;

		&::-webkit-scrollbar {
			display: none;
		}
	}

	.scroll-spacer {
		pointer-events: none;
	}

	.spiral-stage {
		position: sticky;
		top: 0;
		height: 100vh;
		width: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		pointer-events: none;
	}

	.spiral-scene {
		position: relative;
		width: 100%;
		height: 100%;
		perspective: 1200px;
		perspective-origin: 50% 50%;
		transform-style: preserve-3d;
		pointer-events: none;
	}

	.spiral-card {
		position: absolute;
		top: 50%;
		left: 55%;
		width: 450px;
		height: 450px;
		margin-left: -225px;
		margin-top: -225px;
		will-change: transform, opacity;
		pointer-events: auto;
		cursor: default;
		transition: box-shadow 0.4s ease, outline 0.4s ease;
		outline: 2px solid transparent;

		&.active {
			cursor: pointer;
			box-shadow: 0 8px 40px rgba(0, 0, 0, 0.15), 0 2px 12px rgba(0, 0, 0, 0.1);
			outline: 2px solid rgba(0, 0, 0, 0.12);
		}

		img {
			width: 100%;
			height: 100%;
			object-fit: cover;
			display: block;
			border-radius: 1px;
			border: 1px solid var(--color-g3);
			user-select: none;
		}
	}

	.placeholder {
		width: 100%;
		height: 100%;
		background: var(--color-g5);
		border: 1px solid var(--color-border);
		border-radius: 1px;
	}
</style>
