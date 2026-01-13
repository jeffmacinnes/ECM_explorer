<script>
	/* This search bar component has a icon (must import), that once clicked on, will slide
  to the left and reveal a simple text input. Typing input will automatically filter a list
  of item appearing below the input field.
  
  */
	import { onMount } from 'svelte';
	import SearchIcon from '$lib/assets/icon_search.svg';

	// Search Bar Behaviors
	let inputRef;
	let isExpanded = false;
	const handleToggleSearchInput = () => {
		if (isExpanded && searchQuery !== '') return; // only collapse if the input is empty
		isExpanded = !isExpanded;
		if (isExpanded) {
			inputRef.focus();
		}
	};

	// Search Query Behaviors
	let searchQuery = '';
	let items = ['apple', 'banana', 'cherry', 'date', 'fig', 'grape', 'kiwi'];
	let filteredItems = [];

	// Reactive statement to filter items based on search query
	$: filteredItems = items.filter((item) => item.toLowerCase().includes(searchQuery.toLowerCase()));

	// $: console.log('searchQuery', searchQuery, filteredItems);
</script>

<div class="search-bar-container {isExpanded ? 'expanded' : ''}">
	<button class="search-icon" on:click={handleToggleSearchInput}>
		<img src={SearchIcon} alt="Search Icon" />
	</button>
	<input bind:this={inputRef} type="text" bind:value={searchQuery} />
	{#if searchQuery}
		<div class="dropdown">
			{#if filteredItems.length > 0}
				{#each filteredItems as item}
					<div class="dropdown-item" on:click={() => selectItem(item)}>
						{item}
					</div>
				{/each}
			{:else}
				<div class="no-results">No results found</div>
			{/if}
		</div>
	{/if}
</div>

<style lang="scss">
	.search-bar-container {
		position: relative;
		display: flex;
		align-items: center;
		transition: width 0.3s;
		width: 55px;
		overflow-x: hidden;
	}

	.search-bar-container.expanded {
		width: 300px;
		overflow-x: unset;
	}

	.search-icon {
		cursor: pointer;
		margin-right: 5px;

		img {
			width: 50px;
		}
	}

	.search-icon {
		cursor: pointer;
		margin-right: 5px;
	}

	input {
		outline: none;
		flex-grow: 1;
		font-size: 2rem;
		color: var(--color-base);
		border: none;
		border-bottom: solid 1px var(--color-base);
	}

	.dropdown {
		position: absolute;
		top: 100%;
		left: 0;
		width: 90%;
		max-height: 200px;
		overflow-y: auto;
		border: 1px solid #ccc;
		border-top: none;
		border-radius: 0 0 5px 5px;
		background: white;
		z-index: 1000;
	}

	.dropdown-item {
		padding: 10px;
		cursor: pointer;
	}

	.dropdown-item:hover {
		background-color: #f0f0f0;
	}

	.no-results {
		padding: 10px;
		color: #888;
	}
</style>
