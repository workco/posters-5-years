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

	// Set some global parameters
	window.OUTLINE_THICKNESS = 0.4; // Thickness in units for the outline of all objects
	window.OUTLINE_SEGMENTS = 8; // Number of segments used for outline tesselation

	const SPIN_INTERVAL = 10; // Interval between each spin
	const SPIN_DURATION = 5; // Time to perform the spin
	const SPIN_TIMES = 3; // Times to spin
	const SPIN_RADIUS = 30; // Expanded spin radius

	// Some other global vars
	window.INDEX = 0;

	// Create canvas and add to HTML
	const { width, height } = this.getPosterSize();
	const posterAspectRatio = width / height;
	const canvas = document.createElement('canvas');
	canvas.width = width;
	canvas.height = height;
	container.appendChild(canvas);

	// Create engine
	const engine = new BABYLON.Engine(canvas, true);

	// Create scene
	const scene = new BABYLON.Scene(engine);
	scene.clearColor = new BABYLON.Color3(1, 1, 1);

	// Create the camera
	const camera = new BABYLON.ArcRotateCamera('camera', Math.PI * 0.25, Math.PI * 0.3025, 200, BABYLON.Vector3.Zero(), scene);
	camera.mode = BABYLON.Camera.ORTHOGRAPHIC_CAMERA;
	const viewSize = width / 26;
	const fw = width / viewSize;
	const fh = height / viewSize;
    camera.orthoTop = fh;
    camera.orthoBottom = -fh;
    camera.orthoLeft = -fw;
	camera.orthoRight = fw;

    // TEMP -- control
    camera.attachControl(canvas, false);

	// Creates all scene geometry
	const root = createEmptyObject();
	const objects = createObjects(root);
	window.START_TIME = Date.now() / 1000;

	// Starts final loop, for rendering and animation
	engine.runRenderLoop(() => {
		// Animates all objects' positions
		const now = (Date.now() / 1000) - START_TIME;
		const FLOAT_RADIUS_VERTICAL = 0.2;
		const FLOAT_RADIUS_LATERAL = 0.1;
		const TAU = Math.PI * 2;

		const animationPosition = now % (SPIN_DURATION + SPIN_INTERVAL);
		const spinPhase = map(animationPosition, SPIN_INTERVAL, SPIN_INTERVAL + SPIN_DURATION, 0, 1, true);
		const smoothSpinPhase = easeInOutSine(easeInOutSine(easeInOutSine(spinPhase)));
		const objectRepulseScale = Math.sin(map((smoothSpinPhase > 0.5 ? 1 - smoothSpinPhase : smoothSpinPhase) / 2, 0, 0.5, 0, 1) * Math.PI);
		const repulseRadius = objectRepulseScale * objectRepulseScale * SPIN_RADIUS;

		// Rotate everything
		root.rotation.y = smoothSpinPhase * Math.PI * 2 * SPIN_TIMES;

		for (let objectInfo of objects) {
			// Make them float
			objectInfo.object.position.x = objectInfo.originalPosition.x + Math.sin(now / objectInfo.cycleDuration * TAU / 3) * FLOAT_RADIUS_LATERAL + objectInfo.spinRepulse.x * repulseRadius;
			objectInfo.object.position.y = objectInfo.originalPosition.y + Math.sin(now / objectInfo.cycleDuration * TAU) * FLOAT_RADIUS_VERTICAL + objectInfo.spinRepulse.y * repulseRadius;;
			objectInfo.object.position.z = objectInfo.originalPosition.z + Math.sin(now / objectInfo.cycleDuration * TAU / 5) * FLOAT_RADIUS_LATERAL + objectInfo.spinRepulse.z * repulseRadius;



		}

		scene.render();
	});
}

/**
 * Creates all elements needed by the scene
 */
