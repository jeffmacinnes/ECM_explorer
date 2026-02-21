import { writable, derived } from 'svelte/store';

// Raw graph data (nodes + edges)
export const graphData = writable(null);

// Loading state
export const isLoading = writable(true);

// Selected node (album or artist)
export const selectedNode = writable(null);

// Hovered node
export const hoveredNode = writable(null);

// Filter state
export const filters = writable({
	search: '',
	series: [], // ECM, JAPO, WATT, etc.
	yearRange: [1969, 2024],
	nodeType: 'all' // 'all', 'albums', 'artists'
});

// Derived: filtered nodes
export const filteredNodes = derived(
	[graphData, filters],
	([$graphData, $filters]) => {
		if (!$graphData) return [];

		return $graphData.nodes.filter(node => {
			// Filter by node type
			if ($filters.nodeType === 'albums' && node.type !== 'album') return false;
			if ($filters.nodeType === 'artists' && node.type !== 'artist') return false;

			// Filter by search term
			if ($filters.search) {
				const searchLower = $filters.search.toLowerCase();
				const label = node.label?.toLowerCase() || '';
				const artist = node.artist?.toLowerCase() || '';
				if (!label.includes(searchLower) && !artist.includes(searchLower)) {
					return false;
				}
			}

			// Filter albums by series
			if (node.type === 'album' && $filters.series.length > 0) {
				if (!$filters.series.includes(node.series)) return false;
			}

			// Filter albums by year
			if (node.type === 'album' && node.year) {
				if (node.year < $filters.yearRange[0] || node.year > $filters.yearRange[1]) {
					return false;
				}
			}

			return true;
		});
	}
);

// Derived: filtered edges (only edges where both nodes are visible)
export const filteredEdges = derived(
	[graphData, filteredNodes],
	([$graphData, $filteredNodes]) => {
		if (!$graphData) return [];

		const visibleNodeIds = new Set($filteredNodes.map(n => n.id));

		return $graphData.edges.filter(edge =>
			visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target)
		);
	}
);

// Load graph data
export const loadGraphData = async () => {
	isLoading.set(true);
	try {
		const response = await fetch('/data/graph-data.json');
		const data = await response.json();
		graphData.set(data);
	} catch (error) {
		console.error('Failed to load graph data:', error);
	} finally {
		isLoading.set(false);
	}
};
