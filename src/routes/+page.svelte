<script>
	import { onMount } from 'svelte';
	import TimelineStream from '$lib/components/TimelineStream.svelte';

	import Minimap from '$lib/components/Minimap.svelte';
	import ArtistFilter from '$lib/components/ArtistFilter.svelte';
	import LayoutSwitcher from '$lib/components/LayoutSwitcher.svelte';
	import AlbumModal from '$lib/components/AlbumModal.svelte';
	import { loadCatalog, isLoading, selectedAlbum, selectedArtist, selectedArtistDetail, getArtistDetail, catalogData, artistsIndex } from '$lib/stores/catalog.js';

	let timeline;
	let yearPositions = [];
	let currentScrollY = 0;
	let contentHeight = 0;
	let viewportHeight = 0;

	const scrollToYear = (year, targetScroll) => {
		timeline?.scrollToYear(year, targetScroll);
	};

	// Load artist details when an artist is selected
	$: if ($selectedArtist) {
		getArtistDetail($selectedArtist.id).then(detail => {
			selectedArtistDetail.set(detail);
		});
	} else {
		selectedArtistDetail.set(null);
	}

	// Build collaborators list
	$: collaborators = (() => {
		if (!$selectedArtist || !$catalogData?.credits || !$artistsIndex.length) return [];

		// Find all albums this artist appears on
		const artistAlbumIds = new Set(
			$catalogData.credits
				.filter(c => c.artistId === $selectedArtist.id)
				.map(c => c.albumId)
		);

		// Find all other artists on those albums
		const collabCounts = new Map();
		for (const credit of $catalogData.credits) {
			if (artistAlbumIds.has(credit.albumId) && credit.artistId !== $selectedArtist.id) {
				collabCounts.set(credit.artistId, (collabCounts.get(credit.artistId) || 0) + 1);
			}
		}

		// Get artist info and sort by collaboration count
		const artistMap = new Map($artistsIndex.map(a => [a.id, a]));
		return Array.from(collabCounts.entries())
			.map(([id, count]) => ({ ...artistMap.get(id), collabCount: count }))
			.filter(a => a && a.name)
			.sort((a, b) => b.collabCount - a.collabCount)
			.slice(0, 20); // Top 20 collaborators
	})();

	const clearArtist = () => {
		selectedArtist.set(null);
	};

	const selectCollaborator = (artist) => {
		selectedArtist.set(artist);
	};

	onMount(() => {
		loadCatalog();
	});
</script>

<svelte:head>
	<title>ECM Explorer</title>
	<meta name="description" content="Explore the ECM Records catalog through an interactive timeline" />
</svelte:head>