function createObjects(parent) {
	const depth = 8.1;

	const box1 = createBoxObject(36.5, 16.5, depth);
	box1.position.x = 0.5;
	box1.position.y = 23;
	box1.parent = parent;

	const box2 = createBoxObject(18, 18, depth);
	box2.position.x = 14;
	box2.position.y = 3;
	box2.parent = parent;

	const puck = createCylinderObject(9, depth);
	puck.position.x = 24;
	puck.position.y = -10;
	puck.position.z = 10;
	puck.parent = parent;

	const arc1 = createArcObject(18, depth, "top");
	arc1.position.x = -4;
	arc1.position.y = -2;
	arc1.position.z = 10;
	arc1.parent = parent;

	const arc2 = createArcObject(18, depth, "right");
	arc2.position.x = -4;
	arc2.position.y = -24;
	arc2.position.z = 10;
	arc2.parent = parent;

	// We return a list of all objects, and some animation parameters. originalPosition is read later
	return [
		{ object: box1, originalPosition: { ...box1.position }, cycleDuration: 5 + Math.random() * 3, spinRepulse: { x: 0,    y: 0,    z: -1 } },
		{ object: box2, originalPosition: { ...box2.position }, cycleDuration: 5 + Math.random() * 3, spinRepulse: { x: 1,    y: 0,    z:  0 } },
		{ object: puck, originalPosition: { ...puck.position }, cycleDuration: 5 + Math.random() * 3, spinRepulse: { x: 0.5,  y: 0,    z:  1 } },
		{ object: arc1, originalPosition: { ...arc1.position }, cycleDuration: 5 + Math.random() * 3, spinRepulse: { x: -0.2, y: 0,    z:  1 } },
		{ object: arc2, originalPosition: { ...arc2.position }, cycleDuration: 5 + Math.random() * 3, spinRepulse: { x: -0.2, y: -0.5, z:  1 } },
	]
}

/**
 * Creates a box object of arbitrary dimensions.
 * Every object contains:
 * - an inner "solid" (opaque)
 * - an outer anti-object (black, with inverted normals), for the external outline;
 * - internal outlines (on edges) constructed with cilinders
 *
 * Ideally we'd use enableEdgesRendering() to build those. However, this has several drawbacks:
 * - half the edges are masked by the solid itself depending on the angle, so the width varies - not solvable
 * - edges are aligned to the camera, so they don't work well at certain angles (e.g. a disc with edges seen from above) - not solvable
 * - they apply to edges that sometimes should not receive an edge, no matter the epsilon used (like between the end/start segment of a disc) - solvable with enableEdgesRendering(undefined, true) to force vertex checking instead of indexes
 *
 * .renderOutline doesn't work well either:
 * - it only scales the visible portion of a shape and renders it behind the original - not solvable
 *
 * HighlightLayer doesn't work either:
 * - it follows the visible object only, so objects occluded by other objects would show an incorrect outline
 */
