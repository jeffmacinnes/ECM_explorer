export const positionTooltip = (node, config) => {
	/* Function to handle the placement of the tooltip node relative to the '
  input x and y coordinates.

  Placement can be "top", "right", "bottom", or "left". An offset can be
  set along the x or y direction. If optimize is set to true, the function
  will check if the tooltip is out of bounds and flip it to the other side
  if so.

  Returns an object with the top and left properties for the tooltip node that
  can be used for absolute positioning the node.
  */
	if (!node) return;

	const x = config.x || 0; // this is x,y of the mouse
	const y = config.y || 0;
	const offset = config.offset || { x: 0, y: 0 };
	let placement = config.placement || 'top';
	const optimize = config.optimize || false;

	let winW = window.innerWidth;
	let winH = window.innerHeight;
	let bbox = node.getBoundingClientRect();
	let top = 0;
	let left = 0;

	// try to position the tooltip at desired location
	switch (placement) {
		case 'top':
			top = y - bbox.height - offset.y;
			left = x - bbox.width / 2;
			break;
		case 'bottom':
			top = y + offset.y;
			left = x - bbox.width / 2;
			break;
		case 'left':
			top = y - bbox.height / 2;
			left = x - bbox.width - offset.x;
			break;
		case 'right':
			top = y - bbox.height / 2;
			left = x + offset.x;
			break;
	}

	if (optimize) {
		// check if tooltip is out of bounds, flip to other side if so
		if (top < 0) {
			// if extends off top of screen, flip to bottom
			top = y + offset.y;
			placement = 'bottom';
		} else if (top + bbox.height > winH) {
			// if extends off bottom of screen, flip to top
			top = y - bbox.height - offset.y;
			placement = 'top';
		} else if (left < 0) {
			// if extends off left of screen, flip to right
			left = x + offset.x;
			placement = 'right';
		} else if (left + bbox.width > winW) {
			left = x - bbox.width - offset.x;
			placement = 'left';
		}
	}

	return {
		top,
		left,
		placement
	};
};
