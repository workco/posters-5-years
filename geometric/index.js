/**
 * Does everything
 */
window.addEventListener('DOMContentLoaded', () => {
	init();
});

/**
 * Whenever the screen resizes, also re-set everything
 */
window.addEventListener('resize', () => {
	init(); // engine.resize();
});

function init() {
	// Load and reset HTML container
	const container = document.getElementById("poster");
	container.innerHTML = "";

	// Some constants
	window.SIDES_TOP_LEFT = "tl";
	window.SIDES_TOP_RIGHT = "tr";
	window.SIDES_BOTTOM_LEFT = "bl";
	window.SIDES_BOTTOM_RIGHT = "br";
	window.SIDES_RIGHT = "r";
	window.SIDES_LEFT = "l";
	window.SIDES_TOP = "t";
	window.SIDES_BOTTOM = "b";

	// Create canvas and add to HTML
	const { width, height } = this.getPosterSize();
	const canvas = document.createElement('canvas');
	canvas.width = width;
	canvas.height = height;
	container.appendChild(canvas);

	// Some settings
	const SPACING_SCALE = width / 642;
	window.BACKGROUND_COLOR = "#ef5a46";
	window.FOREGROUND_COLOR = "#ffffff";
	window.GUTTER_HORIZONTAL = 29 * SPACING_SCALE;
	window.GUTTER_VERTICAL = 27 * SPACING_SCALE;
	window.MARGIN_HORIZONTAL = 46 * SPACING_SCALE;
	window.MARGIN_VERTICAL = 42 * SPACING_SCALE;
	window.NUM_COLS = 2;

	// All modules that can be drawn
	const TYPICAL_SIZE = 260;
	const TYPICAL_TOTAL_WIDTH = TYPICAL_SIZE * NUM_COLS + GUTTER_HORIZONTAL * (NUM_COLS - 1);

	window.MODULES = {
		rectL: {
			rows: 1, cols: 2, width: TYPICAL_TOTAL_WIDTH * 0.95, height: TYPICAL_SIZE * 0.93,
			render: (c, module) => { renderRect(c, module.width, module.height); },
		},
		rectR: {
			rows: 1, cols: 2, width: TYPICAL_TOTAL_WIDTH * 0.95, height: TYPICAL_SIZE * 0.93,
			render: (c, module) => { renderRect(c, module.width, module.height, TYPICAL_TOTAL_WIDTH - module.width); },
		},
		triangleTL: {
			rows: 1, cols: 1, width: TYPICAL_SIZE, height: TYPICAL_SIZE,
			render: (c, module) => { renderTriangle(c, module.width, module.height, SIDES_TOP_LEFT); },
		},
		triangleTR: {
			rows: 1, cols: 1, width: TYPICAL_SIZE, height: TYPICAL_SIZE,
			render: (c, module) => { renderTriangle(c, module.width, module.height, SIDES_TOP_RIGHT); },
		},
		triangleBL: {
			rows: 1, cols: 1, width: TYPICAL_SIZE, height: TYPICAL_SIZE,
			render: (c, module) => { renderTriangle(c, module.width, module.height, SIDES_BOTTOM_LEFT); },
		},
		triangleBR: {
			rows: 1, cols: 1, width: TYPICAL_SIZE, height: TYPICAL_SIZE,
			render: (c, module) => { renderTriangle(c, module.width, module.height, SIDES_BOTTOM_RIGHT); },
		},
		arcTL: {
			rows: 1, cols: 1, width: TYPICAL_SIZE, height: TYPICAL_SIZE,
			render: (c, module) => { renderArc(c, module.width, module.height, SIDES_TOP_LEFT); },
		},
		arcTR: {
			rows: 1, cols: 1, width: TYPICAL_SIZE, height: TYPICAL_SIZE,
			render: (c, module) => { renderArc(c, module.width, module.height, SIDES_TOP_RIGHT); },
		},
		arcBL: {
			rows: 1, cols: 1, width: TYPICAL_SIZE, height: TYPICAL_SIZE,
			render: (c, module) => { renderArc(c, module.width, module.height, SIDES_BOTTOM_LEFT); },
		},
		arcBR: {
			rows: 1, cols: 1, width: TYPICAL_SIZE, height: TYPICAL_SIZE,
			render: (c, module) => { renderArc(c, module.width, module.height, SIDES_BOTTOM_RIGHT); },
		},
		pointyL: {
			rows: 1, cols: 1, width: TYPICAL_SIZE, height: TYPICAL_SIZE,
			render: (c, module) => { renderPointy(c, module.width, module.height, SIDES_LEFT); },
		},
		pointyR: {
			rows: 1, cols: 1, width: TYPICAL_SIZE, height: TYPICAL_SIZE,
			render: (c, module) => { renderPointy(c, module.width, module.height, SIDES_RIGHT); },
		},
		pointyT: {
			rows: 1, cols: 1, width: TYPICAL_SIZE, height: TYPICAL_SIZE,
			render: (c, module) => { renderPointy(c, module.width, module.height, SIDES_TOP); },
		},
		pointyB: {
			rows: 1, cols: 1, width: TYPICAL_SIZE, height: TYPICAL_SIZE,
			render: (c, module) => { renderPointy(c, module.width, module.height, SIDES_BOTTOM); },
		},
		space: {
			rows: 1, cols: 1, width: TYPICAL_SIZE, height: TYPICAL_SIZE,
		},
		square: {
			rows: 1, cols: 1, width: TYPICAL_SIZE, height: TYPICAL_SIZE,
			render: (c, module) => { renderRect(c, module.width, module.height); },
		}
	};

	// Definitions for all symbols
	window.SYMBOLS = {
		"0": [ "arcBR", "arcBL", "square", "square", "arcTR", "arcTL" ],
		"1": [ "triangleBR", "square", "space", "square", "space", "square" ],
		"2": [ "arcBR", "arcBL", "triangleBR", "triangleTL", "rectL" ],
		"3": [ "rectR", "pointyR", "triangleTL", "arcTR", "arcTL" ],
		"4": [ "square", "square", "arcTR", "square", "space", "square" ],
		"5": [ "rectL", "triangleTR", "arcBL", "arcTR", "arcTL" ],
		"6": [ "arcBR", "arcBL", "square", "arcBL", "arcTR", "arcTL" ],
		"7": [ "rectR", "triangleBR", "triangleTL", "square" ],
		"8": [ "arcBR", "arcBL", "arcBR", "arcBL", "arcTR", "arcTL" ],
		"9": [ "arcBR", "arcBL", "arcTR", "square", "space", "square" ],
	};

	// Sets current symbol
	let currentSymbol = "5";

	// Animates numbers going up to 5, stopping, then counting again
	const animate = () => {
		let t = 0;
		let interval = 1000;

		// Wait a bit
		t += 10000;

		// Starts counting up
		for (let i = 0; i < 60; i++) {
			setTimeout(bumpNumber, t);
			t += interval;
			interval *= 0.9;
		}

		// And restart
		setTimeout(animate, t);
	};

	const bumpNumber = () => {
		const num = (parseInt(currentSymbol) + 1) % 10;
		currentSymbol = num.toString(10);
	};

	// Animates
	const renderFrame = () => {
		const c = canvas.getContext("2d");
		// Clear
		c.fillStyle = BACKGROUND_COLOR;
		c.beginPath();
		c.rect(0, 0, canvas.width, canvas.height);
		c.fill();

		// Draw current symbol
		drawSymbol(currentSymbol, c);

		// Continue animating
		requestAnimationFrame(renderFrame);
	};

	// Starts rendering, and triggers animation
	animate();
	renderFrame();
}

