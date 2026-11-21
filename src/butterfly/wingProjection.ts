import { WingPose } from './types';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Point2D {
  x: number;
  y: number;
  z: number;
}

export interface CubicSegment {
  c1: [number, number];
  c2: [number, number];
  end: [number, number];
}

export interface BezierPathDef {
  start: [number, number];
  segments: CubicSegment[];
  closed: boolean;
}

export interface ProjectedGradient {
  cx: number;
  cy: number;
  r: number;
}

export interface ProjectedWing {
  hindWash: string;
  hindBloom: string;
  hindContour: string;
  hindAccent: string;
  foreWash: string;
  foreBloom: string;
  foreDetail: string;
  foreContour: string;
  foreAccent: string;
  foreGrad: ProjectedGradient;
  hindGrad: ProjectedGradient;
  depthZ: number;
}

export interface ProjectedButterfly {
  leftWing: ProjectedWing;
  rightWing: ProjectedWing;
  bodyPath: string;
  headX: number;
  headY: number;
  headR: number;
  altitudeScale: number;
  headingDeg: number;
  /** Render order back-to-front based on 3D banking depth */
  renderOrder: Array<'left' | 'body' | 'right'>;
}

const DEG_TO_RAD = Math.PI / 180;
const TELEPHOTO_PERSPECTIVE = 1200;

/**
 * Wing Bezier geometry defined in hinge-relative coordinates for the LEFT wing (x <= 0).
 * Right wing is mirrored cleanly (x -> -x) for exact mathematical symmetry.
 */
const LEFT_WING_PATHS: Record<
  | 'hindWash'
  | 'hindBloom'
  | 'hindContour'
  | 'hindAccent'
  | 'foreWash'
  | 'foreBloom'
  | 'foreDetail'
  | 'foreContour'
  | 'foreAccent',
  BezierPathDef
> = {
  hindWash: {
    start: [-1, 1],
    segments: [
      { c1: [-10, -1], c2: [-29, -0.5], end: [-38.5, 4.5] },
      { c1: [-45.5, 8.2], c2: [-45.8, 15.5], end: [-40.2, 22.5] },
      { c1: [-34.8, 29.2], c2: [-26.5, 35.2], end: [-18, 33.2] },
      { c1: [-10.5, 31.4], c2: [-5.8, 20], end: [-1.8, 8] },
    ],
    closed: true,
  },
  hindBloom: {
    start: [-2.5, 3.5],
    segments: [
      { c1: [-11.5, 3.5], c2: [-24.5, 6], end: [-32, 12.2] },
      { c1: [-36.5, 16.2], c2: [-33.2, 24], end: [-25.5, 27.2] },
      { c1: [-17, 30.5], c2: [-8.5, 19.5], end: [-3, 7.5] },
    ],
    closed: true,
  },
  hindContour: {
    start: [-1.5, 1],
    segments: [
      { c1: [-11, -1.8], c2: [-30.5, -1.2], end: [-40.5, 3.8] },
      { c1: [-47.8, 7.6], c2: [-47.8, 16], end: [-41.8, 23.5] },
      { c1: [-36, 30.8], c2: [-26.8, 37.8], end: [-17.5, 35.5] },
      { c1: [-9.8, 33.5], c2: [-5.2, 21.2], end: [-1.5, 8.5] },
    ],
    closed: false,
  },
  hindAccent: {
    start: [-41.4, 24],
    segments: [{ c1: [-35.6, 31.2], c2: [-26.4, 37.8], end: [-17.2, 35.2] }],
    closed: false,
  },
  foreWash: {
    start: [-1.2, 1.5],
    segments: [
      { c1: [-8, -16], c2: [-27.5, -36.8], end: [-45.8, -41.2] },
      { c1: [-51.8, -42.6], c2: [-52.8, -36.2], end: [-49.8, -26.8] },
      { c1: [-47.8, -20], c2: [-48.8, -11.8], end: [-42.2, -5.2] },
      { c1: [-34.8, 2], c2: [-18.2, 4], end: [-2, 4.4] },
    ],
    closed: true,
  },
  foreBloom: {
    start: [-3.2, 0.5],
    segments: [
      { c1: [-11.5, -12.5], c2: [-26, -27], end: [-38.2, -31.5] },
      { c1: [-45.2, -34], c2: [-45.2, -22.8], end: [-39.5, -12.2] },
      { c1: [-34, -3], c2: [-18.5, 1.2], end: [-4, 2.2] },
    ],
    closed: true,
  },
  foreDetail: {
    start: [-17, -10.5],
    segments: [
      { c1: [-24.2, -18.5], c2: [-33.2, -26.5], end: [-40.2, -28.5] },
      { c1: [-44.2, -26.5], c2: [-40.5, -17.2], end: [-33.2, -11.2] },
      { c1: [-27, -6.2], c2: [-20, -6.2], end: [-17, -10.5] },
    ],
    closed: true,
  },
  foreContour: {
    start: [-1, 1.8],
    segments: [
      { c1: [-8.5, -17], c2: [-28.5, -38.8], end: [-48.2, -43.4] },
      { c1: [-54.2, -44.8], c2: [-55.2, -37], end: [-51.8, -27] },
      { c1: [-49.6, -20], c2: [-50.8, -11.2], end: [-43.8, -4.2] },
      { c1: [-36.2, 3.2], c2: [-18.5, 4.8], end: [-1.6, 5] },
    ],
    closed: false,
  },
  foreAccent: {
    start: [-2, -0.2],
    segments: [
      { c1: [-9.8, -18.6], c2: [-29.2, -39], end: [-48.4, -43.5] },
      { c1: [-52.4, -44.5], c2: [-54, -41.2], end: [-53, -35.6] },
    ],
    closed: false,
  },
};

