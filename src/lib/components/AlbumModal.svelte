<script>
	import { onMount } from 'svelte';
	import { selectedAlbum, selectedArtist, getAlbumWithCredits, artistsByAlbumCount, artistsIndex } from '$lib/stores/catalog.js';

	let albumDetail = null;
	let loading = true;

	// Build artist name lookup map
	$: artistNameMap = new Map($artistsIndex.map(a => [a.id, a.name]));

	const close = () => {
		selectedAlbum.set(null);
	};

	const handleKeydown = (e) => {
		if (e.key === 'Escape') {
			close();
		}
	};

	const handleBackdropClick = (e) => {
		if (e.target === e.currentTarget) {
			close();
		}
	};

	const filterByArtist = (artistId) => {
		const artist = $artistsByAlbumCount.find(a => a.id === artistId);
		if (artist) {
			selectedArtist.set(artist);
			close();
		}
	};

	// Load full album detail with credits
	$: if ($selectedAlbum) {
		loading = true;
		albumDetail = null;

		getAlbumWithCredits($selectedAlbum.id).then(detail => {
			albumDetail = detail;
			loading = false;
		});
	}

	// Group credits by role type
	$: groupedCredits = (() => {
		if (!albumDetail?.credits) return [];

		const groups = new Map();
		for (const credit of albumDetail.credits) {
			const role = credit.role || 'Unknown';
			if (!groups.has(role)) {
				groups.set(role, []);
			}
			groups.get(role).push(credit);
		}

		return Array.from(groups.entries())
			.map(([role, credits]) => ({ role, credits }))
			.sort((a, b) => b.credits.length - a.credits.length);
	})();

	onMount(() => {
		window.addEventListener('keydown', handleKeydown);
		return () => window.removeEventListener('keydown', handleKeydown);
	});
</script>

<div
	class="modal-backdrop"
	on:click={handleBackdropClick}
	on:keydown={handleKeydown}
	role="button"
	tabindex="-1"