/**
 * Draws all modules of a specific symbol on the canvas
 */
function drawSymbol(symbol, context) {
	// Draws every part
	const symbolInfo = SYMBOLS[symbol];
	if (symbolInfo) {
		let x = 0;
		let y = 0;
		let col = 0;
		let row = 0;
		let prevHeight = 0;

		// Calculate size matrix first, so it's centered
		let contentWidth = 0;
		symbolInfo.forEach((id, index) => {
			const module = MODULES[id];
			if (module) {
				// Break line if needed
				if (col + module.cols > NUM_COLS) {
					row += 1;
					col = 0;
					x = 0;
					y += prevHeight + GUTTER_VERTICAL;
					prevHeight = 0;
				}

				// Push the col/row position
				col += module.cols;
				x += module.width;
				contentWidth = Math.max(contentWidth, x);
				x += GUTTER_HORIZONTAL;
				prevHeight = Math.max(module.height, prevHeight);
			}
		});
		y += prevHeight;

		// Finally, calculate
		const viewWidth = context.canvas.width - MARGIN_HORIZONTAL * 2;
		const viewHeight = context.canvas.height - MARGIN_VERTICAL * 2;
		const viewAspectRatio = viewWidth / viewHeight;

		let contentHeight = y;
		let contentAspectRatio = contentWidth / contentHeight;
		let desiredScale = contentAspectRatio > viewAspectRatio ? viewWidth / contentWidth : viewHeight / contentHeight;

		context.save();
		context.translate(MARGIN_HORIZONTAL, MARGIN_VERTICAL);
		context.scale(desiredScale, desiredScale);
		context.translate((viewWidth - contentWidth * desiredScale) * 0.5, (viewHeight - contentHeight * desiredScale) * 0.5);

		// Redoes it and actually draw all elements
		x = 0;
		y = 0;
		col = 0;
		row = 0;
		prevHeight = 0;

		symbolInfo.forEach((id, index) => {
			const module = MODULES[id];

			if (!module) {
				console.warn(`Cannot render module of type ${id}!`);
			} else {
				// Break line if needed
				if (col + module.cols > NUM_COLS) {
					row += 1;
					col = 0;
					x = 0;
					y += prevHeight + GUTTER_VERTICAL;
					prevHeight = 0;
				}

				// Finally, temporarily move to the target position and draw there
				if (module.render) {
					context.save();
					context.translate(x, y);
					module.render(context, module);
					context.restore();
				}

				// Push the col/row position
				col += module.cols;
				x += module.width + GUTTER_HORIZONTAL;
				prevHeight = Math.max(module.height, prevHeight);
			}
		});

		context.restore();
	} else {
		console.warn(`Cannot find symbol definition for id [${symbol}]!`);
	}
}

