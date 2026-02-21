<script>
	import { selectedArtist } from '$lib/stores/catalog.js';
	import { createEventDispatcher } from 'svelte';

	export let sortMode = 'year-desc';

	const dispatch = createEventDispatcher();

	const sortOptions = [
		{ value: 'year-desc', label: 'Year (Newest)' },
		{ value: 'year-asc', label: 'Year (Oldest)' },
		{ value: 'title-asc', label: 'Title (A–Z)' },
		{ value: 'catalog', label: 'Catalog Number' }
	];

	const handleSort = (e) => {
		sortMode = e.target.value;
		dispatch('sortChange', sortMode);
	};

	const clearArtist = () => {
		selectedArtist.set(null);
	};
</script>

<div class="spiral-toolbar">
	<div class="sort-control">
		<select value={sortMode} on:change={handleSort}>
			{#each sortOptions as opt}
				<option value={opt.value}>{opt.label}</option>
			{/each}
		</select>
	</div>

	{#if $selectedArtist}
		<button class="artist-pill" on:click={clearArtist}>
			<span class="pill-name">{$selectedArtist.name}</span>
			<span class="pill-close">×</span>
		</button>
	{/if}
</div>

<style lang="scss">
	.spiral-toolbar {
		position: absolute;
		top: 1.25rem;
		right: 1.5rem;
		z-index: 20;
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.sort-control select {
		appearance: none;
		background: rgba(255, 255, 255, 0.85);
		border: 1px solid var(--color-border);
		color: var(--color-g2);
		padding: 0.5rem 2rem 0.5rem 0.75rem;
		font-size: 1.2rem;
		font-family: var(--sans);
		border-radius: 3px;
		cursor: pointer;
		outline: none;
		transition: all 0.15s;
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='rgba(0,0,0,0.3)'/%3E%3C/svg%3E");
		background-repeat: no-repeat;
		background-position: right 0.6rem center;

		&:hover {
			border-color: var(--color-g3);
			color: var(--color-text);
		}

		option {
			background: #fff;
			color: var(--color-text);
		}
	}

	.artist-pill {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		background: var(--color-g5);
		border: 1px solid var(--color-border);
		color: var(--color-text);
		padding: 0.45rem 0.6rem 0.45rem 0.85rem;
		border-radius: 20px;
		font-size: 1.2rem;
		font-family: var(--sans);
		cursor: pointer;
		transition: all 0.15s;

		&:hover {
			background: var(--color-g4);
		}
	}

	.pill-name {
		max-width: 160px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.pill-close {
		font-size: 1.4rem;
		line-height: 1;
		opacity: 0.6;
		transition: opacity 0.15s;

		.artist-pill:hover & {
			opacity: 1;
		}
	}
</style>
