<script>
	import { createEventDispatcher, onDestroy } from 'svelte';
	import { artistsIndex, selectedArtist, artistsByAlbumCount, catalogData } from '$lib/stores/catalog.js';
	import { getAlbumDetail } from '$lib/stores/detailData.js';
	import { fetchDeezerTracks, matchTracks } from '$lib/services/deezer.js';
	import { playTrack, pauseTrack, resumeTrack, stopPlayback, playingTrack, isPlaying, playbackProgress } from '$lib/stores/audio.js';

	export let activeAlbum = null;
	export let albums = [];

	const dispatch = createEventDispatcher();

	// Search state
	let searchQuery = '';
	let searchOpen = false;
	let searchInput;
	let selectedResultIdx = -1;

	// Detail panel state
	let albumDetail = null;
	let detailLoading = false;
	let creditsExpanded = false;
	let lastDetailId = null;

	// Audio preview state
	let augmentedTracklist = null;
	let deezerLoading = false;
	let lastDeezerId = null;

	// Artist name lookup
	$: artistNameMap = new Map($artistsIndex.map(a => [a.id, a.name]));

	// Credits from the startup-loaded credits store (instant, no fetch needed)
	$: albumCredits = (() => {
		if (!activeAlbum || !$catalogData?.credits) return [];
		return $catalogData.credits.filter(c => c.albumId === activeAlbum.id);
	})();

	// Group credits by role
	$: groupedCredits = (() => {
		const source = albumDetail?.credits || albumCredits;
		if (!source?.length) return [];

		const groups = new Map();
		for (const credit of source) {
			const role = credit.role || 'Unknown';
			if (!groups.has(role)) groups.set(role, []);
			groups.get(role).push(credit);
		}

		return Array.from(groups.entries())
			.map(([role, credits]) => ({ role, credits }))
			.sort((a, b) => {
				if (a.role === 'Primary Artist') return -1;
				if (b.role === 'Primary Artist') return 1;
				return b.credits.length - a.credits.length;
			});
	})();

	// Load detail when active album changes
	$: if (activeAlbum && activeAlbum.id !== lastDetailId) {
		lastDetailId = activeAlbum.id;
		creditsExpanded = false;
		augmentedTracklist = null;
		lastDeezerId = null;
		detailLoading = true;
		getAlbumDetail(activeAlbum.id).then(detail => {
			if (detail && activeAlbum?.id === detail.id) {
				albumDetail = detail;
			}
			detailLoading = false;
		});
	}

	// Clear detail when no album
	$: if (!activeAlbum) {
		albumDetail = null;
		lastDetailId = null;
		creditsExpanded = false;
		augmentedTracklist = null;
		lastDeezerId = null;
	}

	// Fetch Deezer tracks when album detail loads and has deezerId
	$: if (albumDetail && activeAlbum?.deezerId && activeAlbum.deezerId !== lastDeezerId) {
		lastDeezerId = activeAlbum.deezerId;
		deezerLoading = true;
		fetchDeezerTracks(activeAlbum.deezerId).then(deezerTracks => {
			if (deezerTracks && activeAlbum?.deezerId === lastDeezerId) {
				augmentedTracklist = matchTracks(albumDetail?.tracklist, deezerTracks);
			}
			deezerLoading = false;
		});
	}

	// Use augmented tracklist (with previewUrls) if available, else fall back to detail tracklist
	$: displayTracklist = augmentedTracklist || albumDetail?.tracklist || [];

	// Check if a track is currently playing
	const isTrackPlaying = (trackIndex) => {
		return $playingTrack?.albumId === activeAlbum?.id && $playingTrack?.trackIndex === trackIndex;
	};

	const toggleTrack = (track, index) => {
		if (!track.previewUrl) return;
		if (isTrackPlaying(index)) {
			if ($isPlaying) {
				pauseTrack();
			} else {
				resumeTrack();
			}
		} else {
			playTrack(activeAlbum.id, index, track.title, track.previewUrl);
		}
	};

	onDestroy(() => {
		stopPlayback();
	});

	const filterByArtist = (artistId) => {
		const artist = $artistsByAlbumCount.find(a => a.id === artistId);
		if (artist) {
			selectedArtist.set(artist);
		}
	};

	const formatRating = (rating) => {
		if (!rating || rating === 0) return null;
		return rating.toFixed(1);
	};

	const formatNumber = (n) => {
		if (!n) return '0';
		return n.toLocaleString();
	};

	// Search
	$: results = (() => {
		if (!searchQuery || searchQuery.length < 2) return [];
		const q = searchQuery.toLowerCase();

		const matches = [];
		for (let i = 0; i < albums.length; i++) {
			const a = albums[i];
			const titleMatch = a.title?.toLowerCase().includes(q);
			const artistMatch = a.artist?.toLowerCase().includes(q);
			const catalogMatch = a.catalogNumber?.toLowerCase().includes(q);

			if (titleMatch || artistMatch || catalogMatch) {
				matches.push({
					album: a,
					index: i,
					matchType: catalogMatch ? 'catalog' : artistMatch ? 'artist' : 'title'
				});
			}
			if (matches.length >= 30) break;
		}

		const grouped = new Map();
		for (const m of matches) {
			const key = m.album.artist;
			if (!grouped.has(key)) grouped.set(key, []);
			grouped.get(key).push(m);
		}

		return Array.from(grouped.entries()).map(([artist, items]) => ({
			artist,
			items
		}));
	})();

	$: flatResults = results.flatMap(g => g.items);

	const openSearch = () => {
		searchOpen = true;
		searchQuery = '';
		selectedResultIdx = -1;
		requestAnimationFrame(() => searchInput?.focus());
	};

	const closeSearch = () => {
		searchOpen = false;
		searchQuery = '';
		selectedResultIdx = -1;
	};

	const selectResult = (item) => {
		dispatch('navigateTo', item.index);
		closeSearch();
	};

	const handleSearchKey = (e) => {
		if (e.key === 'Escape') {
			closeSearch();
		} else if (e.key === 'ArrowDown') {
			e.preventDefault();
			selectedResultIdx = Math.min(selectedResultIdx + 1, flatResults.length - 1);
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			selectedResultIdx = Math.max(selectedResultIdx - 1, -1);
		} else if (e.key === 'Enter' && selectedResultIdx >= 0) {
			e.preventDefault();
			selectResult(flatResults[selectedResultIdx]);
		}
	};

	const handleGlobalKey = (e) => {
		if (e.key === '/' && !searchOpen) {
			e.preventDefault();
			openSearch();
		}
	};