/**
 * Draws the rectangular module
 */
function renderRect(context, width, height, offsetX = 0) {
	context.beginPath();
	context.rect(offsetX, 0, width, height);
	context.fillStyle = FOREGROUND_COLOR;
	context.fill();
}

/**
 * Draws a triangle "corner" module
 */
function renderTriangle(context, width, height, type) {
	// Define corners
	const tl = [0, 0];
	const tr = [width, 0];
	const bl = [0, height];
	const br = [width, height];

	// Define points to be used
	const points = [];
	if (type !== SIDES_BOTTOM_RIGHT) points.push(tl);
	if (type !== SIDES_BOTTOM_LEFT) points.push(tr);
	if (type !== SIDES_TOP_RIGHT) points.push(bl);
	if (type !== SIDES_TOP_LEFT) points.push(br);

	// Finally, draw
	context.fillStyle = FOREGROUND_COLOR;
	context.beginPath();
	points.forEach((p, index) => {
		if (index === 0) {
			context.moveTo(p[0], p[1]);
		} else {
			context.lineTo(p[0], p[1]);
		}
	});
	context.closePath();
	context.fill();
}

/**
 * Draws an arc "corner" module
 */
function renderArc(context, width, height, type) {
	// Define corners
	const tl = [0, 0];
	const tr = [width, 0];
	const bl = [0, height];
	const br = [width, height];
	const radius = width;
	const DEG_0 = 0;
	const DEG_90 = Math.PI * 0.5;
	const DEG_180 = Math.PI;
	const DEG_270 = Math.PI * 1.5;

	// Finally, draw
	context.fillStyle = FOREGROUND_COLOR;
	context.beginPath();
	switch (type) {
		case SIDES_BOTTOM_LEFT:
			context.moveTo(tl[0], tl[1]);
			context.arc(bl[0], bl[1], width, DEG_270, DEG_0);
			context.lineTo(bl[0], bl[1]);
			break;
		case SIDES_BOTTOM_RIGHT:
			context.moveTo(br[0], br[1]);
			context.lineTo(bl[0], bl[1]);
			context.arc(br[0], br[1], width, DEG_180, DEG_270);
			break;
		case SIDES_TOP_LEFT:
			context.moveTo(tl[0], tl[1]);
			context.lineTo(tr[0], tr[1]);
			context.arc(tl[0], tl[1], width, DEG_0, DEG_90);
			break;
		case SIDES_TOP_RIGHT:
			context.moveTo(tr[0], tr[1]);
			context.lineTo(br[0], br[1]);
			context.arc(tr[0], tr[1], width, DEG_90, DEG_180);
			break;
	}
	context.closePath();
	context.fill();
}

