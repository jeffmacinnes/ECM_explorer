<script>
	export let searchQuery = '';
	export let sortMode = 'year-desc';
</script>

<div class="filter-bar">
	<input
		type="text"
		class="search-input"
		placeholder="Search artist or title…"
		bind:value={searchQuery}
	/>
	<select class="sort-select" bind:value={sortMode}>
		<option value="year-desc">Year (newest)</option>
		<option value="year-asc">Year (oldest)</option>
		<option value="title-asc">Title (A–Z)</option>
	</select>
</div>

<style lang="scss">
	.filter-bar {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.search-input {
		font-family: 'Univers', 'Helvetica Neue', Helvetica, Arial, sans-serif;
		font-size: 14px;
		font-weight: 300;
		padding: 8px 14px;
		border: 1px solid var(--color-border);
		border-radius: 3px;
		background: #fff;
		color: var(--color-text);
		width: 240px;
		outline: none;
		transition: border-color 0.15s;

		&::placeholder {
			color: var(--color-g4);
		}

		&:focus {
			border-color: var(--color-g3);
		}
	}

	.sort-select {
		font-family: 'Univers', 'Helvetica Neue', Helvetica, Arial, sans-serif;
		font-size: 14px;
		font-weight: 300;
		padding: 8px 12px;
		border: 1px solid var(--color-border);
		border-radius: 3px;
		background: #fff;
		color: var(--color-text);
		cursor: pointer;
		outline: none;

		&:focus {
			border-color: var(--color-g3);
		}
	}
</style>
