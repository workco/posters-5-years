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

	// Some global constants
	window.MOVE = "move";
	window.LINE = "line";
	window.SPLINE = "spline";
	window.ARC = "arc";

	// Create canvas and add to HTML
	const { width, height } = this.getPosterSize();
	const canvas = document.createElement('canvas');
	canvas.width = width;
	canvas.height = height;
	container.appendChild(canvas);

	// Some global parameters
	window.BACKGROUND_COLOR = "#000002";
	window.RIBBON_COLOR_ODD = "#ffffff";
	window.RIBBON_COLOR_EVEN = "#000002";
	window.RIBBONS = 6;
	window.DEFAULT_WIDTH = 112;
	window.DEFAULT_HEIGHT = 170;
	window.SIZE_RATIO = DEFAULT_WIDTH / DEFAULT_HEIGHT;

	// Definitions for the "5" character
	const CHAR_PATH = [
		{type: MOVE,   x: 460, y: 85},
		{type: LINE,   x: 170, y: 85},
		{type: SPLINE, x: 64,  y: 170, c1x: 0.55, c1y: 0,    c2x: 1,    c2y: 0.45},
		{type: LINE,   x: 64,  y: 280},
		{type: SPLINE, x: 152, y: 364, c1x: 0,    c1y: 0.55, c2x: 0.45, c2y: 1},
		{type: LINE,   x: 240, y: 364},
		{type: ARC,    x: 240, y: 551, to: 153},
	];
	const CHAR_WIDTH = 240 + (551 - 364) + DEFAULT_WIDTH / 2;
	const CHAR_HEIGHT = 551 + (551 - 364) + DEFAULT_HEIGHT / 2;
	const MARGIN_HORIZONTAL = 46;
	const MARGIN_VERTICAL = 42;

	let charRibbonStart = 0;
	let charRibbonEnd = 1;
	const timeStart = Date.now() / 1000;

	// Animates
	const renderFrame = () => {
		const context = canvas.getContext("2d");

		// Animates ribbon start/end over time
		const animationTime = 15;
		const now = Date.now() / 1000 - timeStart;
		const t = (now % animationTime) / animationTime;

		charRibbonStart = easeInOutSine(map(t, 0.7, 0.9, 0, 1, true));
		charRibbonEnd = easeInOutSine(map(t, 0, 0.2, 0, 1, true));

		// Clear
		context.fillStyle = BACKGROUND_COLOR;
		context.beginPath();
		context.rect(0, 0, canvas.width, canvas.height);
		context.closePath();
		context.fill();

		// Use a matrix to center the char in the current canvas size
		const aspectRatio = width / height;
		const contentWidth = CHAR_WIDTH + MARGIN_HORIZONTAL * 2;
		const contentHeight = CHAR_HEIGHT + MARGIN_VERTICAL * 2;
		const contentAspectRatio = contentWidth / contentHeight;
		const desiredScale = contentAspectRatio > aspectRatio ? width / contentWidth : height / contentHeight;

		context.save();
		context.translate(width / 2, height / 2);
		context.scale(desiredScale, desiredScale);
		context.translate(contentWidth * -0.5, contentHeight * -0.5);
		context.translate(MARGIN_HORIZONTAL, MARGIN_VERTICAL);

		// Draw character
		drawCharacter(CHAR_PATH, charRibbonStart, charRibbonEnd, context);

		context.restore();

		// Continue animating
		requestAnimationFrame(renderFrame);
	};

	// Starts rendering, and triggers animation
	renderFrame();
}

/**
 * Draws the character ribbon
 */
function drawCharacter(path, start, end, context) {
	const min = DEFAULT_HEIGHT * -0.5;
	const max = DEFAULT_HEIGHT * 0.5;
	const ribbons = RIBBONS * 2 - 1;
	for (let i = 0; i < ribbons; i++) {
		const color = i % 2 === 0 ? RIBBON_COLOR_ODD : RIBBON_COLOR_EVEN;
		const inX = map(i, 0, ribbons, min, max);
		const outX = map(i + 1, 0, ribbons, min, max);
		drawRibbon(path, inX, outX, color, start, end, context);
	}

	// drawPathTemp(path, min, context);
	// drawPathTemp(path, max, context);
}

function drawRibbon(path, extrusionIn, extrusionOut, color, start, end, context) {
	const pathIn = extrudePath(path, extrusionIn);
	const pathOut = extrudePath(path, extrusionOut);
	const points = [...generatePathPoints(pathIn, start, end), ...generatePathPoints(pathOut, start, end).reverse()];

	// Segment points
	context.fillStyle = color;
	context.beginPath();
	points.forEach((p, index) => {
		if (index === 0) {
			context.moveTo(p.x, p.y);
		} else {
			context.lineTo(p.x, p.y);
		}
	});
	context.closePath();
	context.fill();
}

