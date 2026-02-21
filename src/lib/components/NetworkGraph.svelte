<script>
	import { onMount, onDestroy } from 'svelte';
	import * as d3 from 'd3';
	import {
		selectedNode,
		hoveredNode,
		filters
	} from '$lib/stores/graphData.js';
	import { preloadAlbumDetail, preloadArtistDetail } from '$lib/stores/detailData.js';

	let container;
	let canvas;
	let width = 0;
	let height = 0;

	// Graph data
	let nodes = [];
	let edges = [];
	let nodeById = new Map();
	let bounds = { minX: 0, maxX: 4000, minY: 0, maxY: 4000 };

	// Transform state
	let transform = { x: 0, y: 0, k: 1 };

	// Quadtree for fast hit detection
	let quadtree;

	// WebGL context and buffers
	let gl;
	let nodeProgram;
	let edgeProgram;
	let nodeBuffer;
	let edgeBuffer;

	// Animation
	let animationFrame;
	let needsRender = true;

	// Node sizing
	const ALBUM_SIZE = 8;
	const ARTIST_SIZE = 5;

	// Shaders
	const nodeVertexShader = `
		attribute vec2 position;
		attribute float size;
		attribute vec3 color;
		uniform vec2 resolution;
		uniform vec2 pan;
		uniform float zoom;
		varying vec3 vColor;

		void main() {
			vec2 pos = (position - pan) * zoom;
			vec2 clipSpace = (pos / resolution) * 2.0 - 1.0;
			gl_Position = vec4(clipSpace * vec2(1, -1), 0, 1);
			gl_PointSize = size * zoom;
			vColor = color;
		}
	`;

	const nodeFragmentShader = `
		precision mediump float;
		varying vec3 vColor;

		void main() {
			vec2 coord = gl_PointCoord - vec2(0.5);
			float dist = length(coord);
			if (dist > 0.5) discard;
			gl_FragColor = vec4(vColor, 1.0);
		}
	`;

	const edgeVertexShader = `
		attribute vec2 position;
		uniform vec2 resolution;
		uniform vec2 pan;
		uniform float zoom;

		void main() {
			vec2 pos = (position - pan) * zoom;
			vec2 clipSpace = (pos / resolution) * 2.0 - 1.0;
			gl_Position = vec4(clipSpace * vec2(1, -1), 0, 1);
		}
	`;

	const edgeFragmentShader = `
		precision mediump float;
		uniform float alpha;

		void main() {
			gl_FragColor = vec4(1.0, 1.0, 1.0, alpha);
		}
	`;

	const createShader = (type, source) => {
		const shader = gl.createShader(type);
		gl.shaderSource(shader, source);
		gl.compileShader(shader);
		if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
			console.error('Shader compile error:', gl.getShaderInfoLog(shader));
			gl.deleteShader(shader);
			return null;
		}
		return shader;
	};

	const createProgram = (vertexSource, fragmentSource) => {
		const vertexShader = createShader(gl.VERTEX_SHADER, vertexSource);
		const fragmentShader = createShader(gl.FRAGMENT_SHADER, fragmentSource);
		const program = gl.createProgram();
		gl.attachShader(program, vertexShader);
		gl.attachShader(program, fragmentShader);
		gl.linkProgram(program);
		if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
			console.error('Program link error:', gl.getProgramInfoLog(program));
			return null;
		}
		return program;
	};

	const initWebGL = () => {
		gl = canvas.getContext('webgl', { antialias: true, alpha: false });
		if (!gl) {
			console.error('WebGL not supported');
			return false;
		}

		// Create programs
		nodeProgram = createProgram(nodeVertexShader, nodeFragmentShader);
		edgeProgram = createProgram(edgeVertexShader, edgeFragmentShader);

		// Create buffers
		nodeBuffer = gl.createBuffer();
		edgeBuffer = gl.createBuffer();

		// Enable blending
		gl.enable(gl.BLEND);
		gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

		return true;
	};

	const updateBuffers = () => {
		if (!gl) return;

		// Filter nodes based on current filters
		const searchLower = $filters.search?.toLowerCase() || '';
		const visibleNodes = nodes.filter(node => {
			if (searchLower) {
				const label = node.label?.toLowerCase() || '';
				const artist = node.artist?.toLowerCase() || '';
				if (!label.includes(searchLower) && !artist.includes(searchLower)) {
					return false;
				}
			}
			return true;
		});

		const visibleNodeIds = new Set(visibleNodes.map(n => n.id));

		// Build node data (position, size, color)
		const nodeData = new Float32Array(visibleNodes.length * 6);
		visibleNodes.forEach((node, i) => {
			const offset = i * 6;
			nodeData[offset] = node.x;
			nodeData[offset + 1] = node.y;
			nodeData[offset + 2] = node.type === 'album' ? ALBUM_SIZE : ARTIST_SIZE;

			// Color based on state
			const isHovered = $hoveredNode?.id === node.id;
			const isSelected = $selectedNode?.id === node.id;

			if (isHovered || isSelected) {
				nodeData[offset + 3] = 0.93; // #ee
				nodeData[offset + 4] = 0.39; // #64
				nodeData[offset + 5] = 0.30; // #4d
			} else if (node.type === 'album') {
				nodeData[offset + 3] = 1.0;
				nodeData[offset + 4] = 1.0;
				nodeData[offset + 5] = 1.0;
			} else {
				nodeData[offset + 3] = 0.5;
				nodeData[offset + 4] = 0.5;
				nodeData[offset + 5] = 0.5;
			}
		});

		gl.bindBuffer(gl.ARRAY_BUFFER, nodeBuffer);
		gl.bufferData(gl.ARRAY_BUFFER, nodeData, gl.DYNAMIC_DRAW);

		// Build edge data (only edges where both nodes are visible)
		const visibleEdges = edges.filter(e =>
			visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target)
		);

		const edgeData = new Float32Array(visibleEdges.length * 4);
		visibleEdges.forEach((edge, i) => {
			const source = nodeById.get(edge.source);
			const target = nodeById.get(edge.target);
			if (source && target) {
				const offset = i * 4;
				edgeData[offset] = source.x;
				edgeData[offset + 1] = source.y;
				edgeData[offset + 2] = target.x;
				edgeData[offset + 3] = target.y;
			}
		});

		gl.bindBuffer(gl.ARRAY_BUFFER, edgeBuffer);
		gl.bufferData(gl.ARRAY_BUFFER, edgeData, gl.DYNAMIC_DRAW);

		// Store counts for rendering
		nodeBuffer.count = visibleNodes.length;
		edgeBuffer.count = visibleEdges.length;

		// Update quadtree with visible nodes
		quadtree = d3.quadtree()
			.x(d => d.x)
			.y(d => d.y)
			.addAll(visibleNodes);
	};

	const render = () => {
		if (!gl || !needsRender) return;
		needsRender = false;

		gl.viewport(0, 0, canvas.width, canvas.height);
		gl.clearColor(0, 0, 0, 1);
		gl.clear(gl.COLOR_BUFFER_BIT);

		const pan = [
			bounds.minX - transform.x / transform.k,
			bounds.minY - transform.y / transform.k
		];

		// Draw edges
		if (edgeBuffer.count > 0) {
			gl.useProgram(edgeProgram);

			const posLoc = gl.getAttribLocation(edgeProgram, 'position');
			const resLoc = gl.getUniformLocation(edgeProgram, 'resolution');
			const panLoc = gl.getUniformLocation(edgeProgram, 'pan');
			const zoomLoc = gl.getUniformLocation(edgeProgram, 'zoom');
			const alphaLoc = gl.getUniformLocation(edgeProgram, 'alpha');

			gl.bindBuffer(gl.ARRAY_BUFFER, edgeBuffer);
			gl.enableVertexAttribArray(posLoc);
			gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

			gl.uniform2f(resLoc, width, height);
			gl.uniform2f(panLoc, pan[0], pan[1]);
			gl.uniform1f(zoomLoc, transform.k);
			gl.uniform1f(alphaLoc, Math.min(0.15, 0.05 + transform.k * 0.02));

			gl.drawArrays(gl.LINES, 0, edgeBuffer.count * 2);
		}

		// Draw nodes
		if (nodeBuffer.count > 0) {
			gl.useProgram(nodeProgram);

			const posLoc = gl.getAttribLocation(nodeProgram, 'position');
			const sizeLoc = gl.getAttribLocation(nodeProgram, 'size');
			const colorLoc = gl.getAttribLocation(nodeProgram, 'color');
			const resLoc = gl.getUniformLocation(nodeProgram, 'resolution');
			const panLoc = gl.getUniformLocation(nodeProgram, 'pan');
			const zoomLoc = gl.getUniformLocation(nodeProgram, 'zoom');

			gl.bindBuffer(gl.ARRAY_BUFFER, nodeBuffer);
			gl.enableVertexAttribArray(posLoc);
			gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 24, 0);
			gl.enableVertexAttribArray(sizeLoc);
			gl.vertexAttribPointer(sizeLoc, 1, gl.FLOAT, false, 24, 8);
			gl.enableVertexAttribArray(colorLoc);
			gl.vertexAttribPointer(colorLoc, 3, gl.FLOAT, false, 24, 12);

			gl.uniform2f(resLoc, width, height);
			gl.uniform2f(panLoc, pan[0], pan[1]);
			gl.uniform1f(zoomLoc, transform.k);

			gl.drawArrays(gl.POINTS, 0, nodeBuffer.count);
		}
	};

	const scheduleRender = () => {
		needsRender = true;
		if (!animationFrame) {
			animationFrame = requestAnimationFrame(() => {
				animationFrame = null;
				render();
			});
		}
	};

	const handleResize = () => {
		if (!container) return;

		width = container.clientWidth;
		height = container.clientHeight;

		const dpr = window.devicePixelRatio || 1;
		canvas.width = width * dpr;
		canvas.height = height * dpr;
		canvas.style.width = `${width}px`;
		canvas.style.height = `${height}px`;

		// Center the view on first load
		if (transform.x === 0 && transform.y === 0) {
			const graphWidth = bounds.maxX - bounds.minX;
			const graphHeight = bounds.maxY - bounds.minY;
			const scale = Math.min(width / graphWidth, height / graphHeight) * 0.9;

			transform.k = scale;
			transform.x = (width - graphWidth * scale) / 2 - bounds.minX * scale;
			transform.y = (height - graphHeight * scale) / 2 - bounds.minY * scale;
		}

		scheduleRender();
	};

	// Convert screen coordinates to graph coordinates
	const screenToGraph = (screenX, screenY) => {
		return {
			x: (screenX - transform.x) / transform.k + bounds.minX,
			y: (screenY - transform.y) / transform.k + bounds.minY
		};
	};

	const getNodeAtPosition = (screenX, screenY) => {
		if (!quadtree) return null;

		const { x, y } = screenToGraph(screenX, screenY);
		const radius = 15 / transform.k;

		let closest = null;
		let closestDist = radius;

		quadtree.visit((quad, x1, y1, x2, y2) => {
			if (!quad.length) {
				do {
					const d = quad.data;
					const dx = x - d.x;
					const dy = y - d.y;
					const dist = Math.sqrt(dx * dx + dy * dy);
					if (dist < closestDist) {
						closestDist = dist;
						closest = d;
					}
				} while ((quad = quad.next));
			}
			return x1 > x + radius || x2 < x - radius || y1 > y + radius || y2 < y - radius;
		});

		return closest;
	};

	const handleMouseMove = (event) => {
		const rect = canvas.getBoundingClientRect();
		const x = event.clientX - rect.left;
		const y = event.clientY - rect.top;

		const node = getNodeAtPosition(x, y);

		if (node !== $hoveredNode) {
			hoveredNode.set(node);
			canvas.style.cursor = node ? 'pointer' : 'grab';

			// Preload on hover
			if (node) {
				if (node.type === 'album') {
					preloadAlbumDetail(node.id);
				} else {
					preloadArtistDetail(node.id);
				}
			}

			updateBuffers();
			scheduleRender();
		}
	};

	const handleClick = (event) => {
		const rect = canvas.getBoundingClientRect();
		const x = event.clientX - rect.left;
		const y = event.clientY - rect.top;

		const node = getNodeAtPosition(x, y);
		if (node) {
			selectedNode.set(node);
			updateBuffers();
			scheduleRender();
		}
	};

	const handleMouseLeave = () => {
		if ($hoveredNode) {
			hoveredNode.set(null);
			updateBuffers();
			scheduleRender();
		}
	};

	// Zoom handling
	let isDragging = false;
	let lastMouse = { x: 0, y: 0 };

	const handleMouseDown = (event) => {
		if (event.button === 0) {
			isDragging = true;
			lastMouse = { x: event.clientX, y: event.clientY };
			canvas.style.cursor = 'grabbing';
		}
	};

	const handleMouseUp = () => {
		isDragging = false;
		canvas.style.cursor = $hoveredNode ? 'pointer' : 'grab';
	};

	const handleDrag = (event) => {
		if (!isDragging) return;

		const dx = event.clientX - lastMouse.x;
		const dy = event.clientY - lastMouse.y;
		lastMouse = { x: event.clientX, y: event.clientY };

		transform.x += dx;
		transform.y += dy;

		scheduleRender();
	};

	const handleWheel = (event) => {
		event.preventDefault();

		const rect = canvas.getBoundingClientRect();
		const mouseX = event.clientX - rect.left;
		const mouseY = event.clientY - rect.top;

		const scaleFactor = event.deltaY > 0 ? 0.9 : 1.1;
		const newScale = Math.max(0.1, Math.min(10, transform.k * scaleFactor));

		// Zoom toward mouse position
		transform.x = mouseX - (mouseX - transform.x) * (newScale / transform.k);
		transform.y = mouseY - (mouseY - transform.y) * (newScale / transform.k);
		transform.k = newScale;

		scheduleRender();
	};

	const loadData = async () => {
		try {
			const response = await fetch('/data/graph-layout.json');
			const data = await response.json();

			nodes = data.nodes;
			edges = data.edges;
			bounds = data.bounds;

			// Build lookup
			nodeById = new Map(nodes.map(n => [n.id, n]));

			// Initialize
			updateBuffers();
			handleResize();
		} catch (error) {
			console.error('Failed to load graph data:', error);
		}
	};

	onMount(() => {
		if (!initWebGL()) return;

		loadData();

		window.addEventListener('resize', handleResize);
		window.addEventListener('mousemove', handleDrag);
		window.addEventListener('mouseup', handleMouseUp);

		return () => {
			window.removeEventListener('resize', handleResize);
			window.removeEventListener('mousemove', handleDrag);
			window.removeEventListener('mouseup', handleMouseUp);
			if (animationFrame) cancelAnimationFrame(animationFrame);
		};
	});

	// React to filter changes
	$: if (gl && nodes.length > 0 && $filters) {
		updateBuffers();
		scheduleRender();
	}
</script>

<div class="network-graph" bind:this={container}>
	<canvas
		bind:this={canvas}
		on:mousemove={handleMouseMove}
		on:click={handleClick}
		on:mouseleave={handleMouseLeave}
		on:mousedown={handleMouseDown}
		on:wheel={handleWheel}
	></canvas>
</div>

<style>
	.network-graph {
		width: 100%;
		height: 100%;
		position: relative;
	}

	canvas {
		display: block;
		cursor: grab;
	}
</style>
