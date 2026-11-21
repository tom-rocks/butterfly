import {
  BUTTERFLY_COLOR,
  BUTTERFLY_PRESETS,
  ButterflyConfig,
  ButterflyState,
  FlightPhase,
  PointerTarget,
  TrailPoint,
  ViewportBounds,
  WingPose,
} from './types';

const TWO_PI = Math.PI * 2;
const MAX_TRAIL_POINTS = 120;
const TRAIL_MAX_AGE = 6.0;

/** Deterministic Mulberry32 PRNG returning [0, 1) */
export function nextRandom(state: number): [number, number] {
  let t = (state + 0x6d2b79f5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return [value, (state + 0x6d2b79f5) | 0];
}

/** Smooth incommensurate-harmonic organic drift in [-1, 1] */
export function organicNoise(t: number, offset = 0): number {
  return (
    Math.sin(t * 0.37 + offset) * 0.54 +
    Math.sin(t * 0.89 + offset * 1.7 + 1.1) * 0.3 +
    Math.sin(t * 1.73 + offset * 0.6 + 2.4) * 0.16
  );
}

/** Smooth cosine easing in [0, 1] with gentle peak velocity */
function cosineEase(x: number): number {
  const t = clamp(x, 0, 1);
  return 0.5 - 0.5 * Math.cos(t * Math.PI);
}

export function normalizeAngle(angle: number): number {
  let a = angle % TWO_PI;
  if (a > Math.PI) a -= TWO_PI;
  if (a < -Math.PI) a += TWO_PI;
  return a;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Biologically grounded butterfly clap-and-fling wingbeat waveform.
 * Input u in [0, 1):
 *   0.00 -> 0.06: brief dorsal clap pause (wings poised together above back)
 *   0.06 -> 0.45: sweeping buoyant downstroke (+76 deg -> -8 deg)
 *   0.45 -> 0.56: open air-cushion linger (-8 deg -> +8 deg) — natural glide entry/exit at u=0.50
 *   0.56 -> 0.94: smooth feathered upstroke (+8 deg -> +76 deg)
 *   0.94 -> 1.00: gentle arrival into dorsal clap
 */
export function evaluateWingStroke(rawU: number): {
  wingDeg: number;
  downstrokeLift: number;
  sweepDeg: number;
  featherDeg: number;
} {
  const u = ((rawU % 1) + 1) % 1;

  const CLAP_DEG = 76;
  const BOTTOM_DEG = -8;
  const GLIDE_READY_DEG = 8;

  if (u < 0.06) {
    const p = u / 0.06;
    const wingDeg = CLAP_DEG - cosineEase(p) * 2;
    return {
      wingDeg,
      downstrokeLift: 0,
      sweepDeg: 2.5,
      featherDeg: 2.0,
    };
  }

  if (u < 0.45) {
    const p = (u - 0.06) / 0.39;
    const eased = cosineEase(p);
    const wingDeg = lerp(CLAP_DEG - 2, BOTTOM_DEG, eased);
    const downstrokeLift = Math.sin(p * Math.PI);
    const sweepDeg = lerp(2.5, -5.0, eased);
    const featherDeg = lerp(2.0, -3.5, Math.sin(p * Math.PI));
    return {
      wingDeg,
      downstrokeLift,
      sweepDeg,
      featherDeg,
    };
  }

  if (u < 0.56) {
    const p = (u - 0.45) / 0.11;
    const eased = cosineEase(p);
    const wingDeg = lerp(BOTTOM_DEG, GLIDE_READY_DEG, eased);
    const downstrokeLift = (1 - eased) * 0.18;
    const sweepDeg = lerp(-5.0, -2.0, eased);
    const featherDeg = lerp(-1.0, 0, eased);
    return {
      wingDeg,
      downstrokeLift,
      sweepDeg,
      featherDeg,
    };
  }

  if (u < 0.94) {
    const p = (u - 0.56) / 0.38;
    const eased = cosineEase(p);
    const wingDeg = lerp(GLIDE_READY_DEG, CLAP_DEG, eased);
    const sweepDeg = lerp(-2.0, 3.0, eased);
    const featherDeg = Math.sin(p * Math.PI) * 4.5;
    return {
      wingDeg,
      downstrokeLift: 0,
      sweepDeg,
      featherDeg,
    };
  }

  const p = (u - 0.94) / 0.06;
  return {
    wingDeg: lerp(CLAP_DEG, CLAP_DEG, p),
    downstrokeLift: 0,
    sweepDeg: lerp(3.0, 2.5, p),
    featherDeg: lerp(1.5, 2.0, p),
  };
}

export function createDefaultConfig(reducedMotion = false): ButterflyConfig {
  return {
    ...BUTTERFLY_PRESETS.drift.config,
    color: BUTTERFLY_COLOR,
    reducedMotion,
  };
}

export function createInitialButterflyState(
  bounds: ViewportBounds,
  seed = 1337
): ButterflyState {
  const startX = bounds.width * 0.44;
  const startY = bounds.height * 0.48;
  const initialHeading = -0.38;

  const initialStroke = evaluateWingStroke(0.32);

  const pose: WingPose = {
    leftWingDeg: initialStroke.wingDeg,
    rightWingDeg: initialStroke.wingDeg,
    wingSweepDeg: initialStroke.sweepDeg,
    wingFeatherDeg: initialStroke.featherDeg,
    bodyPitchDeg: 21,
    bodyRollDeg: -3,
    elevation: 0.54,
  };

  return {
    x: startX,
    y: startY,
    vx: Math.cos(initialHeading) * 74,
    vy: Math.sin(initialHeading) * 74,
    heading: initialHeading,
    turnVelocity: 0,
    time: 0,
    phase: 'flapping',
    wingCycle: 0.32,
    beatTempoFactor: 1.0,
    beatsRemaining: 3,
    glideRemaining: 0,
    glideDihedralDeg: 10,
    restBreathPhase: 0,
    wingAngleDeg: initialStroke.wingDeg,
    wingSweepDeg: initialStroke.sweepDeg,
    wingFeatherDeg: initialStroke.featherDeg,
    elevation: 0.54,
    elevationVel: 0,
    bodyPitchDeg: 21,
    bodyRollDeg: -3,
    pose,
    detourAngleOffset: 0.65,
    detourTimer: 0.75,
    jinkAngle: 0,
    surgeLevel: 0.7,
    surgeTarget: 0.75,
    surgeTimer: 0.5,
    perchPos: null,
    perchCursorPos: null,
    trail: [],
    trailAccumulator: 0,
    rngState: seed | 0,
  };
}

/**
 * Pure simulation step for the small butterfly (~20% calmer than before):
 * - Meandering off-axis detours & playful speed spikes / floaty lulls
 * - Completely motionless perch when landed near the cursor (zero ice-skating drift!)
 * - Clean, warp-free attitude angles paired with natural telephoto 3D perspective
 */
export function stepButterfly(
  prev: ButterflyState,
  rawDt: number,
  bounds: ViewportBounds,
  pointer: PointerTarget,
  config: ButterflyConfig
): ButterflyState {
  const dt = clamp(rawDt, 0.001, 0.05);
  const time = prev.time + dt;
  let rngState = prev.rngState;

  const rand = (): number => {
    const [val, next] = nextRandom(rngState);
    rngState = next;
    return val;
  };

  const marginX = clamp(bounds.width * 0.07, 36, 90);
  const marginY = clamp(bounds.height * 0.08, 38, 90);

  let phase: FlightPhase = prev.phase;
  let perchPos = prev.perchPos;
  let perchCursorPos = prev.perchCursorPos;

  // Determine anchor point when flying, or check wake condition when perched still
  let anchorX: number;
  let anchorY: number;
  let distToAnchor: number;
  let wantsRest = false;

  if (phase === 'resting' && perchPos) {
    // Stay completely locked in place until the cursor moves away or a new rest spot is clicked
    const cursorMovedAway =
      pointer.active &&
      !pointer.restSpot &&
      perchCursorPos !== null &&
      Math.hypot(pointer.x - perchCursorPos.x, pointer.y - perchCursorPos.y) > 32;

    const newRestSpotClicked =
      pointer.restSpot !== null &&
      Math.hypot(pointer.restSpot.x + 8 - perchPos.x, pointer.restSpot.y - 6 - perchPos.y) > 32;

    const cursorLeftWindow = !pointer.active && !pointer.restSpot;

    if (cursorMovedAway || newRestSpotClicked || cursorLeftWindow) {
      wantsRest = false;
      perchPos = null;
      perchCursorPos = null;
      anchorX = pointer.restSpot ? pointer.restSpot.x + 8 : pointer.x;
      anchorY = pointer.restSpot ? pointer.restSpot.y - 6 : pointer.y;
      distToAnchor = Math.hypot(anchorX - prev.x, anchorY - prev.y);
    } else {
      wantsRest = true;
      anchorX = perchPos.x;
      anchorY = perchPos.y;
      distToAnchor = 0;
    }
  } else if (pointer.restSpot) {
    anchorX = clamp(pointer.restSpot.x + 8, marginX, bounds.width - marginX);
    anchorY = clamp(pointer.restSpot.y - 6, marginY, bounds.height - marginY);
    distToAnchor = Math.hypot(anchorX - prev.x, anchorY - prev.y);
    wantsRest = distToAnchor < 22;
  } else if (pointer.active) {
    // Gentle non-obstructive resting halo beside the cursor while approaching
    const approachHalo = lerp(52, 34, config.followGentleness);
    // Keep offset stable as cursor slows/pauses so landing point doesn't drift away!
    const idleCalm = clamp(1 - pointer.idleSeconds / 1.0, 0, 1);
    const orbitAngle =
      time * 0.42 * idleCalm +
      Math.atan2(prev.y - pointer.y, prev.x - pointer.x) * (1 - idleCalm);
    const offsetX = Math.cos(orbitAngle) * approachHalo;
    const offsetY = Math.sin(orbitAngle) * approachHalo * 0.72 - 8;

    anchorX = clamp(pointer.x + offsetX, marginX, bounds.width - marginX);
    anchorY = clamp(pointer.y + offsetY, marginY, bounds.height - marginY);
    distToAnchor = Math.hypot(anchorX - prev.x, anchorY - prev.y);

    const idleThreshold = lerp(2.2, 0.9, config.followGentleness);
    const distToCursor = Math.hypot(pointer.x - prev.x, pointer.y - prev.y);
    if (pointer.idleSeconds > idleThreshold && distToCursor < approachHalo + 34) {
      wantsRest = true;
    }
  } else {
    const cx = bounds.width * 0.5;
    const cy = bounds.height * 0.48;
    const roamX = Math.min(bounds.width * 0.3, 330);
    const roamY = Math.min(bounds.height * 0.24, 200);
    anchorX = cx + Math.sin(time * 0.29 + 0.5) * roamX + organicNoise(time * 0.45, 1.2) * 56;
    anchorY = cy + Math.sin(time * 0.44 + 1.8) * roamY + organicNoise(time * 0.54, 4.7) * 44;
    distToAnchor = Math.hypot(anchorX - prev.x, anchorY - prev.y);
  }

  let wingCycle = prev.wingCycle;
  let beatsRemaining = prev.beatsRemaining;
  let glideRemaining = prev.glideRemaining;
  let glideDihedralDeg = prev.glideDihedralDeg;
  let beatTempoFactor = prev.beatTempoFactor;
  let restBreathPhase = prev.restBreathPhase;

  // Dynamic erratic-flight rhythm: speed spikes, floaty lulls, & wandering detours
  let detourAngleOffset = prev.detourAngleOffset;
  let detourTimer = prev.detourTimer - dt;
  let jinkAngle = prev.jinkAngle * Math.exp(-dt * 2.2);
  let surgeLevel = prev.surgeLevel;
  let surgeTarget = prev.surgeTarget;
  let surgeTimer = prev.surgeTimer - dt;

  const motionScale = config.reducedMotion ? 0.42 : 1.0;
  const uneven = config.reducedMotion ? config.unevenness * 0.35 : config.unevenness;

  // Wake smoothly from resting when cursor moves away or a new spot is clicked
  if (phase === 'resting' && !wantsRest) {
    phase = 'flapping';
    beatsRemaining = 3 + Math.floor(rand() * 3);
    beatTempoFactor = 0.96 + rand() * 0.16;
    surgeTarget = lerp(0.9, 1.32, uneven);
    surgeTimer = 0.36;
    const normalizedOpen = clamp((prev.wingAngleDeg - -8) / (76 - -8), 0, 1);
    wingCycle =
      normalizedOpen > 0.55
        ? lerp(0.45, 0.06, normalizedOpen)
        : lerp(0.56, 0.94, normalizedOpen);
  } else if (phase !== 'resting' && wantsRest) {
    if (phase === 'gliding' || (wingCycle >= 0.42 && wingCycle <= 0.62)) {
      phase = 'resting';
      // Lock the exact spot where it landed — zero drifting afterward!
      const pad = clamp(36 * config.scale, 30, Math.min(bounds.width, bounds.height) * 0.25);
      perchPos = {
        x: clamp(prev.x, pad, bounds.width - pad),
        y: clamp(prev.y, pad, bounds.height - pad),
      };
      perchCursorPos = { x: pointer.x, y: pointer.y };
      const frac = clamp((prev.wingAngleDeg - 14) / (66 - 14), 0, 1);
      restBreathPhase = Math.acos(clamp(1 - 2 * frac, -1, 1));
    }
  }

  if (phase !== 'resting') {
    // 1. Speed-surge envelope: alternates between floaty lulls, gentle cruising, and playful spikes
    if (surgeTimer <= 0) {
      const roll = rand();
      if (roll < 0.34) {
        surgeTarget = lerp(0.95, 1.48, uneven) * (0.9 + rand() * 0.22);
        surgeTimer = 0.26 + rand() * 0.36;
        const jinkSign = rand() < 0.5 ? -1 : 1;
        jinkAngle = jinkSign * (0.32 + rand() * 0.56) * uneven;
      } else if (roll < 0.72) {
        surgeTarget = lerp(0.65, 0.24, uneven) * (0.85 + rand() * 0.3);
        surgeTimer = 0.48 + rand() * 0.65;
      } else {
        surgeTarget = 0.68 + rand() * 0.26;
        surgeTimer = 0.38 + rand() * 0.52;
      }
    }

    const surgeRate = surgeTarget > surgeLevel ? 6.4 : 3.0;
    surgeLevel = lerp(surgeLevel, surgeTarget, 1 - Math.exp(-dt * surgeRate));

    // 2. Periodically pick a fresh off-axis detour angle so A -> B weaves organically
    if (detourTimer <= 0) {
      detourTimer = 0.56 + rand() * 0.95;
      const flipSide =
        rand() < 0.68 ? -Math.sign(detourAngleOffset || 1) : Math.sign(detourAngleOffset || 1);
      const magnitude = (0.38 + rand() * 0.78) * uneven;
      detourAngleOffset = flipSide * magnitude;
    }
  } else {
    surgeLevel = 0;
  }

  // Advance wing kinematics cleanly
  let downstrokeLift = 0;
  let targetWingDeg: number;
  let targetSweepDeg: number;
  let targetFeatherDeg: number;

  if (phase === 'resting') {
    const breathOmega = TWO_PI * (config.reducedMotion ? 0.14 : 0.3);
    restBreathPhase = (restBreathPhase + dt * breathOmega) % TWO_PI;
    const raw = (1 - Math.cos(restBreathPhase)) * 0.5;
    const baskCurve = Math.pow(raw, 1.35);
    targetWingDeg = lerp(14, 66, baskCurve);
    targetSweepDeg = lerp(-1.0, 2.0, baskCurve);
    targetFeatherDeg = 0;
    downstrokeLift = 0;
  } else if (phase === 'gliding') {
    glideRemaining -= dt;
    const shimmer = organicNoise(time * 2.2, 8.2) * 2.6 * uneven;
    targetWingDeg = glideDihedralDeg + shimmer;
    targetSweepDeg = -2.2 + shimmer * 0.2;
    targetFeatherDeg = -1.0;
    downstrokeLift = 0.04;

    const spikeWake = surgeTarget > 1.05 && glideRemaining > 0.1;
    const urgentCatchup = distToAnchor > 320 && glideRemaining > 0.12;
    if (glideRemaining <= 0 || spikeWake || urgentCatchup) {
      phase = 'flapping';
      wingCycle = 0.52;
      const minBeats = uneven > 0.72 ? 2 : 3;
      beatsRemaining = minBeats + Math.floor(rand() * 3.5);
      beatTempoFactor = lerp(1.0, 0.86 + rand() * 0.28, uneven);
    }
  } else {
    const surgeCadenceMult = lerp(0.76, 1.32, clamp(surgeLevel / 1.35, 0, 1));
    const urgencyBoost = clamp((distToAnchor - 140) / 560, 0, 0.14);
    const effectiveHz =
      config.wingCadence *
      beatTempoFactor *
      surgeCadenceMult *
      (1 + urgencyBoost) *
      (config.reducedMotion ? 0.45 : 1.0);

    const prevU = wingCycle;
    const nextU = prevU + dt * effectiveHz;

    const crossedOpenBottom = prevU < 0.5 && nextU >= 0.5;
    if (crossedOpenBottom) {
      beatsRemaining -= 1;
      if (beatsRemaining <= 0) {
        const lullBonus = surgeLevel < 0.65 ? 0.22 : -0.18;
        const glideProb = clamp(lerp(0.32, 0.82, uneven) + lullBonus, 0.12, 0.92);
        if (rand() < glideProb && distToAnchor < 380) {
          phase = 'gliding';
          wingCycle = 0.5;
          const baseGlide = lerp(0.2, 0.58, uneven);
          glideRemaining = baseGlide * (0.72 + rand() * 0.56);
          glideDihedralDeg = 6 + rand() * 10;
        } else {
          beatsRemaining = 2 + Math.floor(rand() * 3);
          wingCycle = nextU % 1;
        }
      } else {
        wingCycle = nextU % 1;
      }
    } else {
      if (nextU >= 1.0) {
        beatTempoFactor = lerp(1.0, 0.86 + rand() * 0.28, uneven);
      }
      wingCycle = nextU % 1;
    }

    const stroke = evaluateWingStroke(wingCycle);
    targetWingDeg = stroke.wingDeg;
    targetSweepDeg = stroke.sweepDeg;
    targetFeatherDeg = stroke.featherDeg;
    downstrokeLift = stroke.downstrokeLift;
  }

  const wingBlend = 1 - Math.exp(-dt * 42);
  const wingAngleDeg = lerp(prev.wingAngleDeg, targetWingDeg, wingBlend);
  const wingSweepDeg = lerp(prev.wingSweepDeg, targetSweepDeg, 1 - Math.exp(-dt * 24));
  const wingFeatherDeg = lerp(prev.wingFeatherDeg, targetFeatherDeg, 1 - Math.exp(-dt * 24));

  // Trajectory & steering physics
  let vx = prev.vx;
  let vy = prev.vy;
  let heading = prev.heading;
  let turnVelocity = prev.turnVelocity;
  let x = prev.x;
  let y = prev.y;
  let elevation = prev.elevation;
  let elevationVel = prev.elevationVel;

  if (phase === 'resting' && perchPos) {
    // Truly motionless perch: stays right where it landed until it flies again!
    x = perchPos.x;
    y = perchPos.y;
    vx = 0;
    vy = 0;
    turnVelocity = 0;
    elevation = lerp(elevation, 0.06, 1 - Math.exp(-dt * 4.5));
    elevationVel = 0;
  } else {
    const dx = anchorX - x;
    const dy = anchorY - y;
    const directHeading = Math.atan2(dy, dx);

    const restFocus = pointer.restSpot ? clamp((distToAnchor - 18) / 100, 0.12, 1.0) : 1.0;

    const wanderWave = organicNoise(time * 0.88, 2.3) * lerp(0.18, 0.62, uneven);
    const courseOffset = (detourAngleOffset + wanderWave + jinkAngle) * restFocus;
    const targetHeading = normalizeAngle(directHeading + courseOffset);
    const angleDiff = normalizeAngle(targetHeading - heading);

    // ~20% calmer turning agility
    const turnResponsiveness =
      lerp(2.0, 3.6, config.followGentleness) *
      lerp(0.74, 1.22, clamp(surgeLevel, 0, 1.3)) *
      motionScale;
    const desiredTurnVel = clamp(angleDiff * turnResponsiveness, -3.5, 3.5);
    turnVelocity = lerp(turnVelocity, desiredTurnVel, 1 - Math.exp(-dt * 5.4));
    heading = normalizeAngle(heading + turnVelocity * dt);

    // ~20% slower cruising speed envelope while preserving strong spike/lull contrast
    const cruiseCeiling = lerp(148, 244, config.followGentleness) * motionScale;
    const cruiseFloor = lerp(30, 50, config.followGentleness) * motionScale;
    const distanceFactor = clamp(distToAnchor / 230, 0, 1);
    const baseSpeed = lerp(cruiseFloor, cruiseCeiling, Math.pow(distanceFactor, 0.8));

    const surgeSpeedMult = lerp(1.0, clamp(0.3 + surgeLevel * 0.94, 0.32, 1.68), uneven);

    let targetSpeed = baseSpeed * surgeSpeedMult;
    if (phase === 'flapping') {
      const strokePulse = 1 + (downstrokeLift - 0.28) * 0.65 * uneven;
      targetSpeed *= strokePulse;
    } else {
      targetSpeed *= 0.72;
    }

    const forwardVx = Math.cos(heading) * targetSpeed;
    const forwardVy = Math.sin(heading) * targetSpeed;

    const spikeLiftScale = lerp(0.75, 1.32, clamp(surgeLevel / 1.3, 0, 1));
    const verticalBob =
      phase === 'flapping'
        ? -(downstrokeLift - 0.3) * 105 * uneven * spikeLiftScale * motionScale
        : 26 * uneven * motionScale;

    const perpX = -Math.sin(heading);
    const perpY = Math.cos(heading);
    const breezeDrift = organicNoise(time * 1.2, 5.9) * 35 * uneven * motionScale;

    const desiredVx = forwardVx + perpX * breezeDrift;
    const desiredVy = forwardVy + perpY * breezeDrift + verticalBob;

    const accelRate = phase === 'gliding' ? 2.6 : surgeLevel > 0.95 ? 6.6 : 4.8;
    const velBlend = 1 - Math.exp(-dt * accelRate);
    vx = lerp(vx, desiredVx, velBlend);
    vy = lerp(vy, desiredVy, velBlend);

    x += vx * dt;
    y += vy * dt;

    const softPad = clamp(36 * config.scale, 30, Math.min(bounds.width, bounds.height) * 0.25);
    if (x < softPad) {
      x = softPad;
      vx = Math.abs(vx) * 0.55;
      detourAngleOffset = -Math.abs(detourAngleOffset);
    } else if (x > bounds.width - softPad) {
      x = bounds.width - softPad;
      vx = -Math.abs(vx) * 0.55;
      detourAngleOffset = Math.abs(detourAngleOffset);
    }
    if (y < softPad) {
      y = softPad;
      vy = Math.abs(vy) * 0.55;
    } else if (y > bounds.height - softPad) {
      y = bounds.height - softPad;
      vy = -Math.abs(vy) * 0.55;
    }

    const liftAccel =
      phase === 'flapping'
        ? (downstrokeLift - 0.3) * 3.4 * uneven * spikeLiftScale
        : -0.55;
    const altitudeSpring = (0.56 - elevation) * 2.3;
    elevationVel = (elevationVel + (liftAccel + altitudeSpring) * dt) * Math.exp(-dt * 3.5);
    elevation = clamp(elevation + elevationVel * dt, 0.14, 1.0);
  }

  // Clean, balanced 3D attitude — restrained roll & pitch prevent any asymmetric wing stretching
  const targetRoll =
    phase === 'resting'
      ? 0
      : clamp(turnVelocity * 5.2, -14, 14) +
        organicNoise(time * 1.0, 6.4) * 2.0 * uneven;
  const targetPitch =
    phase === 'resting'
      ? 24
      : phase === 'gliding'
      ? 18 + organicNoise(time * 0.9, 1.5) * 2
      : 21 + downstrokeLift * 5 * uneven;

  const attBlend = 1 - Math.exp(-dt * 6.2);
  const bodyRollDeg = lerp(prev.bodyRollDeg, targetRoll, attBlend);
  const bodyPitchDeg = lerp(prev.bodyPitchDeg, targetPitch, attBlend);

  // Keep left & right wing fold symmetric (banking comes naturally from whole-body roll)
  const clampedWing = clamp(wingAngleDeg, -12, 76);
  const pose: WingPose = {
    leftWingDeg: clampedWing,
    rightWingDeg: clampedWing,
    wingSweepDeg,
    wingFeatherDeg,
    bodyPitchDeg,
    bodyRollDeg,
    elevation,
  };

  // Update soft dotted flight trail
  let trailAccumulator = prev.trailAccumulator + dt;
  const trail: TrailPoint[] = [];
  for (let i = 0; i < prev.trail.length; i++) {
    const pt = prev.trail[i];
    const nextAge = pt.age + dt;
    if (nextAge < TRAIL_MAX_AGE) {
      trail.push({ ...pt, age: nextAge });
    }
  }
  if (trailAccumulator >= 0.036 && phase !== 'resting') {
    trailAccumulator = 0;
    trail.push({ x, y, age: 0, phase });
    if (trail.length > MAX_TRAIL_POINTS) {
      trail.shift();
    }
  }

  return {
    x,
    y,
    vx,
    vy,
    heading,
    turnVelocity,
    time,
    phase,
    wingCycle,
    beatTempoFactor,
    beatsRemaining,
    glideRemaining,
    glideDihedralDeg,
    restBreathPhase,
    wingAngleDeg,
    wingSweepDeg,
    wingFeatherDeg,
    elevation,
    elevationVel,
    bodyPitchDeg,
    bodyRollDeg,
    pose,
    detourAngleOffset,
    detourTimer,
    jinkAngle,
    surgeLevel,
    surgeTarget,
    surgeTimer,
    perchPos,
    perchCursorPos,
    trail,
    trailAccumulator,
    rngState,
  };
}
