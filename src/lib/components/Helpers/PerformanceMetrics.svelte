<script>
	// Show the performance stats. Need to run 'npm i stats.js' first
	import { onMount, onDestroy } from 'svelte';
	import Stats from 'stats.js';

	// Props with defaults
	export let showFps = true;
	export let showMs = true;
	export let showMem = false;
	export let position = 'top-left'; // Options: 'top-left', 'top-right', 'bottom-left', 'bottom-right'

	let stats;
	let statsContainer;
	let animationFrameId;

	onMount(() => {
		// Initialize stats
		stats = new Stats();

		// Add panels based on props
		if (showFps) stats.showPanel(0); // FPS
		if (showMs) stats.showPanel(1); // MS
		if (showMem) stats.showPanel(2); // MB

		// Position the stats container
		if (statsContainer) {
			statsContainer.appendChild(stats.dom);

			// Apply positioning styles
			const style = stats.dom.style;
			style.position = 'absolute';

			switch (position) {
				case 'top-right':
					style.top = '0px';
					style.right = '0px';
					style.left = 'auto';
					break;
				case 'bottom-left':
					style.bottom = '0px';
					style.left = '0px';
					style.top = 'auto';
					break;
				case 'bottom-right':
					style.bottom = '0px';
					style.right = '0px';
					style.left = 'auto';
					style.top = 'auto';
					break;
				default: // top-left
					style.top = '0px';
					style.left = '0px';
					break;
			}
		}

		// Start animation loop
		const animate = () => {
			stats.begin();

			// Your app rendering would happen here

			stats.end();
			animationFrameId = requestAnimationFrame(animate);
		};

		animate();
	});

	onDestroy(() => {
		// Clean up on component destruction
		if (animationFrameId) {
			cancelAnimationFrame(animationFrameId);
		}
	});
</script>

<div id="performance-metrics" bind:this={statsContainer}></div>

<style lang="scss">
	#performance-metrics {
		position: sticky;
		top: 0;
		z-index: 9999999999; /* Ensure it appears above other content */
	}
</style>
