<script>
	/* Menu that slides up from the bottom of the screen */
	import { fly } from 'svelte/transition';
	import { onMount, onDestroy } from 'svelte';

	export let containerH = 100;
	export let topPadding = 50;
	export let toggleButtonH = 45; // how much space to use for toggle button at top

	const toggleMenu = () => {
		menuOpen = !menuOpen;
		translateH = menuOpen ? topPadding : containerH - toggleButtonH; // if closed, translate down so just the controls are visibile
	};

	let menuOpen = false;
	let mobile_spacing = 0;
	$: bottomOffset = isPhone ? mobile_spacing : 0;
	$: translateH = menuOpen ? topPadding : containerH - toggleButtonH - bottomOffset;

	let isPhone = false;
	onMount(() => {
		// Initial screen width check
		let screenWidth = window.innerWidth;
		isPhone = screenWidth < 480;

		// Add resize listener
		const handleResize = () => {
			screenWidth = window.innerWidth;
			isPhone = screenWidth < 480;
		};

		window.addEventListener('resize', handleResize);

		// Cleanup
		return () => {
			window.removeEventListener('resize', handleResize);
		};
	});
</script>

<article class="menu-wrapper">
	<div
		class="menu-container"
		style="height: {containerH - topPadding}px; transform: translateY({translateH}px"
	>
		<div class="controls-container" style="height: {toggleButtonH}px">
			<button class="menu-button" on:click={toggleMenu}>
				{menuOpen ? 'Close Menu' : 'Open Menu'}
			</button>
		</div>
		{#if isPhone && !menuOpen}
			<div class="spacer" style="height: {mobile_spacing}px" />
		{/if}
		<div class="menu-content" style="height: calc(100% - {toggleButtonH}px)">
			<slot />
		</div>
	</div>
</article>

<style lang="scss">
	.menu-wrapper {
		position: fixed;
		width: calc(100% - 4rem);
		left: 50%;
		transform: translate(-50%, 0%);
		height: 100%;
		pointer-events: none;
	}

	.menu-container {
		width: 100%;
		background: white;
		padding: 0 2rem;
		border-top-left-radius: 1rem;
		border-top-right-radius: 1rem;
		transition: transform 0.3s ease-in-out;
		pointer-events: auto;
		box-shadow: var(--shadow-pse-dark);
		border: solid 1px black;
	}

	.controls-container {
		width: 100%;
		display: flex;
		justify-content: center;
		padding: 10px 0;
	}

	.menu-button {
		padding: 1rem 2rem;
		pointer-events: auto;
		display: flex;
		justify-content: center;
		align-items: center;
		text-transform: uppercase;
		font-size: 1.2rem;
		letter-spacing: 0.1rem;
		color: var(--color-white);
		background-color: var(--color-green4);
		border: solid 1px black;
		border-radius: 0.5rem;
		cursor: pointer;
	}

	.menu-content {
		overflow: auto;
	}

	.spacer {
		width: 100%;
	}

	@media (max-width: 768px) {
		.menu-wrapper {
			width: calc(100% - 2rem);
		}
	}

	@media (max-width: 600px) {
		.menu-container {
			padding: 0 0rem;
		}
	}
</style>
