<script>
	import github from '$lib/assets/github.svg';
</script>

<header>
	<nav>
		<h1>Decimal Point</h1>
	</nav>
	<div class="corner">
		<a href="https://github.com/jeffmacinnes">
			<img src={github} alt="GitHub" />
		</a>
	</div>
</header>

<style>
	header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		height: 100px;
	}

	.corner {
		width: 45px;
	}

	h1 {
		color: var(--color-c1);
		font-size: 56px;
	}
</style>
