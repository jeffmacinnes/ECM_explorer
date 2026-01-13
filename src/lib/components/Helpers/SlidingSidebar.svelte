<script>
	import { fly } from 'svelte/transition';

	let isOpen = true;

	function toggleMenu() {
		isOpen = !isOpen;
	}
</script>

{#if isOpen}
	<div class="menu {isOpen ? '' : 'closed'}" transition:fly={{ x: -400, duration: 500 }}>
		<button class="close-button" on:click={toggleMenu}>
			<svg width="24" height="24">
				<line id="top" x1="0" y1="0" x2="24" y2="24" />
				<line id="bottom" x1="0" y1="24" x2="24" y2="0" />
			</svg>
		</button>
		<slot />
	</div>
{:else}
	<button class="hamburger-button" on:click={toggleMenu}>
		<svg width="32" height="24">
			<line id="top" x1="0" y1="2" x2="32" y2="2" />
			<line id="middle" x1="0" y1="12" x2="32" y2="12" />
			<line id="bottom" x1="0" y1="22" x2="32" y2="22" />
		</svg>
	</button>
{/if}

<style lang="scss">
	.menu {
		position: fixed;
		z-index: 999;
		top: 0;
		left: 0;
		height: 100%;
		width: 400px;
		overflow-y: auto;
		background-color: rgba(255, 255, 255, 0.75);
		backdrop-filter: blur(5px);
		border-right: solid 1px #353535;
		box-shadow: 10px 0 10px -10px rgba(0, 0, 0, 0.1);
	}

	.close-button {
		z-index: 1000;
		position: absolute;
		top: 10px;
		right: 10px;
		width: 60px;
		height: 60px;
		border-radius: 100%;
		border: solid 1px #353535;
		background-color: rgba(255, 255, 255, 0.75);
		cursor: pointer;

		svg {
			line {
				stroke: #353535;
				stroke-width: 2;
			}
		}
	}

	.hamburger-button {
		z-index: 1000;
		position: absolute;
		top: 10px;
		left: 10px;
		width: 60px;
		height: 60px;
		border-radius: 100%;
		border: solid 1px #353535;
		background-color: rgba(255, 255, 255, 0.75);
		cursor: pointer;

		svg {
			line {
				stroke: #353535;
				stroke-width: 2;
			}
		}
	}
</style>
