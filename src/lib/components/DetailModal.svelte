<script>
	import { onMount } from 'svelte';
	import { selectedNode } from '$lib/stores/graphData.js';
	import { getAlbumDetail, getArtistDetail } from '$lib/stores/detailData.js';

	let detail = null;
	let loading = true;

	const close = () => {
		selectedNode.set(null);
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

	// Load detail when node changes
	$: if ($selectedNode) {
		loading = true;
		detail = null;

		if ($selectedNode.type === 'album') {
			getAlbumDetail($selectedNode.id).then(d => {
				detail = d;
				loading = false;
			});
		} else {
			getArtistDetail($selectedNode.id).then(d => {
				detail = d;
				loading = false;
			});
		}
	}

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
		<button class="close-btn" on:click={close}>×</button>

		{#if loading}
			<div class="loading">Loading...</div>
		{:else if detail}
			{#if $selectedNode.type === 'album'}
				<!-- Album Detail -->
				<div class="album-detail">
					<div class="album-header">
						{#if detail.localThumb}
							<img src={detail.localThumb} alt={detail.title} class="album-cover" />
						{:else if detail.coverUrl}
							<img src={detail.coverUrl} alt={detail.title} class="album-cover" />
						{:else}
							<div class="album-cover placeholder"></div>
						{/if}

						<div class="album-info">
							<h2>{detail.title}</h2>
							<p class="artist">{detail.artist}</p>
							<p class="meta">
								{detail.catalogNumber}
								{#if detail.year} · {detail.year}{/if}
							</p>
						</div>
					</div>

					{#if detail.credits && detail.credits.length > 0}
						<div class="credits">
							<h3>Personnel</h3>
							<ul>
								{#each detail.credits as credit}
									<li>
										<span class="role">{credit.role}</span>
									</li>
								{/each}
							</ul>
						</div>
					{/if}

					{#if detail.review}
						<div class="review">
							<h3>Review</h3>
							<p>{detail.review}</p>
						</div>
					{/if}
				</div>
			{:else}
				<!-- Artist Detail -->
				<div class="artist-detail">
					<div class="artist-header">
						{#if detail.localImage}
							<img src={detail.localImage} alt={detail.name} class="artist-photo" />
						{:else if detail.imageUrl}
							<img src={detail.imageUrl} alt={detail.name} class="artist-photo" />
						{:else}
							<div class="artist-photo placeholder"></div>
						{/if}

						<div class="artist-info">
							<h2>{detail.name}</h2>
							{#if detail.realName && detail.realName !== detail.name}
								<p class="real-name">{detail.realName}</p>
							{/if}
							{#if detail.instruments && detail.instruments.length > 0}
								<p class="instruments">{detail.instruments.join(', ')}</p>
							{/if}
							<p class="album-count">{detail.albumCount} album{detail.albumCount !== 1 ? 's' : ''}</p>
						</div>
					</div>

					{#if detail.profile}
						<div class="profile">
							<h3>Bio</h3>
							<p>{detail.profile}</p>
						</div>
					{/if}
				</div>
			{/if}
		{:else}
			<div class="error">Could not load details</div>
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
		max-width: 600px;
		width: 100%;
		max-height: 80vh;
		overflow-y: auto;
		position: relative;
		padding: 2rem;
		box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
	}

	.close-btn {
		position: absolute;
		top: 1rem;
		right: 1rem;
		background: none;
		border: none;
		color: var(--color-g3);
		font-size: 2.4rem;
		cursor: pointer;
		line-height: 1;
		padding: 0.5rem;
		transition: color 0.2s;

		&:hover {
			color: var(--color-text);
		}
	}

	.loading, .error {
		text-align: center;
		color: var(--color-g3);
		padding: 2rem;
	}

	// Album Detail
	.album-header, .artist-header {
		display: flex;
		gap: 1.5rem;
		margin-bottom: 2rem;
	}

	.album-cover, .artist-photo {
		width: 150px;
		height: 150px;
		object-fit: cover;
		border-radius: 2px;
		flex-shrink: 0;
		box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);

		&.placeholder {
			background: var(--color-g5);
		}
	}

	.album-info, .artist-info {
		flex: 1;

		h2 {
			font-size: 2rem;
			font-weight: 400;
			margin: 0 0 0.5rem;
			line-height: 1.2;
			color: var(--color-text);
		}

		.artist, .real-name {
			font-size: 1.6rem;
			color: var(--color-g2);
			margin: 0 0 0.5rem;
		}

		.meta, .instruments, .album-count {
			font-size: 1.4rem;
			color: var(--color-g3);
			margin: 0;
		}
	}

	h3 {
		font-size: 1.4rem;
		font-weight: 500;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: var(--color-g3);
		margin: 0 0 1rem;
		padding-bottom: 0.5rem;
		border-bottom: 1px solid var(--color-border-light);
	}

	.credits {
		margin-bottom: 2rem;

		ul {
			list-style: none;
			padding: 0;
			margin: 0;
			display: flex;
			flex-wrap: wrap;
			gap: 0.5rem;
		}

		li {
			font-size: 1.4rem;
			color: var(--color-g2);
			background: var(--color-g5);
			padding: 0.25rem 0.75rem;
			border-radius: 3px;
		}
	}

	.review, .profile {
		p {
			font-size: 1.5rem;
			line-height: 1.6;
			color: var(--color-g2);
			margin: 0;
		}
	}
</style>