function createBoxObject(width, height, depth) {
	// We have "inner" dimensions so the inner solid is a bit inset
	// This helps the outline stand out and appear to have a uniform width regardless of viewing angle
	const inNudge = OUTLINE_THICKNESS * 0.83;
	const inWidth = width - inNudge;
	const inHeight = height - inNudge;
	const inDepth = depth - inNudge;

	// Basic solid (inner object)
	const material = createColorMaterial(0xffffff);
	const box = BABYLON.MeshBuilder.CreateBox(`box-${INDEX++}`, {
		width: inWidth,
		height: inHeight,
		depth: inDepth,
	});
	box.material = material;

	// Anti-solid (outer outline)
	const outlineMaterial = createColorMaterial(0x000000);
	const antiBox = BABYLON.MeshBuilder.CreateBox(`box-${INDEX++}`, {
		width,
		height,
		depth,
		sideOrientation: BABYLON.Mesh.BACKSIDE,
	});
	antiBox.material = outlineMaterial;
	antiBox.parent = box;

	// Edge outlines

	// Outlines use the inner dimensions, but we grow them a little bit to cover corners
	const nudge = inNudge * 0.5;

	// Vertical (over height)
	createTubeShape(inWidth * -0.5, inHeight * -0.5 - nudge, inDepth * -0.5, inWidth * -0.5, inHeight * 0.5 + nudge, inDepth * -0.5, outlineMaterial, box);
	createTubeShape(inWidth *  0.5, inHeight * -0.5 - nudge, inDepth * -0.5, inWidth *  0.5, inHeight * 0.5 + nudge, inDepth * -0.5, outlineMaterial, box);
	createTubeShape(inWidth * -0.5, inHeight * -0.5 - nudge, inDepth *  0.5, inWidth * -0.5, inHeight * 0.5 + nudge, inDepth *  0.5, outlineMaterial, box);
	createTubeShape(inWidth *  0.5, inHeight * -0.5 - nudge, inDepth *  0.5, inWidth *  0.5, inHeight * 0.5 + nudge, inDepth *  0.5, outlineMaterial, box);

	// Horizontal (over width)
	createTubeShape(inWidth * -0.5 - nudge, inHeight * -0.5, inDepth * -0.5, inWidth * 0.5 + nudge, inHeight * -0.5, inDepth * -0.5, outlineMaterial, box);
	createTubeShape(inWidth * -0.5 - nudge, inHeight * -0.5, inDepth *  0.5, inWidth * 0.5 + nudge, inHeight * -0.5, inDepth *  0.5, outlineMaterial, box);
	createTubeShape(inWidth * -0.5 - nudge, inHeight *  0.5, inDepth * -0.5, inWidth * 0.5 + nudge, inHeight *  0.5, inDepth * -0.5, outlineMaterial, box);
	createTubeShape(inWidth * -0.5 - nudge, inHeight *  0.5, inDepth *  0.5, inWidth * 0.5 + nudge, inHeight *  0.5, inDepth *  0.5, outlineMaterial, box);

	// Deep (over depth)
	createTubeShape(inWidth * -0.5, inHeight * -0.5, inDepth * -0.5 - nudge, inWidth * -0.5, inHeight * -0.5, inDepth * 0.5 + nudge, outlineMaterial, box);
	createTubeShape(inWidth *  0.5, inHeight * -0.5, inDepth * -0.5 - nudge, inWidth *  0.5, inHeight * -0.5, inDepth * 0.5 + nudge, outlineMaterial, box);
	createTubeShape(inWidth * -0.5, inHeight *  0.5, inDepth * -0.5 - nudge, inWidth * -0.5, inHeight *  0.5, inDepth * 0.5 + nudge, outlineMaterial, box);
	createTubeShape(inWidth *  0.5, inHeight *  0.5, inDepth * -0.5 - nudge, inWidth *  0.5, inHeight *  0.5, inDepth * 0.5 + nudge, outlineMaterial, box);

	return box;
}

/**
 * Creates a cylinder object of arbitrary radius and depth.
 * Every object contains:
 * - an inner "solid" (opaque)
 * - an outer anti-object (black, with inverted normals), for the external outline;
 * - internal outlines (on edges) constructed with cilinders
 */
function createCylinderObject(radius, depth) {
	// We also have "inner" dimensions for the cylinder, so we can have the outlines
	// with near-correct thickness on every situation
	const inNudge = OUTLINE_THICKNESS * 0.83;
	const segments = 48; // Number of segments for cylinder precision

	// Basic solid (inner object)
	const material = createColorMaterial(0xffffff);
	const path = [
        new BABYLON.Vector3(0, 0, depth * -0.5 + inNudge / 2),
        new BABYLON.Vector3(0, 0, depth *  0.5 - inNudge / 2),
	];
	const tube = BABYLON.MeshBuilder.CreateTube(`tube-${INDEX++}`, {
		radius: radius - inNudge,
		subdivisions: 1,
		tessellation: segments,
		path,
		cap: BABYLON.Mesh.CAP_START,
	});
	tube.material = material;

	// Cap of a different color
	const capMaterial = createColorMaterial(0xef5a46);
	const cap = BABYLON.MeshBuilder.CreateDisc(`disc-${INDEX++}`, {
		radius: radius - inNudge,
		tessellation: segments,
		sideOrientation: BABYLON.Mesh.BACKSIDE,
	});
	cap.position.z = depth * 0.5 - inNudge / 2;
	cap.material = capMaterial;
	cap.parent = tube;

	// Anti-solid (outer outline)
	const outlineMaterial = createColorMaterial(0x000000);
	const antiPath = [
        new BABYLON.Vector3(0, 0, depth * -0.5),
        new BABYLON.Vector3(0, 0, depth *  0.5),
	];
	const antiTube = BABYLON.MeshBuilder.CreateTube(`outline-${INDEX++}`, {
		radius,
		subdivisions: 1,
		tessellation: segments,
		path: antiPath,
		sideOrientation: BABYLON.Mesh.BACKSIDE,
		cap: BABYLON.Mesh.CAP_ALL,
	});
	antiTube.material = outlineMaterial;
	antiTube.parent = tube;

	// Outline ring for the front face
	const front = BABYLON.MeshBuilder.CreateTube(`top-${INDEX++}`, {
		radius: OUTLINE_THICKNESS * 0.5,
		subdivisions: 1,
		tessellation: OUTLINE_SEGMENTS,
		path: createCirclePath(radius - OUTLINE_THICKNESS * 0.5, segments, depth * 0.5),
	});
	front.material = outlineMaterial;
	front.parent = tube;

	// Outline ring for the back face
	const back = BABYLON.MeshBuilder.CreateTube(`top-${INDEX++}`, {
		radius: OUTLINE_THICKNESS * 0.5,
		subdivisions: 1,
		tessellation: OUTLINE_SEGMENTS,
		path: createCirclePath(radius - OUTLINE_THICKNESS * 0.5, segments, depth * -0.5),
	});
	back.material = outlineMaterial;
	back.parent = tube;

	return tube;
}

