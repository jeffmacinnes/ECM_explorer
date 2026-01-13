<script>
	/* Generic Buttons with Slideout Menu Component
Menu slides out from the button when clicked. You can feed 
it slots for "button" and "menu" for custom content. On mobile, 
the menu takes the full screen and appears at top of DOM
*/
	import { fly } from 'svelte/transition';
	import { createEventDispatcher, onMount } from 'svelte';
	import closeButtonIcon from '$lib/assets/icon_closeButton.svg';

	// Props
	export let isOpen = false;
	export let isMobile = false; // Set to true for mobile devices
	export let menuWidth = 200;
	export let menuHeight = null; // null defaults to 'auto'
	export let position = 'bottom'; // 'left', 'right', 'top', 'bottom'
	export let transitionDuration = 300;
	export let closeOnClickOutside = true;
	export let gap = '8px'; // Gap between button and menu

	let slideOutMenuContentRef;
	let buttonRef;
	let screenW;
	let mobileMenuContainer;
	let desktopMenuW = menuWidth;
	let menuAdjusted = false;

	const dispatch = createEventDispatcher();

	// Create a portal for mobile menu
	function createMobileMenuPortal() {
		if (!mobileMenuContainer) {
			mobileMenuContainer = document.createElement('div');
			mobileMenuContainer.id = 'mobile-menu-portal';
			mobileMenuContainer.style.position = 'relative';
			mobileMenuContainer.style.zIndex = '99999'; // Very high z-index
			document.body.appendChild(mobileMenuContainer);
		}
		return mobileMenuContainer;
	}

	// Function to add menu to portal
	function addToPortal(node) {
		if (isMobile && isOpen) {
			const portal = createMobileMenuPortal();
			portal.appendChild(node);

			return {
				destroy() {
					if (node.parentNode === portal) {
						portal.removeChild(node);
					}
				}
			};
		}
	}

	function toggleMenu() {
		isOpen = !isOpen;
		dispatch('toggle', { isOpen });
	}

	function handleClickOutside(event) {
		if (!isOpen) return;

		// If click is outside the menu and outside the button
		if (
			closeOnClickOutside &&
			slideOutMenuContentRef &&
			!slideOutMenuContentRef.contains(event.target) &&
			buttonRef &&
			!buttonRef.contains(event.target)
		) {
			isOpen = false;
			dispatch('toggle', { isOpen });
		}
	}

	// Compute fly transition parameters based on position
	function getFlyParams() {
		const params = { duration: transitionDuration, x: 0, y: 0 };

		if (!isMobile) {
			switch (position) {
				case 'left':
					params.x = 20;
					break;
				case 'right':
					params.x = -20;
					break;
				case 'top':
					params.y = 20;
					break;
				case 'bottom':
					params.y = -20;
					break;
			}
		} else {
			// For mobile, slide up from bottom
			params.y = 20;
		}

		return params;
	}

	// Function to check and adjust menu position after it's visible
	function checkMenuPosition() {
		if (!isMobile && slideOutMenuContentRef && isOpen) {
			const menuRect = slideOutMenuContentRef.getBoundingClientRect();
			const windowHeight = window.innerHeight;
			const windowWidth = window.innerWidth;

			if (position === 'left' || position === 'right') {
				// Check if menu extends beyond viewport bottom
				if (menuRect.bottom > windowHeight) {
					const adjustment = menuRect.bottom - windowHeight;
					slideOutMenuContentRef.style.top = `calc(0px - ${adjustment}px)`;
				}
				// Check if menu extends beyond viewport top
				else if (menuRect.top < 0) {
					slideOutMenuContentRef.style.top = '0px';
				}
			} else if (position === 'top' || position === 'bottom') {
				// Check if menu extends beyond viewport right
				if (menuRect.right > windowWidth) {
					const adjustment = menuRect.right - windowWidth;
					slideOutMenuContentRef.style.left = `calc(50% - ${adjustment}px)`;
				}
				// Check if menu extends beyond viewport left
				else if (menuRect.left < 0) {
					slideOutMenuContentRef.style.left = '0px';
					slideOutMenuContentRef.style.transform = 'none';
				}
			}
		}
	}

	// Get menu position styles based on position prop - keep original implementation
	function getMenuPositionStyle() {
		if (isMobile) {
			return `
				position: fixed;
				top: 0;
				left: 0;
				right: 0;
				bottom: 0;
				width: 100%;
				height: 100%;
				z-index: 99999;
				border-radius: 0;
				background-color: white;
				overflow-y: auto;
			`;
		}

		const styles = {
			width: `${menuWidth}px`,
			height: menuHeight ? `${menuHeight}px` : 'auto'
		};

		switch (position) {
			case 'left':
				styles.right = `calc(100% + ${gap})`;
				styles.top = '0';
				break;
			case 'right':
				styles.left = `calc(100% + ${gap})`;
				styles.top = '0';
				break;
			case 'top':
				styles.bottom = `calc(100% + ${gap})`;
				styles.left = '50%';
				styles.transform = 'translateX(-50%)';
				break;
			case 'bottom':
				styles.top = `calc(100% + ${gap})`;
				styles.left = '50%';
				styles.transform = 'translateX(-50%)';
				break;
		}

		return Object.entries(styles)
			.map(([key, value]) => `${key}: ${value}`)
			.join('; ');
	}

	// Watch for isOpen changes to trigger position check
	$: if (isOpen) {
		menuAdjusted = false;
		// Use a small delay to ensure the menu has been rendered
		setTimeout(() => {
			checkMenuPosition();
			menuAdjusted = true;
		}, 50);
	}

	// Handle window resize to readjust menu position
	function handleResize() {
		if (isOpen) {
			checkMenuPosition();
		}
	}

	$: menuW = isMobile ? screenW : menuWidth; // Full width on mobile
