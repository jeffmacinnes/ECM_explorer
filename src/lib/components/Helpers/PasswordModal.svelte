<script>
	import logo from '$lib/assets/logo_PSE_white_wText.svg';
	import PseStripe from '$lib/components/common/PSEStripe.svelte';
	import { authenticated } from '$lib/stores/siteData';
	import { fade } from 'svelte/transition';

	// Local state
	const correctPassword = 'MyPassword';
	let password = '';
	let showModal = true;
	let containerW = 0;

	const hash = (s) =>
		s.split('').reduce((a, b) => {
			a = (a << 5) - a + b.charCodeAt(0);
			return a & a;
		}, 0);

	const checkPassword = () => {
		const isCorrect = hash(password) === hash(correctPassword);
		if (isCorrect) {
			authenticated.set(true);
		}
	};

	$: if ($authenticated) {
		showModal = false;
	}
	$: password, checkPassword();
</script>

{#if showModal}
	<div class="background" transition:fade>
		<div class="password-form-container" bind:clientWidth={containerW}>
			<!-- SITE TITLE -->
			<div class="site-title row">
				<div class="eyebrow">Authentication</div>
				<div class="title">MySite</div>
			</div>

			<!-- PASSWORD INPUT -->
			<div class="password-input row">
				<label for="password">password</label>
				<input id="password" bind:value={password} type="password" />
			</div>
		</div>
	</div>
{/if}

<style lang="scss">
	.background {
		background-color: var(--color-green4);
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		display: flex;
		justify-content: center;
		align-items: center;
		cursor: default;
	}

	.password-form-container {
		position: relative;
		padding: 3rem 6rem;
		border: solid 1px white;
	}

	.row {
		display: flex;
		justify-content: center;
		align-items: center;
		margin: 2rem 0;
	}

	.site-title {
		flex-direction: column;
		align-items: flex-start;
		gap: 0.5rem;
		font-size: 2.8rem;
		line-height: 1;
		font-weight: 800;
		color: '#ffffff';
		text-transform: uppercase;

		.eyebrow {
			text-transform: uppercase;
			font-size: 1.4rem;
			font-weight: 300;
			color: #eaeaea;
		}
	}

	.password-input {
		margin: 5rem 0 7rem;
		label {
			font-weight: 200;
			margin-right: 2rem;
			color: white;
		}
		input[type='password'] {
			width: 150px;
			height: 40px;
			background-color: #eaeaea;
			padding: 8px;
			color: #222;
			font-size: 2.8rem;
			border: solid 1px white;

			&:focus {
				outline: 0;
			}
		}
	}
</style>
