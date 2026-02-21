<script>
	import SpiralScene from './SpiralScene.svelte';
	import SpiralOverlay from './SpiralOverlay.svelte';

	export let albums = [];

	let activeAlbum = null;
	let spiralScene;

	const handleActiveAlbum = (e) => {
		activeAlbum = e.detail;
	};

	const handleNavigateTo = (e) => {
		spiralScene?.navigateTo(e.detail);
	};

	export const resetScroll = () => {
		spiralScene?.resetScroll();
	};

	export const navigateTo = (index) => {
		spiralScene?.navigateTo(index);
	};
</script>

<div class="spiral-layout">
	<SpiralScene
		{albums}
		bind:this={spiralScene}
		on:activeAlbum={handleActiveAlbum}
	/>
	<SpiralOverlay {activeAlbum} {albums} on:navigateTo={handleNavigateTo} />
</div>

<style lang="scss">
	.spiral-layout {
		position: relative;
		width: 100%;
		height: 100%;
		overflow: hidden;
		background: #fff;
		outline: none;
	}
</style>
