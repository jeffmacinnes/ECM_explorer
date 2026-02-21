<script>
	import { artistsByAlbumCount, selectedArtist } from '$lib/stores/catalog.js';

	let searchQuery = '';
	let isOpen = false;
	let inputEl;

	$: filteredArtists = $artistsByAlbumCount.filter(artist => {
		if (!searchQuery) return true;
		return artist.name.toLowerCase().includes(searchQuery.toLowerCase());
	}).slice(0, 50); // Limit for performance

	const handleSelect = (artist) => {
		selectedArtist.set(artist);
		searchQuery = '';
		isOpen = false;
	};

	const handleClear = () => {
		selectedArtist.set(null);
		searchQuery = '';
	};

	const handleFocus = () => {
		isOpen = true;
	};

	const handleBlur = (e) => {
		// Delay to allow click on dropdown items
		setTimeout(() => {
			isOpen = false;
		}, 150);
	};

	const handleKeydown = (e) => {
		if (e.key === 'Escape') {
			isOpen = false;
			inputEl?.blur();
		}
	};
</script>

<div class="artist-filter">
	{#if $selectedArtist}
		<div class="active-filter">
			<span class="filter-label">Filtered by</span>
			<button class="filter-pill" on:click={handleClear}>
				<span class="pill-name">{$selectedArtist.name}</span>
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M18 6L6 18M6 6l12 12"/>
				</svg>
			</button>
		</div>
	{:else}
		<div class="input-wrapper">
			<svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<circle cx="11" cy="11" r="8"/>
				<path d="m21 21-4.35-4.35"/>
			</svg>

			<input
				bind:this={inputEl}
				type="text"
				placeholder="Filter by artist..."
				bind:value={searchQuery}
				on:focus={handleFocus}
				on:blur={handleBlur}
				on:keydown={handleKeydown}
			/>
		</div>

		{#if isOpen && filteredArtists.length > 0}
			<div class="dropdown">
				{#each filteredArtists as artist}
					<button
						class="artist-option"
						on:mousedown={() => handleSelect(artist)}
					>
						<span class="name">{artist.name}</span>
						<span class="count">{artist.albumCount} album{artist.albumCount !== 1 ? 's' : ''}</span>
					</button>
				{/each}
			</div>
		{/if}
	{/if}
</div>

<style lang="scss">
	.artist-filter {
		position: relative;
		min-width: 300px;
	}

	.active-filter {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.filter-label {
		font-size: 1.2rem;
		color: var(--color-g3);
		text-transform: uppercase;
		letter-spacing: 0.1em;
	}

	.filter-pill {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		background: var(--color-text);
		border: none;
		border-radius: 20px;
		padding: 0.5rem 0.75rem 0.5rem 1rem;
		color: #fff;
		font-size: 1.4rem;
		font-weight: 400;
		cursor: pointer;
		transition: all 0.15s ease;

		&:hover {
			background: var(--color-black);
			transform: scale(1.02);
		}

		svg {
			width: 16px;
			height: 16px;
			opacity: 0.6;
			transition: opacity 0.15s ease;
		}

		&:hover svg {
			opacity: 1;
		}
	}

	.pill-name {
		max-width: 200px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.input-wrapper {
		position: relative;
		display: flex;
		align-items: center;
	}

	.search-icon {
		position: absolute;
		left: 1rem;
		width: 18px;
		height: 18px;
		color: var(--color-g3);
		pointer-events: none;
	}

	input {
		width: 100%;
		background: var(--color-g5);
		border: 1px solid var(--color-border);
		border-radius: 6px;
		padding: 0.8rem 1rem 0.8rem 2.8rem;
		color: var(--color-text);
		font-size: 1.5rem;
		outline: none;
		transition: all 0.2s ease;

		&::placeholder {
			color: var(--color-g3);
		}

		&:focus {
			border-color: var(--color-g3);
			background: #fff;
		}
	}

	.dropdown {
		position: absolute;
		top: 100%;
		left: 0;
		right: 0;
		margin-top: 4px;
		background: #fff;
		border: 1px solid var(--color-border);
		border-radius: 6px;
		max-height: 400px;
		overflow-y: auto;
		z-index: 100;
		box-shadow: 0 8px 30px rgba(0, 0, 0, 0.1);

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

	.artist-option {
		display: flex;
		justify-content: space-between;
		align-items: center;
		width: 100%;
		padding: 0.75rem 1rem;
		background: none;
		border: none;
		border-bottom: 1px solid var(--color-border-light);
		color: var(--color-text);
		cursor: pointer;
		text-align: left;
		transition: background 0.1s ease;

		&:last-child {
			border-bottom: none;
		}

		&:hover {
			background: var(--color-hover);
		}

		.name {
			font-size: 1.4rem;
		}

		.count {
			font-size: 1.2rem;
			color: var(--color-g3);
		}
	}
</style>
