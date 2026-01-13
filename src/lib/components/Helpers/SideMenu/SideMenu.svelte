<script>
	/* Generic Menu Wrapper. Places menu on side of screen for desktop, and then
  collaposes to a bottom menu for mobile */
	import DesktopMenu from './DesktopMenu.svelte';
	import MobileMenu from './MobileMenu.svelte';

	export let containerW = 100;
	export let containerH = 100;
	export let isMobile = false;
	export let desktopW = 250;
	export let side = 'left'; // Accepts: "left", "right"
</script>

<div class="menu-wrapper" style:width={`${containerW}px`} style:height={`${containerH}px`}>
	{#if !isMobile}
		<DesktopMenu {side} {desktopW}>
			<slot />
		</DesktopMenu>
	{:else}
		<MobileMenu {containerH} topPadding={20} toggleButtonH={50}>
			<slot />
		</MobileMenu>
	{/if}
</div>

<style>
	.menu-wrapper {
		position: absolute;
		top: 0;
		left: 0;
	}
</style>
