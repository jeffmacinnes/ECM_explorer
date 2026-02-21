<script>
	import { filters } from '$lib/stores/graphData.js';

	let searchValue = '';

	const handleSearch = () => {
		filters.update(f => ({ ...f, search: searchValue }));
	};

	const handleKeydown = (e) => {
		if (e.key === 'Enter') {
			handleSearch();
		}
	};
</script>

<div class="filter-bar">
	<div class="search">
		<input
			type="text"
			placeholder="Search albums, artists..."
			bind:value={searchValue}
			on:keydown={handleKeydown}
			on:input={handleSearch}
		/>
	</div>
</div>

<style lang="scss">
	.filter-bar {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.search {
		input {
			background: var(--color-g5);
			border: 1px solid var(--color-border);
			border-radius: 4px;
			padding: 0.5rem 1rem;
			color: var(--color-text);
			font-size: 1.4rem;
			width: 250px;
			outline: none;
			transition: border-color 0.2s, background 0.2s;

			&::placeholder {
				color: var(--color-g3);
			}

			&:focus {
				border-color: var(--color-g3);
				background: #fff;
			}
		}
	}
</style>