</script>

<svelte:window on:click={handleClickOutside} bind:innerWidth={screenW} on:resize={handleResize} />

<div class="slideout-menu-container" class:vertical={position === 'top' || position === 'bottom'}>
	<!-- BUTTON TO OPEN/CLOSE MENU -->
	<div id="slideout-menu-button" class="menu-button" on:click={toggleMenu} bind:this={buttonRef}>
		<slot name="button">
			<button>Menu</button>
		</slot>
	</div>

	<!-- MENU CONTENTS -->
	{#if isOpen}
		<div
			class="menu-content"
			class:mobile={isMobile}
			class:top={position === 'top' && !isMobile}
			class:bottom={position === 'bottom' && !isMobile}
			class:left={position === 'left' && !isMobile}
			class:right={position === 'right' && !isMobile}
			style={getMenuPositionStyle()}
			transition:fly={getFlyParams()}
			bind:this={slideOutMenuContentRef}
			use:addToPortal={isMobile}
		>
			<div class="close-button" on:click={toggleMenu}>
				<img src={closeButtonIcon} alt="Close menu" />
			</div>

			<slot name="menu">
				<p>Default Menu Content</p>
			</slot>
		</div>
	{/if}
</div>

<style lang="scss">
	.slideout-menu-container {
		position: relative;
		display: inline-flex;
		align-items: center;
	}

	.slideout-menu-container.vertical {
		flex-direction: column;
	}

	.menu-button {
		z-index: 1;
		position: relative;
		cursor: pointer;
	}

	.menu-content {
		position: absolute;
		background-color: white;
		border: 1px solid #ddd;
		border-radius: 4px;
		box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
		z-index: 10;
		max-height: 80vh;
		overflow-y: auto;

		&.mobile {
			position: fixed;
			top: 0;
			left: 0;
			width: 100%;
			height: 100%;
			border-radius: 0;
			box-shadow: none;
			padding: 20px;
			max-height: none;
			overflow-y: auto;
			z-index: 99999;
		}
	}

	.close-button {
		position: absolute;
		top: 10px;
		right: 10px;
		width: 12px;
		height: 12px;
		cursor: pointer;

		img {
			width: 100%;
			height: 100%;
			object-fit: contain;
		}
	}
</style>