/**
 * Creates an arc object of arbitrary dimensions. An arc is like a square, but with a 90" curve in one of the corners.
 * Every object contains:
 * - an inner "solid" (opaque)
 * - an outer anti-object (black, with inverted normals), for the external outline;
 * - internal outlines (on edges) constructed with cilinders
 */
function createArcObject(radius, depth, type) {
	// We also have "inner" dimensions for the arc, so we can have the outlines
	// with near-correct thickness on every situation
	const inNudge = OUTLINE_THICKNESS * 0.83;
	const segments = 24; // Number of segments for cylinder precision

	const arc = createEmptyObject();

	const front = createArcPlane(radius, segments, inNudge);
	front.position.z = depth * 0.5;
	front.parent = arc;

	const back = createArcPlane(radius, segments, inNudge, true);
	back.position.z = -depth * 0.5;
	back.parent = arc;

	const left = createRectPlane(depth, radius, inNudge);
	left.position.x = radius * 0.5;
	left.rotation.y = Math.PI * -0.5;
	left.parent = arc;

	const bottom = createRectPlane(depth, radius, inNudge, true);
	bottom.position.y = radius * -0.5;
	bottom.rotation.x = Math.PI * -0.5;
	bottom.rotation.y = Math.PI * -0.5;
	bottom.parent = arc;

	const curvedSide = createArcSidePlane(depth, radius, segments, inNudge);
	curvedSide.parent = arc;

	switch (type) {
		case "top":
			break;
		case "right":
			arc.rotation.x = Math.PI;
	}

	return arc;
}

/**
 * Creates a 90" arc plane, complete with outlines and anti-solid
 */