/**
 * Draws a "pointy" module, which is just a smaller triangle
 */
function renderPointy(context, width, height, type) {
	// Define corners
	const tl = [0, 0];
	const tr = [width, 0];
	const bl = [0, height];
	const br = [width, height];
	const cr = [width / 2, height / 2];

	// Define points to be used
	let points = [];
	if (type === SIDES_TOP)    points = [tl, tr, cr];
	if (type === SIDES_BOTTOM) points = [bl, br, cr];
	if (type === SIDES_LEFT)   points = [tl, bl, cr];
	if (type === SIDES_RIGHT)  points = [tr, br, cr];

	// Finally, draw
	context.fillStyle = FOREGROUND_COLOR;
	context.beginPath();
	points.forEach((p, index) => {
		if (index === 0) {
			context.moveTo(p[0], p[1]);
		} else {
			context.lineTo(p[0], p[1]);
		}
	});
	context.closePath();
	context.fill();
}

/**
 * Maps a value from one range to another range
 */
function map(value, min1, max1, min2, max2, clamp) {
	let f = (value - min1) / (max1 - min1);
	if (clamp) f = f < 0 ? 0 : (f > 1 ? 1 : f);
	return min2 + f * (max2 - min2);
}

/**
 * Based on the screen size, returns a poster size that maintains the desired aspect ratio
 */
function getPosterSize() {
	// Expected size and margins
	const POSTER_ASPECT_RATIO = 0.714922048997773;
	const MIN_MARGIN = 20;

	// Calculate target dimensions
	const VIEW_WIDTH = window.innerWidth - MIN_MARGIN * 2;
	const VIEW_HEIGHT = window.innerHeight - MIN_MARGIN * 2;
	const VIEW_ASPECT_RATIO = VIEW_WIDTH / VIEW_HEIGHT;

	// Find sizes to fit
	if (VIEW_ASPECT_RATIO > POSTER_ASPECT_RATIO) {
		// Screen is longer than poster, use view height as basis
		return {
			width: Math.round(VIEW_HEIGHT * POSTER_ASPECT_RATIO),
			height: Math.round(VIEW_HEIGHT),
		};
	} else {
		// Screen is taller than poster, use view width as basis
		return {
			width: Math.round(VIEW_WIDTH),
			height: Math.round(VIEW_WIDTH / POSTER_ASPECT_RATIO),
		};
	}
}
