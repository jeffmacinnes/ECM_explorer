/* Action that will animate a number from its current value to a new value 
You can input any string with a numeric value and unit, and it will animate to that value

*/

import { gsap } from 'gsap';

export function animateNumber(node, { value, duration = 0.5, startValue = 0, delay = 0 }) {
	// handle input values that are NUMBERS
	if (typeof value === 'number') {
		let numericValue = value;
		let decimalPlaces = Number.isInteger(value) ? 0 : (value.toString().split('.')[1] || '').length;
		let current = { number: parseFloat(node.textContent.replace(/,/g, '')) || numericValue };

		// Get starting value if node is empty
		if (!node.textContent) {
			current.number = startValue;
		}

		gsap.to(current, {
			number: numericValue,
			duration: duration,
			delay: delay,
			ease: 'power1.out',
			onUpdate: () => {
				node.textContent = current.number.toLocaleString(undefined, {
					minimumFractionDigits: decimalPlaces,
					maximumFractionDigits: decimalPlaces
				});
			}
		});

		return {
			update({ value, duration = 0.5 }) {
				let numericValue = value;
				let decimalPlaces = Number.isInteger(value)
					? 0
					: (value.toString().split('.')[1] || '').length;
				gsap.to(current, {
					number: numericValue,
					duration: duration,
					delay: delay,
					ease: 'power1.out',
					onUpdate: () => {
						node.textContent = current.number.toLocaleString(undefined, {
							minimumFractionDigits: decimalPlaces,
							maximumFractionDigits: decimalPlaces
						});
					}
				});
			}
		};
	}

	// handle input values that are STRINGS with numeric values
	let match = /([-+]?\d{1,3}(?:,\d{3})*(?:\.\d+)?)/.exec(value);
	if (!match) return;

	let numericValue = parseFloat(match[0].replace(/,/g, ''));
	let decimalPlaces = (match[0].split('.')[1] || '').length;
	let template = value.replace(match[0], '{number}');
	let current = {
		number:
			parseFloat(node.textContent.replace(/,/g, '').match(/[-+]?\d*\.?\d+/)?.[0]) || numericValue
	};
	if (!node.textContent) {
		current.number = startValue;
	}

	gsap.to(current, {
		number: numericValue,
		duration: duration,
		delay: delay,
		ease: 'power1.out',
		onUpdate: () => {
			node.textContent = template.replace(
				'{number}',
				current.number.toLocaleString(undefined, {
					minimumFractionDigits: decimalPlaces,
					maximumFractionDigits: decimalPlaces
				})
			);
		}
	});

	return {
		update({ value, duration = 0.5 }) {
			if (typeof value === 'number') {
				let numericValue = value;
				let decimalPlaces = Number.isInteger(value)
					? 0
					: (value.toString().split('.')[1] || '').length;
				gsap.to(current, {
					number: numericValue,
					duration: duration,
					delay: delay,
					ease: 'power1.out',
					onUpdate: () => {
						node.textContent = current.number.toLocaleString(undefined, {
							minimumFractionDigits: decimalPlaces,
							maximumFractionDigits: decimalPlaces
						});
					}
				});
				return;
			}

			let match = /([-+]?\d{1,3}(?:,\d{3})*(?:\.\d+)?)/.exec(value);
			if (!match) return;

			let numericValue = parseFloat(match[0].replace(/,/g, ''));
			let decimalPlaces = (match[0].split('.')[1] || '').length;
			let template = value.replace(match[0], '{number}');

			gsap.to(current, {
				number: numericValue,
				duration: duration,
				delay: delay,
				ease: 'power1.out',
				onUpdate: () => {
					node.textContent = template.replace(
						'{number}',
						current.number.toLocaleString(undefined, {
							minimumFractionDigits: decimalPlaces,
							maximumFractionDigits: decimalPlaces
						})
					);
				}
			});
		}
	};
}