const BODY_PATH: BezierPathDef = {
  start: [0, -7.5],
  segments: [
    { c1: [2, -6], c2: [2.3, -0.5], end: [1.8, 6.5] },
    { c1: [1.3, 13.2], c2: [0.7, 18.5], end: [0, 20.5] },
    { c1: [-0.7, 18.5], c2: [-1.3, 13.2], end: [-1.8, 6.5] },
    { c1: [-2.3, -0.5], c2: [-2, -6], end: [0, -7.5] },
  ],
  closed: true,
};

function rotateX(p: Vec3, sinA: number, cosA: number): Vec3 {
  return {
    x: p.x,
    y: p.y * cosA - p.z * sinA,
    z: p.y * sinA + p.z * cosA,
  };
}

function rotateY(p: Vec3, sinA: number, cosA: number): Vec3 {
  return {
    x: p.x * cosA + p.z * sinA,
    y: p.y,
    z: -p.x * sinA + p.z * cosA,
  };
}

function rotateZ(p: Vec3, sinA: number, cosA: number): Vec3 {
  return {
    x: p.x * cosA - p.y * sinA,
    y: p.x * sinA + p.y * cosA,
    z: p.z,
  };
}

function createProjector(
  headingRad: number,
  bodyPitchDeg: number,
  bodyRollDeg: number,
  altitudeScale: number,
  wingOpts?: {
    side: 'left' | 'right';
    wingDeg: number;
    sweepDeg: number;
    featherDeg: number;
  }
) {
  const sinH = Math.sin(headingRad);
  const cosH = Math.cos(headingRad);
  const sinPitch = Math.sin(-bodyPitchDeg * DEG_TO_RAD);
  const cosPitch = Math.cos(-bodyPitchDeg * DEG_TO_RAD);
  const sinRoll = Math.sin(bodyRollDeg * DEG_TO_RAD);
  const cosRoll = Math.cos(bodyRollDeg * DEG_TO_RAD);

  const hasWing = wingOpts !== undefined;
  const sideSign = wingOpts?.side === 'right' ? -1 : 1;
  const sinFlap = hasWing ? Math.sin(sideSign * wingOpts.wingDeg * DEG_TO_RAD) : 0;
  const cosFlap = hasWing ? Math.cos(sideSign * wingOpts.wingDeg * DEG_TO_RAD) : 1;
  const sinSweep = hasWing ? Math.sin(sideSign * wingOpts.sweepDeg * DEG_TO_RAD) : 0;
  const cosSweep = hasWing ? Math.cos(sideSign * wingOpts.sweepDeg * DEG_TO_RAD) : 1;
  const sinFeather = hasWing ? Math.sin(-wingOpts.featherDeg * DEG_TO_RAD) : 0;
  const cosFeather = hasWing ? Math.cos(-wingOpts.featherDeg * DEG_TO_RAD) : 1;

  return (x: number, y: number, z = 0): Point2D => {
    let p: Vec3 = { x, y, z };

    if (hasWing) {
      p = rotateX(p, sinFeather, cosFeather);
      p = rotateZ(p, sinSweep, cosSweep);
      p = rotateY(p, sinFlap, cosFlap);
    }

    p = rotateX(p, sinPitch, cosPitch);
    p = rotateY(p, sinRoll, cosRoll);
    p = rotateZ(p, sinH, cosH);

    const persp = TELEPHOTO_PERSPECTIVE / (TELEPHOTO_PERSPECTIVE - p.z);
    const s = persp * altitudeScale;
    return {
      x: p.x * s,
      y: p.y * s,
      z: p.z,
    };
  };
}

function fmt(n: number): string {
  return n.toFixed(2);
}

