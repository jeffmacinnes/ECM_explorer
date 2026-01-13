<script>
	import { tooltip } from '$lib/actions/tooltip';
	import tooltipIcon from '$lib/assets/icon_tooltip.svg';
	import TooltipPopup from '$lib/components/ToolTips/TooltipSimple.svelte';

	export let text = '';
	export let placement = 'right';
	export let iconSize = '1.5rem';

	// Create a reactive statement to update the tooltip props when text changes
	$: tooltipProps = {
		component: TooltipPopup,
		props: {
			text,
			placement,
			strategy: 'fixed'
		}
	};
</script>

<img
	src={tooltipIcon}
	alt="Tooltip"
	style={`width: ${iconSize}; height: ${iconSize};`}
	use:tooltip={tooltipProps}
/>

<style lang="scss">
	img {
		cursor: pointer;

		&:hover {
			opacity: 0.7;
		}
	}
</style>