</script>

<svelte:window on:keydown={handleGlobalKey} />

<div class="spiral-overlay">
	<div class="info-panel">
		{#if activeAlbum}
			<div class="info-scroll">
				<div class="info-spacer"></div>
				<!-- Core info -->
				<span class="info-catalog">{activeAlbum.catalogNumber}</span>
				<h2 class="info-title">{activeAlbum.title}</h2>
				<p class="info-artist">{activeAlbum.artist}</p>
				{#if activeAlbum.year}
					<p class="info-year">{activeAlbum.year}</p>
				{/if}

				<!-- Community rating -->
				{#if activeAlbum.community?.rating}
					<div class="info-rating">
						<span class="rating-stars">
							{'★'.repeat(Math.round(activeAlbum.community.rating))}{'☆'.repeat(5 - Math.round(activeAlbum.community.rating))}
						</span>
						<span class="rating-value">{formatRating(activeAlbum.community.rating)}</span>
						{#if activeAlbum.community.ratingCount}
							<span class="rating-count">({formatNumber(activeAlbum.community.ratingCount)})</span>
						{/if}
					</div>
				{/if}

				{#if activeAlbum.community?.have || activeAlbum.community?.want}
					<p class="info-community">
						{formatNumber(activeAlbum.community.have)} have · {formatNumber(activeAlbum.community.want)} want
					</p>
				{/if}

				<!-- Genres & styles -->
				{#if activeAlbum.genres?.length || activeAlbum.styles?.length}
					<div class="info-tags">
						{#each activeAlbum.genres || [] as genre}
							<span class="tag genre">{genre}</span>
						{/each}
						{#each activeAlbum.styles || [] as style}
							<span class="tag style">{style}</span>
						{/each}
					</div>
				{/if}

				<!-- Credits (expandable) -->
				{#if groupedCredits.length > 0}
					<button class="section-toggle" on:click={() => creditsExpanded = !creditsExpanded}>
						<span class="toggle-arrow" class:expanded={creditsExpanded}>▸</span>
						Credits ({albumCredits.length})
					</button>

					{#if creditsExpanded}
						<div class="credits-list">
							{#each groupedCredits as { role, credits }}
								<div class="credit-row">
									<span class="credit-role">{role}</span>
									<span class="credit-names">
										{#each credits as credit, i}
											<button
												class="artist-link"
												on:click|stopPropagation={() => filterByArtist(credit.artistId)}
											>{artistNameMap.get(credit.artistId) || '?'}</button>{#if i < credits.length - 1},&nbsp;{/if}
										{/each}
									</span>
								</div>
							{/each}
						</div>
					{/if}
				{/if}

				<!-- Tracklist with audio previews -->
				{#if displayTracklist.length}
					<div class="section-label">Tracklist</div>
					<div class="tracklist">
						{#each displayTracklist as track, i}
							{@const playing = isTrackPlaying(i)}
							{@const showingProgress = playing && $isPlaying}
							<div
								class="track-row"
								class:track-playing={playing}
								class:track-paused={playing && !$isPlaying}
							>
								{#if track.previewUrl}
									<button class="track-play-btn" on:click={() => toggleTrack(track, i)}>
										{#if playing && $isPlaying}
											<svg width="12" height="12" viewBox="0 0 12 12">
												<rect x="1.5" y="1" width="3" height="10" rx="0.5" fill="currentColor"/>
												<rect x="7.5" y="1" width="3" height="10" rx="0.5" fill="currentColor"/>
											</svg>
										{:else}
											<svg width="12" height="12" viewBox="0 0 12 12">
												<path d="M2.5 1L10.5 6L2.5 11Z" fill="currentColor"/>
											</svg>
										{/if}
									</button>
								{:else}
									<span class="track-pos">{track.position}</span>
								{/if}
								<span class="track-title">{track.title}</span>
								{#if track.duration}
									<span class="track-dur">{track.duration}</span>
								{/if}
								{#if showingProgress}
									<div class="track-progress" style="width: {$playbackProgress * 100}%"></div>
								{/if}
							</div>
						{/each}
					</div>
				{/if}

				<!-- Links -->
				<div class="info-links">
					{#if activeAlbum.reviewUrl}
						<a href={activeAlbum.reviewUrl} target="_blank" rel="noopener">
							Review ↗
						</a>
					{/if}
					{#if activeAlbum.discogsUrl}
						<a href={activeAlbum.discogsUrl} target="_blank" rel="noopener">
							Discogs ↗
						</a>
					{/if}
				</div>
			</div>
		{/if}
	</div>

	<div class="search-area">
		{#if searchOpen}
			<div class="search-backdrop" on:click={closeSearch} on:keydown={() => {}} role="button" tabindex="-1"></div>
			<div class="search-container">
				<input
					bind:this={searchInput}
					bind:value={searchQuery}
					on:keydown={handleSearchKey}
					class="search-input"
					type="text"
					placeholder="Search albums, artists, catalog..."
					spellcheck="false"
				/>
				{#if results.length > 0}
					<div class="search-results">
						{#each results as group}
							<div class="result-group">
								<div class="group-label">{group.artist}</div>
								{#each group.items as item}
									{@const idx = flatResults.indexOf(item)}
									<button
										class="result-item"
										class:selected={idx === selectedResultIdx}
										on:click={() => selectResult(item)}
									>
										<span class="result-catalog">{item.album.catalogNumber}</span>
										<span class="result-title">{item.album.title}</span>
										{#if item.album.year}
											<span class="result-year">{item.album.year}</span>
										{/if}
									</button>
								{/each}
							</div>
						{/each}
					</div>
				{:else if searchQuery.length >= 2}
					<div class="search-empty">No results</div>
				{/if}
			</div>
		{:else}
			<button class="search-trigger" on:click={openSearch}>
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<circle cx="11" cy="11" r="8"/>
					<path d="M21 21l-4.35-4.35"/>
				</svg>
				<span class="search-hint">/</span>
			</button>
		{/if}
	</div>
</div>

<style lang="scss">
	.spiral-overlay {
		position: absolute;
		inset: 0;
		pointer-events: none;
		z-index: 10;
	}

	/* ─── Info panel ─── */

	.info-panel {
		position: absolute;
		left: 0;
		top: 0;
		bottom: 0;
		width: 35%;
		min-width: 280px;
		max-width: 420px;
		display: flex;
		flex-direction: column;
		background: linear-gradient(to right, rgba(255, 255, 255, 0.94) 60%, transparent);
		pointer-events: auto;
	}

	.info-scroll {
		flex: 1;
		overflow-y: auto;
		padding: 0 3rem 2rem;
		display: flex;
		flex-direction: column;
		min-height: 0;

		&::-webkit-scrollbar {
			width: 4px;
		}
		&::-webkit-scrollbar-track {
			background: transparent;
		}
		&::-webkit-scrollbar-thumb {
			background: var(--color-g4);
			border-radius: 2px;
		}
	}

	.info-spacer {
		flex: 0 0 calc(50% - 100px);
		min-height: 2rem;
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
		margin: 0 0 1rem;
		letter-spacing: 0.1em;
	}

	/* Rating */
	.info-rating {
		display: flex;
		align-items: baseline;
		gap: 0.4rem;
		margin-bottom: 0.25rem;
	}

	.rating-stars {
		color: var(--color-g2);
		font-size: 1.1rem;
		letter-spacing: 0.05em;
	}

	.rating-value {
		font-size: 1.2rem;
		font-weight: 500;
		color: var(--color-text);
	}

	.rating-count {
		font-size: 1rem;
		color: var(--color-g3);
	}

	.info-community {
		font-size: 1rem;
		color: var(--color-g3);
		margin: 0 0 1rem;
	}

	/* Tags */
	.info-tags {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
		margin-bottom: 1.25rem;
	}

	.tag {
		font-size: 0.85rem;
		padding: 0.2rem 0.6rem;
		border-radius: 2px;
		color: var(--color-g2);
		background: rgba(0, 0, 0, 0.04);
	}

	/* Credits */
	.section-toggle {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		background: none;
		border: none;
		padding: 0.5rem 0;
		font-size: 1rem;
		font-weight: 500;
		color: var(--color-g2);
		cursor: pointer;
		font-family: inherit;
		letter-spacing: 0.05em;

		&:hover {
			color: var(--color-text);
		}
	}

	.toggle-arrow {
		display: inline-block;
		transition: transform 0.15s;
		font-size: 0.9rem;

		&.expanded {
			transform: rotate(90deg);
		}
	}

	.credits-list {
		padding: 0.5rem 0 0.75rem 0.25rem;
	}

	.credit-row {
		display: flex;
		gap: 0.75rem;
		padding: 0.2rem 0;
		font-size: 0.95rem;
		line-height: 1.5;
	}

	.credit-role {
		color: var(--color-g3);
		min-width: 80px;
		flex-shrink: 0;
		font-size: 0.85rem;
		padding-top: 0.1rem;
	}

	.credit-names {
		color: var(--color-text);
		flex: 1;
	}

	.artist-link {
		background: none;
		border: none;
		padding: 0;
		color: var(--color-text);
		cursor: pointer;
		font-family: inherit;
		font-size: inherit;
		text-decoration: none;
		border-bottom: 1px solid transparent;
		transition: border-color 0.15s;

		&:hover {
			border-bottom-color: var(--color-text);
		}
	}

	/* Tracklist */
	.section-label {
		font-size: 1rem;
		font-weight: 500;
		color: var(--color-g2);
		letter-spacing: 0.05em;
		padding: 0.75rem 0 0.4rem;
	}

	.tracklist {
		padding-bottom: 0.75rem;
	}

	.track-row {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.2rem 0;
		font-size: 0.9rem;
		line-height: 1.5;
		position: relative;
		border-radius: 2px;
		transition: background 0.15s;

		&.track-playing {
			background: rgba(0, 0, 0, 0.04);
		}

		&.track-paused {
			background: rgba(0, 0, 0, 0.02);
		}
	}

	.track-pos {
		color: var(--color-g4);
		min-width: 24px;
		text-align: right;
		flex-shrink: 0;
	}

	.track-play-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
		min-width: 24px;
		background: none;
		border: 1px solid var(--color-g4);
		border-radius: 50%;
		color: var(--color-g2);
		cursor: pointer;
		padding: 0;
		flex-shrink: 0;
		transition: all 0.15s;

		&:hover {
			color: var(--color-text);
			border-color: var(--color-g2);
		}
	}

	.track-playing .track-play-btn {
		color: var(--color-text);
		border-color: var(--color-text);
	}

	.track-title {
		color: var(--color-g1);
		flex: 1;
	}

	.track-dur {
		color: var(--color-g3);
		flex-shrink: 0;
		font-variant-numeric: tabular-nums;
	}

	.track-progress {
		position: absolute;
		bottom: 0;
		left: 0;
		height: 1px;
		background: var(--color-text);
		transition: width 0.1s linear;
	}

	/* Links */
	.info-links {
		display: flex;
		gap: 1.25rem;
		padding-top: 1rem;

		a {
			font-size: 0.9rem;
			color: var(--color-g3);
			text-decoration: none;
			transition: color 0.15s;

			&:hover {
				color: var(--color-text);
			}
		}
	}

	/* ─── Search ─── */

	.search-area {
		position: absolute;
		top: 1.25rem;
		left: 1.5rem;
		pointer-events: auto;
	}

	.search-trigger {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		background: rgba(255, 255, 255, 0.8);
		border: 1px solid var(--color-border);
		border-radius: 4px;
		padding: 0.5rem 0.75rem;
		color: var(--color-g3);
		cursor: pointer;
		transition: all 0.15s;

		&:hover {
			background: rgba(255, 255, 255, 0.95);
			color: var(--color-text);
			border-color: var(--color-g3);
		}
	}

	.search-hint {
		font-size: 0.75rem;
		padding: 0.1rem 0.4rem;
		border: 1px solid var(--color-g4);
		border-radius: 3px;
		color: var(--color-g4);
		font-family: var(--mono, monospace);
	}

	.search-backdrop {
		position: fixed;
		inset: 0;
		z-index: -1;
	}

	.search-container {
		width: 320px;
	}

	.search-input {
		width: 100%;
		padding: 0.75rem 1rem;
		font-size: 1.3rem;
		font-family: var(--sans);
		border: 1px solid var(--color-g4);
		border-radius: 4px;
		background: rgba(255, 255, 255, 0.95);
		color: var(--color-text);
		outline: none;
		transition: border-color 0.15s;

		&:focus {
			border-color: var(--color-g2);
		}
	}

	.search-results {
		margin-top: 4px;
		background: rgba(255, 255, 255, 0.97);
		border: 1px solid var(--color-border);
		border-radius: 4px;
		max-height: 400px;
		overflow-y: auto;
		box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
	}

	.result-group {
		&:not(:first-child) {
			border-top: 1px solid var(--color-border-light);
		}
	}

	.group-label {
		padding: 0.5rem 1rem 0.25rem;
		font-size: 0.8rem;
		font-weight: 500;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: var(--color-g3);
	}

	.result-item {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		width: 100%;
		padding: 0.5rem 1rem;
		background: none;
		border: none;
		text-align: left;
		cursor: pointer;
		font-family: var(--sans);
		transition: background 0.1s;

		&:hover, &.selected {
			background: var(--color-g5);
		}
	}

	.result-catalog {
		font-size: 0.75rem;
		color: var(--color-g3);
		letter-spacing: 0.05em;
		min-width: 72px;
	}

	.result-title {
		font-size: 1rem;
		color: var(--color-text);
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.result-year {
		font-size: 0.8rem;
		color: var(--color-g4);
	}

	.search-empty {
		padding: 1rem;
		text-align: center;
		color: var(--color-g3);
		font-size: 1rem;
		background: rgba(255, 255, 255, 0.97);
		border: 1px solid var(--color-border);
		border-radius: 4px;
		margin-top: 4px;
	}
</style>
