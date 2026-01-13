<script>
	import placeholder from '$lib/assets/placeholder.png';

	let h, w;

	$: console.log('placeholder', w, h);
</script>

<div
	class="placeholder-container"
	bind:clientHeight={h}
	bind:clientWidth={w}
	style="background-image: {`url(${placeholder})`}"
></div>

<style lang="scss">
	.placeholder-container {
		width: 100%;
		height: 100%;
		border: solid 1px black;
		background-repeat: no-repeat;
		background-size: 100% 100%;
		min-height: 100%;
	}
</style>
