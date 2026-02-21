<script>
	import { layoutMode } from '$lib/stores/catalog.js';

	const modes = [
		{ id: 'stream', label: 'Stream', key: '1' }
	];

	const setMode = (id) => {
		layoutMode.set(id);
	};

	const handleKeydown = (e) => {
		if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
		const mode = modes.find(m => m.key === e.key);
		if (mode) {
			e.preventDefault();
			setMode(mode.id);
		}
	};
</script>

<svelte:window on:keydown={handleKeydown} />

<div class="layout-switcher">
	{#each modes as mode}
		<button
			class="mode-btn"
			class:active={$layoutMode === mode.id}
			on:click={() => setMode(mode.id)}
			title="Press {mode.key}"
		>
			{mode.label}
		</button>
	{/each}
</div>

<style lang="scss">
	.layout-switcher {
		display: flex;
		gap: 0;
		border: 1px solid var(--color-border);
		border-radius: 4px;
		overflow: hidden;
	}

	.mode-btn {
		background: transparent;
		border: none;
		padding: 0.35rem 0.75rem;
		font-size: 0.8rem;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		color: var(--color-g3);
		cursor: pointer;
		transition: all 0.15s;

		&:not(:last-child) {
			border-right: 1px solid var(--color-border);
		}

		&:hover {
			color: var(--color-g1);
			background: var(--color-g5);
		}

		&.active {
			color: var(--color-text);
			background: var(--color-g5);
			font-weight: 500;
		}
	}
</style>
