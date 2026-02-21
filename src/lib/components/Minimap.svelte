<script>
	import { allYearsUnfiltered } from '$lib/stores/catalog.js';

	export let yearPositions = [];
	export let scrollToYear = () => {};
	export let currentScrollY = 0;
	export let contentHeight = 0;
	export let viewportHeight = 0;

	let containerEl;
	let isDragging = false;

	// Use unfiltered years for consistent histogram
	$: years = $allYearsUnfiltered || [];

	// Max albums in any year (for scaling bars)
	$: maxCount = Math.max(...(years.map(y => y.count) || [1]), 1);

	// Show label every N years - more labels now
	$: labelInterval = years.length > 50 ? 5 : years.length > 25 ? 3 : 2;

	// Thumb position and size
	$: scrollableHeight = Math.max(1, contentHeight - viewportHeight);
	$: thumbHeightPercent = contentHeight > 0
		? Math.max(8, (viewportHeight / contentHeight) * 100)
		: 100;
	$: thumbTopPercent = (currentScrollY / scrollableHeight) * (100 - thumbHeightPercent);

	// Find current year based on scroll position
	$: currentYear = (() => {
		if (!yearPositions.length) return null;
		for (let i = yearPositions.length - 1; i >= 0; i--) {
			if (currentScrollY >= yearPositions[i].top - 100) {
				return yearPositions[i].year;
			}
		}
		return yearPositions[0]?.year;
	})();

	const getScrollFromY = (clientY) => {
		if (!containerEl) return 0;
		const rect = containerEl.getBoundingClientRect();
		const y = clientY - rect.top;
		const percent = Math.max(0, Math.min(1, y / rect.height));
		return percent * scrollableHeight;
	};

	const handleMouseDown = (e) => {
		isDragging = true;
		const targetScroll = getScrollFromY(e.clientY);
		scrollToYear(null, targetScroll);

		window.addEventListener('mousemove', handleMouseMove);
		window.addEventListener('mouseup', handleMouseUp);
	};

	const handleMouseMove = (e) => {
		if (!isDragging) return;
		const targetScroll = getScrollFromY(e.clientY);
		scrollToYear(null, targetScroll);
	};

	const handleMouseUp = () => {
		isDragging = false;
		window.removeEventListener('mousemove', handleMouseMove);
		window.removeEventListener('mouseup', handleMouseUp);
	};

	const handleYearClick = (e, year) => {
		e.stopPropagation();
		scrollToYear(year);
	};
</script>

<div
	class="minimap"
	class:dragging={isDragging}
	bind:this={containerEl}
	on:mousedown={handleMouseDown}
>
	<!-- Year labels and bars -->
	<div class="years">
		{#each years as { year, count }, i}
			{@const barWidth = Math.max(4, (count / maxCount) * 100)}
			<button
				class="year-row"
				class:active={currentYear == year}
				on:click={(e) => handleYearClick(e, year)}
				title="{year}: {count} albums"
			>
				<span class="label" class:visible={i % labelInterval === 0 || i === 0 || i === years.length - 1}>
					{year}
				</span>
				<div class="bar-track">
					<div class="bar" style="width: {barWidth}%"></div>
				</div>
			</button>
		{/each}
	</div>

	<!-- Scrubber thumb -->
	<div class="scrubber">
		<div
			class="thumb"
			style="top: {thumbTopPercent}%; height: {thumbHeightPercent}%;"
		></div>
	</div>
</div>

<style lang="scss">
	.minimap {
		width: 100px;
		height: 100%;
		display: flex;
		position: relative;
		border-right: 1px solid var(--color-border);
		background: #fafafa;
		user-select: none;
		cursor: grab;

		&:active, &.dragging {
			cursor: grabbing;
		}
	}

	.years {
		flex: 1;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		padding: 6px 0;
	}

	.year-row {
		display: flex;
		align-items: center;
		gap: 5px;
		padding: 0 4px 0 8px;
		background: none;
		border: none;
		cursor: pointer;
		min-height: 0;
		flex: 1;
		transition: background 0.1s;

		&:hover {
			background: var(--color-hover);

			.label.visible {
				color: var(--color-text);
			}
			.bar {
				background: var(--color-g1);
			}
		}

		&.active {
			background: var(--color-g5);

			.label {
				color: var(--color-text);
				font-weight: 600;
				opacity: 1;
			}
			.bar {
				background: var(--color-text);
			}
		}
	}

	.label {
		font-size: 10px;
		font-weight: 500;
		color: var(--color-g3);
		opacity: 0;
		min-width: 30px;
		text-align: right;
		transition: color 0.1s;

		&.visible {
			opacity: 1;
		}
	}

	.bar-track {
		flex: 1;
		height: 4px;
		background: var(--color-border-light);
		border-radius: 2px;
		overflow: hidden;
	}

	.bar {
		height: 100%;
		min-width: 2px;
		background: var(--color-g4);
		border-radius: 2px;
		transition: background 0.1s, width 0.2s;
	}

	.scrubber {
		width: 12px;
		height: 100%;
		position: relative;
		background: transparent;
		border-left: 1px solid var(--color-border-light);
	}

	.thumb {
		position: absolute;
		left: 2px;
		right: 2px;
		background: var(--color-g4);
		border-radius: 4px;
		transition: background 0.15s, left 0.1s, right 0.1s;
	}

	.minimap:hover .thumb,
	.minimap.dragging .thumb {
		left: 1px;
		right: 1px;
		background: var(--color-text);
	}
</style>
