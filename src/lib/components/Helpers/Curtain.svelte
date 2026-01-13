<script>
	export let opacity = 0.8;
</script>

<div class="curtain" style:background-color={`rgba(126, 126, 126, ${opacity})`} />

<style lang="scss">
	.curtain {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		backdrop-filter: blur(3px);
	}
</style>
