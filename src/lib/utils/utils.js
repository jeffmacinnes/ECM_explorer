// === BROWSER FUNCTIONS ============================================================
export const isMobileDevice = () => {
	// return true if user agent indicates a mobile device
	return /Mobi|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

// === ARRAY FUNCTIONS ============================================================
// return a value from an object at the given path (i.e. 'a.b.c' => obj[a][b][c])
export const getNestedProperty = (obj, path) => {
	const properties = path.split('.');
	return properties.reduce((acc, key) => {
		if (acc && acc.hasOwnProperty(key)) {
			return acc[key];
		} else {
			return null;
		}
	}, obj);
};

export const removeDuplicatesBy = (keyFn, array) => {
	/* return a copy of array of objects, where each item is unique based on the given key
		 e.g. 
		
		 testArray = [
			 {color: 'red', value: 32},
			 {color: 'red', value: 15},
			 {color: 'blue', value: 16},
		]
		
		removeDuplicates(d => d.color, testArray) 

		// returns 
		[
			 {color: 'red', value: 32},
			 {color: 'blue', value: 16},
		]
		 https://stackoverflow.com/questions/32238602/javascript-remove-duplicates-of-objects-sharing-same-property-value
	*/
	let uniqueSet = new Set();
	return array.filter((d) => {
		let key = keyFn(d);
		let isNew = !uniqueSet.has(key);
		if (isNew) {
			uniqueSet.add(key);
		}
		return isNew;
	});
};

// shuffle array * https://stackoverflow.com/a/2450976/1293256
export const shuffle = (array) => {
	var currentIndex = array.length;
	var temporaryValue, randomIndex;

	// While there remain elements to shuffle...
	while (0 !== currentIndex) {
		// Pick a remaining element...
		randomIndex = Math.floor(Math.random() * currentIndex);
		currentIndex -= 1;

		// And swap it with the current element.
		temporaryValue = array[currentIndex];
		array[currentIndex] = array[randomIndex];
		array[randomIndex] = temporaryValue;
	}

	return array;
};

// === GENERAL MATH FUNCTIONS ====================================================
// test if number is between range (inclusive)
export const isBetween = (val, min, max) => {
	return val >= min && val <= max;
};

// get rand Float value between min, max (exclusive)
export const randBw = (min, max) => {
	return Math.random() * (max - min) + min;
};

// get rand Int value between min, max (inclusive)
export const randIntBw = (min, max) => {
	return Math.floor(Math.random() * (max - min + 1) + min);
};

// get random value from normal distribution
export const randNorm = (mu = 0, sigma = 1) => {
	let u1 = Math.random();
	let u2 = Math.random();

	// Box-Muller transform
	let z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);

	// Scale and shift to get desired mean and std dev
	return z0 * sigma + mu;
};

// get random value from supplied array
export const randFromArr = (arr) => {
	return arr[Math.floor(Math.random() * arr.length)];
};

// map input value to new range
export const remap = (val, inputMin, inputMax, outputMin, outputMax) => {
	return (outputMax - outputMin) * ((val - inputMin) / (inputMax - inputMin)) + outputMin;
};

// clamp/constrain value to min/max range
export const clamp = (val, min, max) => {
	return Math.max(Math.min(val, max), min);
};

// given 1D index, return 2D indices based on given 2D array size
export const idx2D = (idx, xSize, ySize) => {
	let x = idx % xSize;
	let y = Math.floor(idx / ySize);
	return { x: x, y: y };
};

// given 2D index, return the corresponding 1D index
export const idx1D = (xIdx, yIdx, xSize) => {
	return xIdx + xSize * yIdx;
};

// convert degrees to radians
export const degToRad = (deg) => {
	return deg * (Math.PI / 180);
};

// convert radians to degrees
export const rad2deg = (rad) => {
	return rad * (180 / Math.PI);
};

// convert polar coords to cartesian
export const polarToCart = (r, theta) => {
	return {
		x: r * Math.cos(theta),
		y: r * Math.sin(theta)
	};
};

// LERP: linear interpolation
export const lerp = (v0, v1, t) => {
	return v0 * (1 - t) + v1 * t;
};

// cosine interpolate between val1, val2, at progress (range 0-1)
export const cosineInterpolate = (val1, val2, progress) => {
	const m2 = (1 - Math.cos(progress * Math.PI)) / 2;
	return val1 * (1 - m2) + val2 * m2;
};