function createArcPlane(radius, segments, inNudge, flipped) {
	const flipScalar = flipped ? -1 : 1;
	const halfRadius = radius * 0.5;
	const sideOrientationNormal = flipped ? BABYLON.Mesh.BACKSIDE : BABYLON.Mesh.FRONTSIDE;
	const sideOrientationFlipped = flipped ? BABYLON.Mesh.FRONTSIDE : BABYLON.Mesh.BACKSIDE;
	const nudge = inNudge * 0.5;
	const halfOutline = OUTLINE_THICKNESS / 2;

	const arcCorner = new BABYLON.Vector3(0, 0, 0);
	const arcPath = createArcPath(radius, segments, 0, 0, Math.PI * 0.5);
	arcPath.forEach((v3) => {
		v3.z = v3.y;
		v3.y = 0;
	});
	// We also create an arc path that extends the outline caps a bit, to cover the corner for outlines
	const extendedArcPath = arcPath.map((v3, i) => {
		if (i === 0) {
			return new BABYLON.Vector3(v3.x, v3.y, v3.z - nudge);
		} else if (i === arcPath.length - 1) {
			return new BABYLON.Vector3(v3.x - nudge, v3.y, v3.z);
		} else {
			return v3;
		}
	});

	const plane = createEmptyObject();

	// Basic solid (inner object plane)
	const material = createColorMaterial(0xffffff);
	const solid = BABYLON.MeshBuilder.CreatePolygon(`polygon-${INDEX++}`, {
		shape: [arcCorner, ...arcPath],
		sideOrientation: sideOrientationNormal,
	});
	solid.rotation.x = Math.PI * -0.5;
	solid.rotation.y = Math.PI * -1;
	solid.position.x = halfRadius - nudge;
	solid.position.y = -halfRadius + nudge;
	solid.position.z = -inNudge * flipScalar;
	solid.scaling.x = solid.scaling.z = (radius - inNudge) / radius;
	solid.material = material;
	solid.parent = plane;

	// Outline on curved edge
	const outlineMaterial = createColorMaterial(0x000000);
	const outline = BABYLON.MeshBuilder.CreateTube(`outline-${INDEX++}`, {
		radius: OUTLINE_THICKNESS * 0.5,
		subdivisions: 1,
		tessellation: OUTLINE_SEGMENTS,
		path: extendedArcPath,
	});
	outline.rotation.x = Math.PI * -0.5;
	outline.rotation.y = Math.PI * -1;
	outline.position.x = halfRadius - halfOutline;
	outline.position.y = -halfRadius + halfOutline;
	outline.position.z = -halfOutline * flipScalar;
	outline.scaling.x = outline.scaling.z = (radius - OUTLINE_THICKNESS) / radius;
	outline.material = outlineMaterial;
	outline.parent = plane;

	// Anti-solid (outer outline)
	const antiSolid = BABYLON.MeshBuilder.CreatePolygon(`polygon-${INDEX++}`, {
		shape: [arcCorner, ...arcPath],
		sideOrientation: sideOrientationFlipped,
	});
	antiSolid.rotation.x = Math.PI * -0.5;
	antiSolid.rotation.y = Math.PI * -1;
	antiSolid.position.x = halfRadius;
	antiSolid.position.y = -halfRadius;
	antiSolid.position.z = 0;
	antiSolid.material = outlineMaterial;
	antiSolid.parent = plane;

	return plane;
}

/**
 * Creates the curved side of the arc object
 */
function createArcSidePlane(depth, radius, segments, inNudge) {

	const nudge = inNudge * 0.5;

	const plane = createEmptyObject();

	const arcPath = createArcPath(radius, segments, 0, 0, Math.PI * 0.5);
	const arcPathFront = arcPath.map((v) => {
		return new BABYLON.Vector3(v.x, v.y, depth * -0.5 + nudge);
	});
	const arcPathBack = arcPath.map((v) => {
		return new BABYLON.Vector3(v.x, v.y, depth * 0.5 - nudge);
	});

	// // Basic solid (inner object plane)
	const material = createColorMaterial(0xffffff);
	const solid = BABYLON.MeshBuilder.CreateRibbon(`ribbon-${INDEX++}`, {
		pathArray: [ arcPathFront, arcPathBack, ],
	});
	solid.rotation.y = Math.PI;
	solid.position.x = radius * 0.5 - nudge * 0.5;
	solid.position.y = radius * -0.5 + nudge * 0.5;
	solid.scaling.x = solid.scaling.y = (radius - OUTLINE_THICKNESS) / radius;
	solid.material = material;
	solid.parent = plane;

	// Anti-solid (outer outline)
	const outlineMaterial = createColorMaterial(0x000000);
	const antiSolid = BABYLON.MeshBuilder.CreateRibbon(`ribbon-${INDEX++}`, {
		pathArray: [ arcPathFront, arcPathBack ],
		sideOrientation: BABYLON.Mesh.BACKSIDE,
	});
	antiSolid.rotation.y = Math.PI;
	antiSolid.position.x = radius * 0.5;
	antiSolid.position.y = radius * -0.5;
	antiSolid.material = outlineMaterial;
	antiSolid.parent = plane;

	return plane;
}

/**
 * Creates a plane/rectangle, complete with outlines and anti-solid
 */
