<script>
	import { fade } from 'svelte/transition';

	export let colorScale; // <-- d3.scaleOrdinal
	export let show = false;

	$: labels = colorScale.domain();
	$: colors = colorScale.range();
</script>

<div class="wrapper">
	{#if show}
		<div class="legend-container">
			{#each colors as _, i}
				<div transition:fade|global class="swatch-wrapper">
					<div class="swatch" style:background-color={colors[i]} />
					<div class="label" style:color={colors[i]}>{labels[i]}</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

<style lang="scss">
	.wrapper {
		min-height: 50px;
		max-height: 50px;
		overflow: none;
	}
	.legend-container {
		width: 100%;
		padding: 10px 40px;
		height: 50px;
		display: flex;
		justify-content: space-evenly;
		align-items: center;
		// border: solid 1px red;
	}

	.swatch-wrapper {
		display: flex;
		justify-content: center;
		align-items: center;
		gap: 12px;
		height: 100%;

		.swatch {
			width: 50px;
			height: 90%;
			border: solid 1px white;
		}

		.label {
			font-family: 'Saira Semi Condensed';
			font-weight: 700;
			font-size: 18px;
		}
	}
</style>