<div class="container">
	<header class:expanded={$selectedArtist}>
		<div class="header-main">
			<h1>ECM Explorer</h1>
			<LayoutSwitcher />
			<ArtistFilter />
		</div>

		{#if $selectedArtist && $selectedArtistDetail}
			<div class="artist-header">
				{#if $selectedArtistDetail.localImage}
					<img
						src={$selectedArtistDetail.localImage}
						alt={$selectedArtistDetail.name}
						class="artist-thumb"
					/>
				{/if}
				<div class="artist-info">
					<div class="artist-name-row">
						<h2>{$selectedArtistDetail.name}</h2>
						<button class="clear-btn" on:click={clearArtist}>×</button>
					</div>
					<p class="album-count">{$selectedArtist.albumCount} albums on ECM</p>
					{#if $selectedArtistDetail.profile}
						<p class="artist-bio">{$selectedArtistDetail.profile}</p>
					{/if}
					{#if $selectedArtistDetail.discogsId}
						<a
							href="https://www.discogs.com/artist/{$selectedArtistDetail.discogsId}"
							target="_blank"
							rel="noopener noreferrer"
							class="discogs-link"
						>
							View on Discogs →
						</a>
					{/if}
				</div>
			</div>

			{#if collaborators.length > 0}
				<div class="collaborators">
					<span class="collab-label">Collaborators:</span>
					<div class="collab-list">
						{#each collaborators as collab}
							<button class="collab-link" on:click={() => selectCollaborator(collab)}>
								{collab.name}
							</button>
						{/each}
					</div>
				</div>
			{/if}
		{/if}
	</header>

	{#if $isLoading}
		<div class="loading">Loading catalog...</div>
	{:else}
		<div class="main-content">
			<Minimap
				{yearPositions}
				{scrollToYear}
				{currentScrollY}
				{contentHeight}
				{viewportHeight}
			/>
			<TimelineStream
				bind:this={timeline}
				bind:yearPositions
				bind:currentScrollY
				bind:contentHeight
				bind:viewportHeight
			/>
		</div>
	{/if}

	{#if $selectedAlbum}
		<AlbumModal />
	{/if}
</div>

<style lang="scss">
	.container {
		display: flex;
		flex-direction: column;
		height: 100%;
		width: 100%;
		background: var(--color-bg);
		color: var(--color-text);
	}

	header {
		display: flex;
		flex-direction: column;
		background: #fff;
		border-bottom: 1px solid var(--color-border);
		z-index: 10;
		transition: all 0.3s ease;
	}

	.header-main {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1.25rem 3rem;
	}

	h1 {
		font-size: 2rem;
		font-weight: 300;
		letter-spacing: 0.25em;
		text-transform: uppercase;
		margin: 0;
		color: var(--color-text);
	}

	.artist-header {
		display: flex;
		gap: 2rem;
		padding: 2rem 3rem;
		border-top: 1px solid var(--color-border-light);
	}

	.artist-thumb {
		width: 140px;
		height: 140px;
		object-fit: cover;
		border-radius: 2px;
		flex-shrink: 0;
	}

	.artist-info {
		flex: 1;
		min-width: 0;
	}

	.artist-name-row {
		display: flex;
		align-items: center;
		gap: 1rem;
		margin-bottom: 0.5rem;

		h2 {
			margin: 0;
			font-size: 2rem;
			font-weight: 400;
			letter-spacing: 0.02em;
			color: var(--color-text);
		}
	}

	.clear-btn {
		background: var(--color-g5);
		border: none;
		color: var(--color-g3);
		width: 32px;
		height: 32px;
		border-radius: 50%;
		font-size: 1.6rem;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.15s;

		&:hover {
			background: var(--color-g4);
			color: var(--color-text);
		}
	}

	.album-count {
		margin: 0 0 1rem;
		font-size: 1rem;
		color: var(--color-g3);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.artist-bio {
		margin: 0 0 1rem;
		font-size: 1.1rem;
		line-height: 1.6;
		color: var(--color-g2);
		max-height: 5.2em;
		overflow: hidden;
		display: -webkit-box;
		-webkit-line-clamp: 3;
		-webkit-box-orient: vertical;
	}

	.discogs-link {
		display: inline-block;
		color: var(--color-g2);
		font-size: 1rem;
		text-decoration: none;
		letter-spacing: 0.02em;
		transition: color 0.15s;

		&:hover {
			color: var(--color-text);
		}
	}

	.collaborators {
		padding: 1.5rem 3rem 2rem;
		border-top: 1px solid var(--color-border-light);
	}

	.collab-label {
		display: block;
		font-size: 0.85rem;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: var(--color-g3);
		margin-bottom: 0.75rem;
	}

	.collab-list {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.collab-link {
		background: var(--color-g5);
		border: 1px solid var(--color-border-light);
		color: var(--color-g1);
		padding: 0.4rem 0.8rem;
		border-radius: 3px;
		font-size: 0.9rem;
		cursor: pointer;
		transition: all 0.15s;

		&:hover {
			background: var(--color-text);
			border-color: var(--color-text);
			color: #fff;
		}
	}

	.main-content {
		flex: 1;
		display: flex;
		overflow: hidden;
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
