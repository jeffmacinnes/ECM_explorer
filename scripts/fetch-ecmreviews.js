import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as cheerio from 'cheerio';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '../data');
const RAW_DIR = path.join(DATA_DIR, 'raw');

// Rate limiting for fetching individual reviews
const RATE_LIMIT_MS = 500;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Fetch with retry
const fetchWithRetry = async (url, retries = 3) => {
	for (let i = 0; i < retries; i++) {
		try {
			const response = await fetch(url, {
				headers: {
					'User-Agent': 'ECMExplorer/1.0 (cataloging ECM discography)'
				}
			});
			if (!response.ok) {
				throw new Error(`HTTP ${response.status}`);
			}
			return await response.text();
		} catch (err) {
			if (i === retries - 1) throw err;
			await sleep(1000 * (i + 1));
		}
	}
};

// Parse the main catalog page
const parseCatalogPage = (html) => {
	const $ = cheerio.load(html);
	const entries = [];
	let currentSeries = 'ECM';

	// The content is in the main entry-content div
	const content = $('.entry-content');

	// Process all text and links
	content.find('p').each((_, p) => {
		const $p = $(p);
		const html = $p.html();
		if (!html) return;

		// Check for series headers
		if (html.includes('<strong>ECM RECORDINGS')) currentSeries = 'ECM';
		else if (html.includes('<strong>ECM NEW SERIES')) currentSeries = 'ECM New Series';
		else if (html.includes('<strong>JAPO')) currentSeries = 'JAPO';
		else if (html.includes('<strong>WATT')) currentSeries = 'WATT';
		else if (html.includes('<strong>CARMO')) currentSeries = 'CARMO';
		else if (html.includes('<strong>JCOA')) currentSeries = 'JCOA';

		// Split by <br> to get individual entries
		const lines = html.split(/<br\s*\/?>/i);

		for (const line of lines) {
			// Parse each line for catalog entries
			const $line = cheerio.load(`<div>${line}</div>`);

			// Find catalog number (linked or plain text)
			const link = $line('a').first();
			let catalogNumber = '';
			let reviewUrl = null;

			if (link.length) {
				const linkText = link.text().trim();
				// Match catalog numbers with possible leading/trailing whitespace
				if (linkText.match(/(ECM|JAPO|WATT|CARMO|JCOA)[\s-]*\d/i)) {
					catalogNumber = linkText;
					reviewUrl = link.attr('href');
				}
			}

			// If no link found, try to find catalog number in plain text
			if (!catalogNumber) {
				const textMatch = line.match(/(ECM|JAPO|WATT|CARMO|JCOA)[\s-]*(\d+(?:\/\d+)?(?:\s*NS)?)/i);
				if (textMatch) {
					catalogNumber = textMatch[0].trim();
				}
			}

			if (!catalogNumber) continue;

			// Extract artist (in <strong> tags)
			const artistMatch = line.match(/<strong>([^<]+)<\/strong>/);
			const artist = artistMatch ? artistMatch[1].trim() : '';

			// Extract title (in <em> tags)
			const titleMatch = line.match(/<em>([^<]+)<\/em>/);
			const title = titleMatch ? titleMatch[1].trim() : '';

			// Extract recording date (in parentheses at end)
			const dateMatch = line.match(/\(([^)]+)\)\s*$/);
			const recordingDate = dateMatch ? dateMatch[1].trim() : '';

			if (artist || title) {
				entries.push({
					catalogNumber,
					series: currentSeries,
					artist,
					title: title || 's/t', // self-titled
					recordingDate,
					reviewUrl
				});
			}
		}
	});

	return entries;
};

// Fetch a single review page and extract the review text
const fetchReview = async (url) => {
	try {
		const html = await fetchWithRetry(url);
		const $ = cheerio.load(html);

		// Get the main content
		const content = $('.entry-content');

		// Remove any embedded media, scripts, etc.
		content.find('iframe, script, style, .sharedaddy, .jp-relatedposts').remove();

		// Get text content, preserving paragraph breaks
		let reviewText = '';
		content.find('p').each((_, p) => {
			const text = $(p).text().trim();
			if (text) {
				reviewText += text + '\n\n';
			}
		});

		return reviewText.trim();
	} catch (err) {
		console.error(`  Error fetching review: ${err.message}`);
		return null;
	}
};

