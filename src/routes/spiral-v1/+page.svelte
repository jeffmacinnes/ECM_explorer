<script>
	import { onMount } from 'svelte';
	import SpiralView from '$lib/components/spiral-v1/SpiralView.svelte';
	import SpiralToolbar from '$lib/components/spiral-v1/SpiralToolbar.svelte';
	import AlbumModal from '$lib/components/AlbumModal.svelte';
	import { loadCatalog, isLoading, catalogData, selectedAlbum, selectedArtist } from '$lib/stores/catalog.js';

	let sortMode = 'year-desc';
	let spiralView;
	let gsap;

	$: sortedAlbums = (() => {
		if (!$catalogData?.albums) return [];
		let albums = [...$catalogData.albums];

		if ($selectedArtist) {
			const artistAlbumIds = new Set(
				$catalogData.credits
					.filter(c => c.artistId === $selectedArtist.id)
					.map(c => c.albumId)
			);
			albums = albums.filter(a => artistAlbumIds.has(a.id));
		}

		if (sortMode === 'year-desc') {
			albums.sort((a, b) => (b.year || 0) - (a.year || 0) || a.catalogNumber.localeCompare(b.catalogNumber));
		} else if (sortMode === 'year-asc') {
			albums.sort((a, b) => (a.year || 0) - (b.year || 0) || a.catalogNumber.localeCompare(b.catalogNumber));
		} else if (sortMode === 'title-asc') {
			albums.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
		} else if (sortMode === 'catalog') {
			albums.sort((a, b) => a.catalogNumber.localeCompare(b.catalogNumber));
		}

		return albums;
	})();

	const handleSortChange = (e) => {
		sortMode = e.detail;
		spiralView?.resetScroll();
	};

	// Reset scroll when artist filter changes
	$: if ($selectedArtist !== undefined) {
		spiralView?.resetScroll();
	}

	// FLIP animation: click active card → modal cover
	const handleAlbumClick = () => {
		const activeCard = document.querySelector('.spiral-card.active img');
		if (!activeCard || !$selectedAlbum || !gsap) return;

		const rect = activeCard.getBoundingClientRect();
		const clone = activeCard.cloneNode(true);

		Object.assign(clone.style, {
			position: 'fixed',
			top: `${rect.top}px`,
			left: `${rect.left}px`,
			width: `${rect.width}px`,
			height: `${rect.height}px`,
			zIndex: 200,
			borderRadius: '2px',
			pointerEvents: 'none',
			transition: 'none'
		});
		document.body.appendChild(clone);

		requestAnimationFrame(() => {
			const modalCover = document.querySelector('.album-cover');
			if (modalCover) {
				const target = modalCover.getBoundingClientRect();
				gsap.to(clone, {
					top: target.top,
					left: target.left,
					width: target.width,
					height: target.height,
					duration: 0.5,
					ease: 'power3.inOut',
					onComplete: () => clone.remove()
				});
			} else {
				gsap.to(clone, {
					opacity: 0,
					scale: 1.1,
					duration: 0.3,
					ease: 'power2.out',
					onComplete: () => clone.remove()
				});
			}
		});
	};

	// Watch for album selection to trigger FLIP
	$: if ($selectedAlbum) {
		requestAnimationFrame(handleAlbumClick);
	}

	onMount(async () => {
		const mod = await import('gsap');
		gsap = mod.gsap;
		loadCatalog();
	});
</script>

<svelte:head>
	<title>ECM Spiral</title>
</svelte:head>

<div class="spiral-page">
	{#if $isLoading}
		<div class="loading">Loading catalog…</div>
	{:else}
		<SpiralToolbar {sortMode} on:sortChange={handleSortChange} />
		<SpiralView albums={sortedAlbums} bind:this={spiralView} />
	{/if}

	{#if $selectedAlbum}
		<AlbumModal />
	{/if}
</div>

<style lang="scss">
	.spiral-page {
		position: relative;
		width: 100%;
		height: 100%;
		background: #fff;
	}

	.loading {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1.4rem;
		color: var(--color-g3);
		letter-spacing: 0.1em;
	}
</style>
