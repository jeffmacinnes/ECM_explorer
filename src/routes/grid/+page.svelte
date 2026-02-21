<script>
	import { onMount } from 'svelte';
	import GridCanvas from '$lib/components/grid/GridCanvas.svelte';
	import GridFilterBar from '$lib/components/grid/GridFilterBar.svelte';
	import AlbumModal from '$lib/components/AlbumModal.svelte';
	import { loadCatalog, isLoading, catalogData, selectedAlbum } from '$lib/stores/catalog.js';

	let searchQuery = '';
	let sortMode = 'year-desc';

	$: filteredAlbums = (() => {
		if (!$catalogData?.albums) return [];
		let albums = $catalogData.albums;

		if (searchQuery.trim()) {
			const q = searchQuery.trim().toLowerCase();
			albums = albums.filter(a =>
				a.artist?.toLowerCase().includes(q) ||
				a.title?.toLowerCase().includes(q)
			);
		}

		albums = [...albums];
		if (sortMode === 'year-desc') {
			albums.sort((a, b) => (b.year || 0) - (a.year || 0) || a.catalogNumber.localeCompare(b.catalogNumber));
		} else if (sortMode === 'year-asc') {
			albums.sort((a, b) => (a.year || 0) - (b.year || 0) || a.catalogNumber.localeCompare(b.catalogNumber));
		} else if (sortMode === 'title-asc') {
			albums.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
		}

		return albums;
	})();

	$: yearGroups = (() => {
		const byYear = new Map();
		for (const album of filteredAlbums) {
			const year = album.year || 'Unknown';
			if (!byYear.has(year)) byYear.set(year, []);
			byYear.get(year).push(album);
		}

		const entries = Array.from(byYear.entries());
		if (sortMode === 'year-desc') {
			entries.sort((a, b) => {
				if (a[0] === 'Unknown') return 1;
				if (b[0] === 'Unknown') return -1;
				return b[0] - a[0];
			});
		} else if (sortMode === 'year-asc') {
			entries.sort((a, b) => {
				if (a[0] === 'Unknown') return 1;
				if (b[0] === 'Unknown') return -1;
				return a[0] - b[0];
			});
		} else {
			return [{ year: '', albums: filteredAlbums }];
		}

		return entries.map(([year, albums]) => ({ year, albums }));
	})();

	const handleAlbumClick = (e) => {
		selectedAlbum.set(e.detail);
	};

	onMount(() => {
		loadCatalog();
	});
</script>

<svelte:head>
	<title>ECM Grid</title>
</svelte:head>

<div class="grid-page">
	<header>
		<h1>ECM</h1>
		<GridFilterBar bind:searchQuery bind:sortMode />
	</header>

	{#if $isLoading}
		<div class="loading">Loading catalog…</div>
	{:else}
		<GridCanvas
			{yearGroups}
			on:albumClick={handleAlbumClick}
		/>
	{/if}

	{#if $selectedAlbum}
		<AlbumModal />
	{/if}
</div>

<style lang="scss">
	.grid-page {
		display: flex;
		flex-direction: column;
		height: 100%;
		width: 100%;
		background: #fff;
		color: var(--color-text);
	}

	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1.25rem 1.5rem;
		border-bottom: 1px solid var(--color-border);
		flex-shrink: 0;
	}

	h1 {
		font-size: 2.4rem;
		font-weight: 300;
		letter-spacing: 0.3em;
		text-transform: uppercase;
		margin: 0;
		color: var(--color-text);
	}

	.loading {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1.4rem;
		color: var(--color-g3);
		letter-spacing: 0.1em;
	}
</style>
