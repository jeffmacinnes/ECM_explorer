import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as d3 from 'd3';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '../src/lib/data');
const STATIC_DIR = path.join(__dirname, '../static/data');

console.log('Loading graph data...');
const graphData = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'graph-data.json'), 'utf-8'));

console.log(`Nodes: ${graphData.nodes.length}`);
console.log(`Edges: ${graphData.edges.length}`);

// Clone nodes for simulation
const nodes = graphData.nodes.map(n => ({ ...n }));
const edges = graphData.edges.map(e => ({ ...e }));

// Create node lookup for edges
const nodeById = new Map(nodes.map(n => [n.id, n]));

// Convert edge source/target to node references
const links = edges.map(e => ({
	source: nodeById.get(e.source),
	target: nodeById.get(e.target),
	role: e.role
})).filter(e => e.source && e.target);

console.log(`Valid links: ${links.length}`);

// Run force simulation
console.log('\nRunning force simulation...');
const width = 4000;
const height = 4000;

const simulation = d3.forceSimulation(nodes)
	.force('link', d3.forceLink(links)
		.id(d => d.id)
		.distance(50)
		.strength(0.1))
	.force('charge', d3.forceManyBody()
		.strength(-30)
		.distanceMax(300))
	.force('center', d3.forceCenter(width / 2, height / 2))
	.force('collision', d3.forceCollide().radius(8))
	.stop();

// Run simulation for N iterations
const iterations = 300;
console.log(`Running ${iterations} iterations...`);

for (let i = 0; i < iterations; i++) {
	simulation.tick();
	if (i % 50 === 0) {
		console.log(`  Iteration ${i}/${iterations}`);
	}
}

console.log('Simulation complete.');

// Calculate bounds
let minX = Infinity, maxX = -Infinity;
let minY = Infinity, maxY = -Infinity;

for (const node of nodes) {
	minX = Math.min(minX, node.x);
	maxX = Math.max(maxX, node.x);
	minY = Math.min(minY, node.y);
	maxY = Math.max(maxY, node.y);
}

console.log(`Bounds: x[${minX.toFixed(0)}, ${maxX.toFixed(0)}] y[${minY.toFixed(0)}, ${maxY.toFixed(0)}]`);

// Build output with positions
const output = {
	nodes: nodes.map(n => ({
		id: n.id,
		type: n.type,
		label: n.label,
		x: n.x,
		y: n.y,
		// Include minimal extra data
		...(n.type === 'album' ? {
			artist: n.artist,
			year: n.year,
			series: n.series,
			localThumb: n.localThumb
		} : {
			localImage: n.localImage,
			albumCount: n.albumCount
		})
	})),
	edges: edges.map(e => ({
		source: e.source,
		target: e.target
	})),
	bounds: { minX, maxX, minY, maxY },
	meta: {
		nodeCount: nodes.length,
		edgeCount: edges.length,
		iterations,
		generatedAt: new Date().toISOString()
	}
};

// Save to static folder
const outputPath = path.join(STATIC_DIR, 'graph-layout.json');
fs.writeFileSync(outputPath, JSON.stringify(output));

const size = fs.statSync(outputPath).size;
console.log(`\n✓ Saved to ${outputPath}`);
console.log(`  Size: ${(size / 1024 / 1024).toFixed(2)} MB`);