function drawPathTemp(path, extrusion, context) {
	const newPath = extrudePath(path, extrusion);
	const points = generatePathPoints(newPath);

	// Lines
	context.fillStyle = RIBBON_COLOR_ODD;
	context.strokeStyle = RIBBON_COLOR_ODD;
	points.forEach((p, index) => {
		if (index === 0) {
			context.moveTo(p.x, p.y);
		} else {
			context.lineTo(p.x, p.y);
		}
	});
	context.stroke();

	// Segment points
	context.fillStyle = RIBBON_COLOR_ODD;
	points.forEach((p, index) => {
		context.beginPath();
		context.arc(p.x, p.y, 2, 0, 2 * Math.PI);
		context.closePath();
		context.fill();
	});

	// Key points
	context.fillStyle = RIBBON_COLOR_ODD;
	newPath.forEach((p, index) => {
		context.beginPath();
		context.arc(p.x, p.y, 4, 0, 2 * Math.PI);
		context.closePath();
		context.fill();
	});
}

/**
 * Extrudes a path, moving it on a direction by an offset
 */
function extrudePath(path, extrusion) {
	const HALF_PI = Math.PI / 2;
	const curveExtrusionScale = map(extrusion, DEFAULT_HEIGHT * -0.5, DEFAULT_HEIGHT * 0.5, 0.5, 1.5);

	let lastPoint = {x: 0, y: 0}

	const findNormalInPathSegmentStart = (prevPoint, pathSegment, scalar = 1, offsetAngle = 0) => {
		const newPoint = {x: pathSegment.x, y: pathSegment.y};
		const angle = findAngle(prevPoint, newPoint) + HALF_PI + offsetAngle;
		const normal = getPointOnCircle({x: 0, y: 0}, extrusion, angle);
		normal.x *= scalar;
		normal.y *= scalar;
		return normal;
	}

	let extrusionDirection = 1;
	const extrudedPath = path.map((segment, index, array) => {
		if (extrusion === 0) return segment;

		let newPoint = {x: segment.x, y: segment.y};
		const nextP = index < array.length - 1 ? array[index + 1] : undefined;
		let newSegment = segment;
		let sizeRatio = extrusionDirection > 0 ? SIZE_RATIO : SIZE_RATIO;

		if (segment.type === MOVE) {
			// Move: use the next segment's normal
			const normal = findNormalInPathSegmentStart(newPoint, nextP, extrusionDirection);
			newSegment = {...segment, x: newPoint.x + normal.x, y: newPoint.y + normal.y};
		} else if (segment.type === LINE) {
			// Line: extrusion is along the line normal
			if (nextP && nextP.type === SPLINE) {
				// Next segment is spline, so contract the line end by the extrusion amount
				const normalPrev = findNormalInPathSegmentStart(lastPoint, segment, extrusionDirection, HALF_PI);
				newPoint = {x: newPoint.x + normalPrev.x, y: newPoint.y + normalPrev.y * sizeRatio};
			}
			const normal = findNormalInPathSegmentStart(lastPoint, segment, extrusionDirection);
			newSegment = {...segment, x: newPoint.x + normal.x * sizeRatio, y: newPoint.y + normal.y};
		} else if (segment.type === SPLINE) {
			if (nextP && nextP.type === LINE) {
				// Next segment is line, use its normal /but invert it/ and also contract the line start by the extrusion amount
				const normalNext = findNormalInPathSegmentStart(newPoint, nextP, extrusionDirection, HALF_PI);
				newPoint = {x: newPoint.x + normalNext.x, y: newPoint.y + normalNext.y * sizeRatio};
				extrusionDirection *= -1;
				const normal = findNormalInPathSegmentStart(newPoint, nextP, extrusionDirection);
				newSegment = {...segment, x: newPoint.x + normal.x * sizeRatio, y: newPoint.y + normal.y};
			}
		} else if (segment.type === ARC) {
			// Fine, can continue
		} else {
		}

		lastPoint = newPoint;

		return newSegment;
	});

	return extrudedPath;
}

/**
 * Based on a path of commands, returns points that draw that path
 */
