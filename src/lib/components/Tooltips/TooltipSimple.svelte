<script>
	import { onMount } from 'svelte';
	import { positionTooltip } from './tooltipUtils';

	export let x; // x,y will be reactive, updated from the tooltip action
	export let y;
	export let text = 'This is the text that will show up in the tooltip';
	export let placement = 'right'; // 'top', 'bottom', 'left', 'right
	export let offset = {
		x: 25,
		y: 25
	};

	let winW;

	let winH;
	let top = 0;
	let left = 0;
	let ref;

	const updatePlacement = () => {
		if (!ref) return;
		const newPlacement = positionTooltip(ref, { x, y, placement, offset, optimize: true });
		top = newPlacement.top;
		left = newPlacement.left;
		placement = newPlacement.placement;
	};

	onMount(() => {
		updatePlacement();
	});

	$: x, y, updatePlacement();
	$: showTooltip = text.length > 0;
</script>

<svelte:window bind:innerHeight={winH} bind:innerWidth={winW} />
{#if showTooltip}
	<div
		id="tooltip"
		class={`tooltip-wrapper ${placement}`}
		bind:this={ref}
		style="top: {top}px; left: {left}px;"
	>
		<div class="tooltip-content">{@html text}</div>
	</div>
{/if}

<style lang="scss">
	$bg: green;

	.tooltip-wrapper {
		width: 100%;
		max-width: 300px;
		position: absolute;
		z-index: 1000;
		background-color: $bg;
		border-radius: 6px;
		border: 2px solid white;
		padding: 1rem 2rem;
		-webkit-filter: drop-shadow(0px 6px 6px rgba(70, 70, 70, 0.55));
		filter: drop-shadow(0px 6px 6px rgba(70, 70, 70, 0.55));
	}

	.tooltip-content {
		color: white;
		font-family: 'Source Sans Pro', sans-serif;
		font-size: 1.4rem;
		font-weight: 500;
		line-height: 1.33;
	}

	// --- Place tooltip arrows ----------------------------
	.top::after {
		content: '';
		position: absolute;
		width: 15px;
		height: 15px;
		background: $bg;
		transform: translate(-50%, -50%) rotate(45deg);
		border-right: inherit;
		border-bottom: inherit;
		top: calc(100% + 2px);
		left: 50%;
	}

	.bottom::after {
		content: '';
		position: absolute;
		width: 15px;
		height: 15px;
		background: $bg;
		transform: translate(-50%, 50%) rotate(45deg);
		border-top: inherit;
		border-left: inherit;
		top: calc(-8px - 1rem);
		left: 50%;
	}

	.left::after {
		content: '';
		position: absolute;
		width: 15px;
		height: 15px;
		background: $bg;
		transform: translate(-50%, -50%) rotate(45deg);
		border-top: inherit;
		border-right: inherit;
		top: 50%;
		left: calc(100% + 2px);
	}

	.right::after {
		content: '';
		position: absolute;
		width: 15px;
		height: 15px;
		background: $bg;
		transform: translate(-50%, -50%) rotate(45deg);
		border-left: inherit;
		border-bottom: inherit;
		top: 50%;
		left: -2px;
	}
</style>