function createRectPlane(width, height, inNudge, skipTopOutline = false) {
	const plane = createEmptyObject();

	const inWidth = width - OUTLINE_THICKNESS;
	const inHeight = height - OUTLINE_THICKNESS;

	// Basic solid (inner object plane)
	const material = createColorMaterial(0xffffff);
	const solid = BABYLON.MeshBuilder.CreatePlane(`plane-${INDEX++}`, {
		width: inWidth,
		height: inHeight,
	});
	solid.position.z = inNudge * 0.5;
	solid.material = material;
	solid.parent = plane;

	// Anti-solid (outer outline)
	const outlineMaterial = createColorMaterial(0x000000);
	const antiSolid = BABYLON.MeshBuilder.CreatePlane(`plane-${INDEX++}`, {
		width,
		height,
		sideOrientation: BABYLON.Mesh.BACKSIDE,
	});
	antiSolid.material = outlineMaterial;
	antiSolid.parent = plane;

	// Edge outlines

	// Outlines use the inner dimensions, but we grow them a little bit to cover corners
	const nudge = inNudge * 0.4;
	const halfOutline = OUTLINE_THICKNESS / 2;

	// Vertical (over height)
	createTubeShape(inWidth * -0.5, inHeight * -0.5 - nudge, halfOutline, inWidth * -0.5, inHeight * 0.5 + nudge, halfOutline, outlineMaterial, plane);
	createTubeShape(inWidth *  0.5, inHeight * -0.5 - nudge, halfOutline, inWidth *  0.5, inHeight * 0.5 + nudge, halfOutline, outlineMaterial, plane);

	// Horizontal (over width)
	if (!skipTopOutline) createTubeShape(inWidth * -0.5 - nudge, inHeight *  0.5, halfOutline, inWidth * 0.5 + nudge, inHeight *  0.5, halfOutline, outlineMaterial, plane);
	createTubeShape(inWidth * -0.5 - nudge, inHeight * -0.5, nudge, inWidth * 0.5 + halfOutline, inHeight * -0.5, halfOutline, outlineMaterial, plane);

	return plane;
}

/**
 * Creates an empty object to serve as a group
 */
function createEmptyObject() {
	const obj = new BABYLON.Mesh.CreateBox(`empty-${INDEX++}`, 1);
	obj.isVisible = false;
	return obj;
}

/**
 * Create the surface material for all objects
 * This is just a basic diffuse, emissive color since we doen't need lights
 */
function createColorMaterial(color) {
	const material = new BABYLON.StandardMaterial(`material-${INDEX++}`);
	const bColor = new BABYLON.Color3((color >> 16 & 0xff) / 255, (color >> 8 & 0xff) / 255, (color & 0xff) / 255);
	material.emissiveColor = bColor;
	material.diffuseColor = bColor;
	return material;
}

/**
 * Creates a tube shape from one point in 3d space to another,
 * applying a material (if needed), and adding it to a "parent" object (if needed)
 */
function createTubeShape(x1, y1, z1, x2, y2, z2, material, parent) {
	const path = [
        new BABYLON.Vector3(x1, y1, z1),
        new BABYLON.Vector3(x2, y2, z2),
    ];
	const line = BABYLON.MeshBuilder.CreateTube(`outline-${INDEX++}`, {
		radius: OUTLINE_THICKNESS * 0.5,
		subdivisions: 1,
		tessellation: OUTLINE_SEGMENTS,
		path,
	});
	if (material) line.material = material;
	if (parent) line.parent = parent;
	return line;
}

/**
 * Create a list of points that compose a circle around 0, 0, 0 with an arbitrary radius.
 *
 */
function createCirclePath(radius, segments, z) {
	return createArcPath(radius, segments, z, 0, Math.PI * 2)
}

/**
 * Creates a list of points that go around 0, 0, 0 with an arbitrary radius and start/end angles (in radians).
 * This is used to create arc shapes.
 */
function createArcPath(radius, segments, z, minAngle, maxAngle) {
	const path = [];
	for (let i = 0; i <= segments; i++) {
		const f = i / segments;
		const a = minAngle + (f * (maxAngle - minAngle));
		const x = Math.cos(a) * radius;
		const y = Math.sin(a) * radius;
		path.push(new BABYLON.Vector3(x, y, z));
	}
	return path;
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