function generatePathPoints(path, start = 0, end = 1) {
	const MAX_SEGMENT_LENGTH = 6; // Minimum segment length, for precision

	let points = [];
	let lastPoint = {x: 0, y: 0};

	// Creates points
	path.forEach((p, index, array) => {
		const newPoint = {x: p.x, y: p.y};

		if (p.type === MOVE) {
			// Regular move to point
			points.push(newPoint);
		} else if (p.type === LINE) {
			// Generates a line with points in between
			points = points.concat(generateLine(lastPoint, newPoint, MAX_SEGMENT_LENGTH));
			// Also adds the last point
			points.push(newPoint);
		} else if (p.type === SPLINE) {
			// Generates a curve with points in between
			const controlPoint1 = {x: p.c1x, y: p.c1y};
			const controlPoint2 = {x: p.c2x, y: p.c2y};
			points = points.concat(generateSpline(lastPoint, controlPoint1, controlPoint2, newPoint, MAX_SEGMENT_LENGTH));
			// Also adds the last point
			points.push(newPoint);
		} else if (p.type === ARC) {
			// Generates an arc with all points
			points = points.concat(generateArc(lastPoint, newPoint, p.to, MAX_SEGMENT_LENGTH));
		} else {
			// Ignore and draw a straight line
			points.push(newPoint);
		}

		// Continue
		lastPoint = newPoint;
	});

	points = getSlicedPathPoints(points, start, end)

	return points;
}

/**
 * Slice a line by start/end
 */
function getSlicedPathPoints(points, start, end) {
	// This is a quick way to do it; a better way would be to calculate path length and do it based
	// on actual position on the entire path
	const startIndex = Math.floor(start * (points.length - 1));
	const endIndex = Math.ceil(end * (points.length - 1));
	return points.slice(startIndex, endIndex);
}

/**
 * Generates a number of points between two points, with a maximum segment length between each point
 * DOES NOT include the first or last points in the line!
 */
function generateLine(p1, p2, maxSegmentLength) {
	const points = [];
	const numSegments = Math.ceil(findDistance(p2, p1) / maxSegmentLength);
	const dx = p2.x - p1.x;
	const dy = p2.y - p1.y;

	for (let i = 1; i < numSegments; i++) {
		const f = i / numSegments;
		points.push({x: p1.x + f * dx, y: p1.y + f * dy})
	}

	return points;
}

/**
 * Generates points in a curve, with a maximum segment length between each point [ignored]
 * DOES NOT include the first or last points in the curve
 */
function generateSpline(p1, cp1f, cp2f, p2, maxSegmentLength) {
	const points = [];
	const numSegments = 20; // findDistance(p1, p2) / 6; // This is an approximation; ideally we'd use maxSegmentLength instead
	const dx = p2.x - p1.x;
	const dy = p2.y - p1.y;

	const cp1 = {x: p1.x + dx * cp1f.x, y: p1.y + dy * cp1f.y};
	const cp2 = {x: p1.x + dx * cp2f.x, y: p1.y + dy * cp2f.y};

	for (let i = 1; i < numSegments; i++) {
		const f = i / numSegments;
		points.push(getPointOnBezier(p1, cp1, cp2, p2, f));
	}

	return points;
}

/**
 * Finds a point on a bezier curve
 */
function getPointOnBezier(p1, cp1, cp2, p2, t) {
	const nt = 1 - t;
	const t2 = t * t;
	const nt2 = nt * nt;
	return {
		x: nt * nt2 * p1.x + 3 * nt2 * t * cp1.x + 3 * nt * t2 * cp2.x + t * t2 * p2.x,
		y: nt * nt2 * p1.y + 3 * nt2 * t * cp1.y + 3 * nt * t2 * cp2.y + t * t2 * p2.y,
	};
}

/**
 * Generates points on an arc, with a maximum segment length between each point
 * DOES NOT include the first or last points in the arc
 */
function generateArc(p1, center, endAngleDeg, maxSegmentLength) {
	const points = [];
	const radius = findDistance(p1, center);
	const endAngle = endAngleDeg / 180 * Math.PI;
	let startAngle = findAngle(center, p1);
	while (startAngle > endAngle) startAngle -= Math.PI * 2;

	const segmentInRadians = 1 / 180 * Math.PI * 2;
	const angleDiff = endAngle - startAngle;
	const numSegments = Math.ceil(angleDiff / segmentInRadians);

	for (let i = 1; i < numSegments; i++) {
		const f = i / numSegments;
		points.push(getPointOnCircle(center, radius, startAngle + f * angleDiff));
	}

	return points;
}

/**
 * Returns a point on a circle
 */
function getPointOnCircle(center, radius, angle) {
	return {
		x: center.x + radius * Math.cos(angle),
		y: center.y + radius * Math.sin(angle),
	};
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
 * Re-maps an animation t value (0-1) in a way that produces an easeInOutSine smooth transition
 */
function easeInOutSine(t) {
	return (Math.cos(t * Math.PI) - 1) * -0.5;
}

/**
 * Returns the distance between two points
 */
function findDistance(p1, p2) {
	const dx = p2.x - p1.x;
	const dy = p2.y - p1.y;
	return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Finds the angle between two points, in radians
 */
function findAngle(center, point) {
	return Math.atan2(point.y - center.y, point.x - center.x);
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