>
	<div class="modal">
		<button class="close-btn" on:click={close}>
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<path d="M18 6L6 18M6 6l12 12"/>
			</svg>
		</button>

		{#if loading}
			<div class="loading">Loading...</div>
		{:else if albumDetail}
			<div class="album-detail">
				<div class="album-header">
					<div class="cover-wrapper">
						{#if albumDetail.coverUrl}
							<img
								src={albumDetail.coverUrl}
								alt={albumDetail.title}
								class="album-cover"
							/>
						{:else if albumDetail.localThumb}
							<img
								src={albumDetail.localThumb}
								alt={albumDetail.title}
								class="album-cover"
							/>
						{:else}
							<div class="album-cover placeholder"></div>
						{/if}
					</div>

					<div class="album-info">
						<h2>{albumDetail.title}</h2>
						<p class="artist">{albumDetail.artist}</p>
						<p class="meta">
							<span class="catalog">{albumDetail.catalogNumber}</span>
							{#if albumDetail.year}
								<span class="year">{albumDetail.year}</span>
							{/if}
							{#if albumDetail.series}
								<span class="series">{albumDetail.series}</span>
							{/if}
						</p>
						{#if albumDetail.recordingDate}
							<p class="recording-date">Recorded: {albumDetail.recordingDate}</p>
						{/if}
					</div>
				</div>

				{#if groupedCredits.length > 0}
					<div class="credits-section">
						<h3>Personnel</h3>
						<div class="credits-list">
							{#each groupedCredits as { role, credits }}
								<div class="credit-group">
									<span class="role-label">{role}</span>
									<div class="artists">
										{#each credits as credit}
											<button
												class="artist-btn"
												on:click={() => filterByArtist(credit.artistId)}
												title="Show all albums with this artist"
											>
												{artistNameMap.get(credit.artistId) || credit.artistId}
												<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
													<path d="M9 18l6-6-6-6"/>
												</svg>
											</button>
										{/each}
									</div>
								</div>
							{/each}
						</div>
					</div>
				{/if}

				{#if albumDetail.review}
					<div class="review-section">
						<h3>Review</h3>
						<p class="review-text">{albumDetail.review}</p>
						{#if albumDetail.reviewUrl}
							<a href={albumDetail.reviewUrl} target="_blank" rel="noopener" class="review-link">
								Read full review →
							</a>
						{/if}
					</div>
				{/if}

				{#if albumDetail.styles?.length > 0}
					<div class="tags-section">
						<div class="tags">
							{#each albumDetail.styles as style}
								<span class="tag">{style}</span>
							{/each}
						</div>
					</div>
				{/if}
			</div>
		{:else}
			<div class="error">Could not load album details</div>
		{/if}
	</div>
</div>

<style lang="scss">
	.modal-backdrop {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.4);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 100;
		padding: 2rem;
		backdrop-filter: blur(4px);
	}

	.modal {
		background: #fff;
		border: 1px solid var(--color-border);
		border-radius: 8px;
		max-width: 700px;
		width: 100%;
		max-height: 85vh;
		overflow-y: auto;
		position: relative;
		padding: 2.5rem;
		box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);

		&::-webkit-scrollbar {
			width: 6px;
		}

		&::-webkit-scrollbar-track {
			background: transparent;
		}

		&::-webkit-scrollbar-thumb {
			background: var(--color-g4);
			border-radius: 3px;
		}
	}

	.close-btn {
		position: absolute;
		top: 1.5rem;
		right: 1.5rem;
		background: var(--color-g5);
		border: none;
		border-radius: 50%;
		width: 36px;
		height: 36px;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		color: var(--color-g3);
		transition: all 0.15s ease;

		&:hover {
			background: var(--color-g4);
			color: var(--color-text);
		}

		svg {
			width: 18px;
			height: 18px;
		}
	}

	.loading, .error {
		text-align: center;
		color: var(--color-g3);
		padding: 3rem;
		font-size: 1.4rem;
	}

	.album-header {
		display: flex;
		gap: 2rem;
		margin-bottom: 2.5rem;
	}

	.cover-wrapper {
		flex-shrink: 0;
	}

	.album-cover {
		width: 200px;
		height: 200px;
		object-fit: cover;
		border-radius: 2px;
		box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);

		&.placeholder {
			background: var(--color-g5);
		}
	}

	.album-info {
		flex: 1;
		min-width: 0;

		h2 {
			font-size: 2.4rem;
			font-weight: 400;
			margin: 0 0 0.5rem;
			line-height: 1.2;
			padding-right: 3rem;
			color: var(--color-text);
		}

		.artist {
			font-size: 1.8rem;
			color: var(--color-g2);
			margin: 0 0 1rem;
		}

		.meta {
			display: flex;
			flex-wrap: wrap;
			gap: 0.5rem;
			margin: 0 0 0.5rem;

			span {
				font-size: 1.3rem;
				padding: 0.25rem 0.75rem;
				background: var(--color-g5);
				border-radius: 3px;
				color: var(--color-g2);
			}

			.catalog {
				color: var(--color-text);
				font-weight: 500;
			}
		}

		.recording-date {
			font-size: 1.3rem;
			color: var(--color-g3);
			margin: 0.75rem 0 0;
		}
	}

	h3 {
		font-size: 1.2rem;
		font-weight: 500;
		text-transform: uppercase;
		letter-spacing: 0.15em;
		color: var(--color-g3);
		margin: 0 0 1rem;
		padding-bottom: 0.5rem;
		border-bottom: 1px solid var(--color-border-light);
	}

	.credits-section {
		margin-bottom: 2rem;
	}

	.credits-list {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.credit-group {
		display: flex;
		gap: 1rem;
		align-items: flex-start;

		.role-label {
			min-width: 120px;
			font-size: 1.3rem;
			color: var(--color-g3);
			padding-top: 0.4rem;
		}

		.artists {
			display: flex;
			flex-wrap: wrap;
			gap: 0.5rem;
			flex: 1;
		}
	}

	.artist-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		background: var(--color-g5);
		border: 1px solid var(--color-border);
		border-radius: 3px;
		padding: 0.4rem 0.75rem;
		color: var(--color-text);
		font-size: 1.3rem;
		cursor: pointer;
		transition: all 0.15s ease;

		svg {
			width: 14px;
			height: 14px;
			opacity: 0;
			margin-left: -0.25rem;
			transition: all 0.15s ease;
		}

		&:hover {
			background: var(--color-text);
			border-color: var(--color-text);
			color: #fff;

			svg {
				opacity: 1;
				margin-left: 0.25rem;
			}
		}
	}

	.review-section {
		margin-bottom: 2rem;

		.review-text {
			font-size: 1.4rem;
			line-height: 1.7;
			color: var(--color-g2);
			margin: 0 0 1rem;
		}

		.review-link {
			font-size: 1.3rem;
			color: var(--color-g1);
			text-decoration: none;
			font-weight: 500;

			&:hover {
				text-decoration: underline;
			}
		}
	}

	.tags-section {
		.tags {
			display: flex;
			flex-wrap: wrap;
			gap: 0.5rem;
		}

		.tag {
			font-size: 1.2rem;
			padding: 0.3rem 0.75rem;
			background: var(--color-g5);
			border-radius: 20px;
			color: var(--color-g2);
		}
	}
</style>