function projectBezier(
  def: BezierPathDef,
  mirrorX: boolean,
  project: (x: number, y: number, z?: number) => Point2D
): string {
  const sx = mirrorX ? -1 : 1;
  const p0 = project(def.start[0] * sx, def.start[1]);
  let d = `M${fmt(p0.x)} ${fmt(p0.y)}`;

  for (let i = 0; i < def.segments.length; i++) {
    const seg = def.segments[i];
    const c1 = project(seg.c1[0] * sx, seg.c1[1]);
    const c2 = project(seg.c2[0] * sx, seg.c2[1]);
    const end = project(seg.end[0] * sx, seg.end[1]);
    d += ` C${fmt(c1.x)} ${fmt(c1.y)} ${fmt(c2.x)} ${fmt(c2.y)} ${fmt(end.x)} ${fmt(end.y)}`;
  }

  if (def.closed) {
    d += ' Z';
  }
  return d;
}

function projectSingleWing(
  side: 'left' | 'right',
  headingRad: number,
  pose: WingPose,
  altitudeScale: number
): ProjectedWing {
  const mirrorX = side === 'right';
  const sx = mirrorX ? -1 : 1;
  const wingDeg = side === 'left' ? pose.leftWingDeg : pose.rightWingDeg;

  const project = createProjector(headingRad, pose.bodyPitchDeg, pose.bodyRollDeg, altitudeScale, {
    side,
    wingDeg,
    sweepDeg: pose.wingSweepDeg,
    featherDeg: pose.wingFeatherDeg,
  });

  // Project wash gradient root & tip so watercolor bloom smoothly tracks the wing at any fold angle
  const foreRoot = project(-4 * sx, 2);
  const foreTip = project(-48 * sx, -38);
  const foreRadius = Math.max(8, Math.hypot(foreTip.x - foreRoot.x, foreTip.y - foreRoot.y) * 0.94);

  const hindRoot = project(-4 * sx, 8);
  const hindTip = project(-36 * sx, 28);
  const hindRadius = Math.max(6, Math.hypot(hindTip.x - hindRoot.x, hindTip.y - hindRoot.y) * 0.96);

  // Representative centroid depth for clean back-to-front painter's sorting
  const centroid = project(-26 * sx, -6);

  return {
    hindWash: projectBezier(LEFT_WING_PATHS.hindWash, mirrorX, project),
    hindBloom: projectBezier(LEFT_WING_PATHS.hindBloom, mirrorX, project),
    hindContour: projectBezier(LEFT_WING_PATHS.hindContour, mirrorX, project),
    hindAccent: projectBezier(LEFT_WING_PATHS.hindAccent, mirrorX, project),
    foreWash: projectBezier(LEFT_WING_PATHS.foreWash, mirrorX, project),
    foreBloom: projectBezier(LEFT_WING_PATHS.foreBloom, mirrorX, project),
    foreDetail: projectBezier(LEFT_WING_PATHS.foreDetail, mirrorX, project),
    foreContour: projectBezier(LEFT_WING_PATHS.foreContour, mirrorX, project),
    foreAccent: projectBezier(LEFT_WING_PATHS.foreAccent, mirrorX, project),
    foreGrad: { cx: foreRoot.x, cy: foreRoot.y, r: foreRadius },
    hindGrad: { cx: hindRoot.x, cy: hindRoot.y, r: hindRadius },
    depthZ: centroid.z,
  };
}

/**
 * Projects the complete 3D butterfly into crisp, pure 2D SVG Bezier paths.
 * Eliminates CSS 3D compositor layer rasterization and crispy pixel artifacts
 * while preserving exact 3D telephoto perspective and depth ordering.
 */
export function projectButterflyTo2D(
  heading: number,
  pose: WingPose,
  scale: number
): ProjectedButterfly {
  const headingDeg = (heading * 180) / Math.PI + 90;
  const headingRad = headingDeg * DEG_TO_RAD;
  const effectiveScale = scale * 0.5;
  const altitudeScale = effectiveScale * (0.93 + pose.elevation * 0.14);

  const leftWing = projectSingleWing('left', headingRad, pose, altitudeScale);
  const rightWing = projectSingleWing('right', headingRad, pose, altitudeScale);

  const bodyProject = createProjector(
    headingRad,
    pose.bodyPitchDeg,
    pose.bodyRollDeg,
    altitudeScale
  );
  const bodyPath = projectBezier(BODY_PATH, false, bodyProject);
  const head = bodyProject(0, -7.8, 1.5);
  const bodyZ = bodyProject(0, 4, 1.5).z;

  const layers: Array<{ id: 'left' | 'body' | 'right'; z: number }> = [
    { id: 'left', z: leftWing.depthZ },
    { id: 'body', z: bodyZ },
    { id: 'right', z: rightWing.depthZ },
  ];
  layers.sort((a, b) => a.z - b.z);

  return {
    leftWing,
    rightWing,
    bodyPath,
    headX: head.x,
    headY: head.y,
    headR: 1.75 * altitudeScale,
    altitudeScale,
    headingDeg,
    renderOrder: layers.map((l) => l.id),
  };
}
