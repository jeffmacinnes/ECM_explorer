<script>
	import '$lib/styles/app.css';
	import { page } from '$app/stores';
</script>

<div class="app">
	<nav>
		<a href="/" class:active={$page.url.pathname === '/'}>Stream</a>
		<a href="/grid" class:active={$page.url.pathname === '/grid'}>Grid</a>
		<a href="/spiral" class:active={$page.url.pathname === '/spiral'}>Spiral</a>
		<a href="/spiral-v1" class:active={$page.url.pathname === '/spiral-v1'}>Spiral v1</a>
	</nav>
	<main>
		<slot />
	</main>
</div>

<style lang="scss">
	.app {
		display: flex;
		flex-direction: column;
		height: 100dvh;
		overflow: hidden;
	}

	nav {
		display: flex;
		gap: 0;
		background: var(--color-text);
		flex-shrink: 0;

		a {
			padding: 0.5rem 1.25rem;
			font-size: 0.8rem;
			font-weight: 400;
			letter-spacing: 0.12em;
			text-transform: uppercase;
			text-decoration: none;
			color: rgba(255, 255, 255, 0.45);
			transition: color 0.15s;

			&:hover {
				color: rgba(255, 255, 255, 0.8);
			}

			&.active {
				color: #fff;
				font-weight: 500;
			}
		}
	}

	main {
		flex: 1;
		display: flex;
		flex-direction: column;
		width: 100%;
		height: 100%;
		overflow: hidden;
	}
</style>