// easing functions
export const easeInOutQuad = (t) => {
	return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
};

// === COLOR FUNCTIONS ============================================================
// get random color
export const getRandomColor = () => {
	var letters = '0123456789ABCDEF';
	var color = '#';
	for (var i = 0; i < 6; i++) {
		color += letters[Math.floor(Math.random() * 16)];
	}
	return color;
};

export const hex2rgb = (hex) => {
	// Remove the hash character if it's included
	hex = hex.replace('#', '');

	// Convert the hex value to RGB values
	var r = parseInt(hex.substring(0, 2), 16);
	var g = parseInt(hex.substring(2, 4), 16);
	var b = parseInt(hex.substring(4, 6), 16);

	// Return the RGB values as an array
	return [r, g, b];
};

export const hexWithOpacity = (hex, opacity) => {
	// Ensure the hex string starts with a #
	if (hex.charAt(0) === '#') {
		hex = hex.slice(1);
	}

	// Check if the hex string is valid
	if (hex.length !== 3 && hex.length !== 6) {
		throw new Error('Invalid hex color format');
	}

	// Convert 3-digit hex to 6-digit hex
	if (hex.length === 3) {
		hex = hex
			.split('')
			.map((char) => char + char)
			.join('');
	}

	// Convert opacity from 0-1 to 0-255 and then to a 2-character hex
	const alpha = Math.round(opacity * 255)
		.toString(16)
		.padStart(2, '0')
		.toUpperCase();

	return `#${hex}${alpha}`;
};

export const rgbToHex = ([r, g, b]) => {
	// Ensure that the RGB values are within the valid range (0-255)
	r = Math.max(0, Math.min(255, r));
	g = Math.max(0, Math.min(255, g));
	b = Math.max(0, Math.min(255, b));

	// Convert the RGB values to hexadecimal format
	var hexR = r.toString(16).padStart(2, '0'); // Convert to hexadecimal and pad with zeros if necessary
	var hexG = g.toString(16).padStart(2, '0');
	var hexB = b.toString(16).padStart(2, '0');

	// Concatenate the hexadecimal values and return
	return '#' + hexR + hexG + hexB;
};

export const rgbStringToRGB = (rgbString) => {
	// Remove 'rgb(' and ')' and split by comma
	const cleanString = rgbString
		.replace('rgb(', '')
		.replace(')', '')
		.split(',')
		.map((value) => value.trim());

	// Convert to numbers and validate
	const rgbValues = cleanString.map((value) => {
		const num = parseInt(value, 10);
		if (isNaN(num) || num < 0 || num > 255) {
			throw new Error(`Invalid RGB value: ${value}`);
		}
		return num;
	});

	// Ensure we have exactly 3 values
	if (rgbValues.length !== 3) {
		throw new Error('RGB string must contain exactly 3 values');
	}

	return rgbValues; // [r, g, b]
};

// === FORMATTING FUNCTIONS ============================================================
export const formatCurrency = (value, decimalPts = 0) => {
	// return string with appropriate suffix for currency (K, M, B, T, etc);
	value = Math.round(value);

	let nDigits = `${value}`.length;
	let suffix = '';
	if (nDigits > 3 && nDigits <= 6) {
		suffix = 'K';
		value = (value / 1_000).toFixed(decimalPts);
	} else if (nDigits > 6 && nDigits <= 9) {
		suffix = 'M';
		value = (value / 1_000_000).toFixed(decimalPts);
	} else if (nDigits > 9 && nDigits <= 12) {
		suffix = 'B';
		value = (value / 1_000_000_000).toFixed(decimalPts);
	} else if (nDigits > 12 && nDigits <= 15) {
		suffix = 'T';
		value = (value / 1_000_000_000_000).toFixed(decimalPts);
	}

	return `$${value}${suffix}`;
};

export const formatOrdinal = (value) => {
	const suffixes = ['th', 'st', 'nd', 'rd'];
	const v = value % 100;
	return value + (suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0]);
};

export const capitalize = (word) => word.charAt(0).toUpperCase() + word.slice(1);

// === MISC FUNCTIONS ============================================================
export const degreeToCompass = (degrees) => {
	const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW', 'N'];
	const index = Math.round((degrees % 360) / 45);
	return directions[index];
};