// Main execution
const main = async () => {
	// Parse command line args
	const args = process.argv.slice(2);
	const limitIndex = args.indexOf('--limit');
	const LIMIT = limitIndex !== -1 ? parseInt(args[limitIndex + 1], 10) : null;
	const skipReviews = args.includes('--skip-reviews');

	if (LIMIT) {
		console.log(`Running in test mode: limiting to ${LIMIT} entries\n`);
	}

	// Ensure directories exist
	fs.mkdirSync(DATA_DIR, { recursive: true });
	fs.mkdirSync(RAW_DIR, { recursive: true });

	// Step 1: Fetch and parse the catalog page
	console.log('Fetching ECM Reviews catalog page...');
	const catalogHtml = await fetchWithRetry('https://ecmreviews.com/by-catalogue-number/');
	fs.writeFileSync(path.join(RAW_DIR, 'ecmreviews-catalog.html'), catalogHtml);

	console.log('Parsing catalog entries...');
	let entries = parseCatalogPage(catalogHtml);
	console.log(`Found ${entries.length} catalog entries\n`);

	// Apply limit if specified
	if (LIMIT) {
		entries = entries.slice(0, LIMIT);
	}

	// Save catalog entries (without reviews yet)
	fs.writeFileSync(
		path.join(RAW_DIR, 'ecmreviews-catalog.json'),
		JSON.stringify(entries, null, 2)
	);

	// Step 2: Fetch individual reviews
	if (!skipReviews) {
		console.log('Fetching individual reviews...');

		// Check for existing progress
		const progressFile = path.join(RAW_DIR, 'ecmreviews-progress.json');
		let reviews = {};
		let startIndex = 0;

		if (fs.existsSync(progressFile)) {
			const progress = JSON.parse(fs.readFileSync(progressFile, 'utf-8'));
			reviews = progress.reviews || {};
			startIndex = progress.lastIndex + 1;
			console.log(`Resuming from index ${startIndex}\n`);
		}

		for (let i = startIndex; i < entries.length; i++) {
			const entry = entries[i];
			if (!entry.reviewUrl) {
				console.log(`[${i + 1}/${entries.length}] ${entry.catalogNumber} - No review URL`);
				continue;
			}

			// Skip if already fetched
			if (reviews[entry.catalogNumber]) {
				continue;
			}

			console.log(`[${i + 1}/${entries.length}] Fetching: ${entry.catalogNumber} - ${entry.title}`);

			const reviewText = await fetchReview(entry.reviewUrl);
			if (reviewText) {
				reviews[entry.catalogNumber] = reviewText;
			}

			// Save progress every 10 reviews
			if ((i + 1) % 10 === 0) {
				fs.writeFileSync(progressFile, JSON.stringify({
					reviews,
					lastIndex: i
				}));
			}

			await sleep(RATE_LIMIT_MS);
		}

		// Final save
		fs.writeFileSync(
			path.join(RAW_DIR, 'ecmreviews-reviews.json'),
			JSON.stringify(reviews, null, 2)
		);
		console.log(`\nSaved ${Object.keys(reviews).length} reviews`);

		// Merge reviews into entries
		for (const entry of entries) {
			entry.review = reviews[entry.catalogNumber] || null;
		}
	}

	// Save final catalog with reviews
	fs.writeFileSync(
		path.join(DATA_DIR, 'ecm-catalog-reviews.json'),
		JSON.stringify({
			entries,
			meta: {
				source: 'ecmreviews.com',
				fetchedAt: new Date().toISOString(),
				totalEntries: entries.length,
				entriesWithReviews: entries.filter(e => e.review).length
			}
		}, null, 2)
	);

	// Summary by series
	const bySeries = {};
	for (const entry of entries) {
		bySeries[entry.series] = (bySeries[entry.series] || 0) + 1;
	}

	console.log('\n✓ Done!');
	console.log(`  Total entries: ${entries.length}`);
	console.log('  By series:');
	for (const [series, count] of Object.entries(bySeries)) {
		console.log(`    ${series}: ${count}`);
	}
	console.log(`\nData saved to: src/lib/data/ecm-catalog-reviews.json`);
};

main().catch(console.error);
