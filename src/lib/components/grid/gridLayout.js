const CELL_UNIT = 100;
const MIN_COLS = 6;
const SPACER_RATE = 0.15;
const PADDING = 24;

const hashId = (id) => {
	let h = 0;
	for (let i = 0; i < id.length; i++) {
		h = Math.imul(31, h) + id.charCodeAt(i) | 0;
	}
	return h;
};

const findPlacement = (heightMap, itemW) => {
	let bestCol = 0;
	let bestRow = Infinity;
	for (let c = 0; c <= heightMap.length - itemW; c++) {
		let maxRow = 0;
		for (let i = 0; i < itemW; i++) {
			if (heightMap[c + i] > maxRow) maxRow = heightMap[c + i];
		}
		if (maxRow < bestRow) {
			bestRow = maxRow;
			bestCol = c;
		}
	}
	return { col: bestCol, row: bestRow };
};

const markPlacement = (heightMap, col, row, w, h) => {
	for (let i = 0; i < w; i++) {
		heightMap[col + i] = row + h;
	}
};

export const computeGridLayout = (yearGroups, viewportWidth) => {
	if (!viewportWidth || viewportWidth < 200 || !yearGroups?.length) {
		return { cells: [], totalHeight: 0 };
	}

	const availW = viewportWidth - PADDING * 2;
	let cols = Math.floor(availW / CELL_UNIT);
	if (cols % 2 !== 0) cols -= 1;
	cols = Math.max(MIN_COLS, cols);
	const cellSize = availW / cols;

	const heightMap = new Array(cols).fill(0);
	const cells = [];
	const albumSize = 2;

	for (const group of yearGroups) {
		// Year gap: level heightMap to max + 1 row
		if (cells.length > 0) {
			const maxRow = Math.max(...heightMap);
			heightMap.fill(maxRow + 1);
		}

		// Place year label (2×2)
		const labelPos = findPlacement(heightMap, albumSize);
		const labelX = PADDING + labelPos.col * cellSize;
		const labelY = labelPos.row * cellSize;
		markPlacement(heightMap, labelPos.col, labelPos.row, albumSize, albumSize);

		cells.push({
			type: 'year',
			x: labelX,
			y: labelY,
			w: cellSize * albumSize,
			h: cellSize * albumSize,
			year: group.year,
			count: group.albums.length
		});

		// Place albums
		for (const album of group.albums) {
			const h = hashId(album.id);

			// Maybe insert 1×1 spacer
			if ((h & 0xFF) / 255 < SPACER_RATE) {
				const spacerPos = findPlacement(heightMap, 1);
				markPlacement(heightMap, spacerPos.col, spacerPos.row, 1, 1);
			}

			// Place album (2×2)
			const pos = findPlacement(heightMap, albumSize);
			const ax = PADDING + pos.col * cellSize;
			const ay = pos.row * cellSize;
			markPlacement(heightMap, pos.col, pos.row, albumSize, albumSize);

			cells.push({
				type: 'album',
				x: ax,
				y: ay,
				w: cellSize * albumSize,
				h: cellSize * albumSize,
				album
			});
		}
	}

	const totalHeight = Math.max(...heightMap) * cellSize + 100;
	return { cells, totalHeight, cellSize };
};
