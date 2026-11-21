import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createDefaultConfig,
  createInitialButterflyState,
  evaluateWingStroke,
  stepButterfly,
} from './flightEngine';
import { BUTTERFLY_COLOR, BUTTERFLY_PRESETS, PointerTarget, ViewportBounds } from './types';

const BOUNDS: ViewportBounds = { width: 1440, height: 900 };

test('initial state spawns peacefully inside bounds with valid unified wing pose', () => {
  const state = createInitialButterflyState(BOUNDS, 42);
  assert.ok(state.x > 0 && state.x < BOUNDS.width);
  assert.ok(state.y > 0 && state.y < BOUNDS.height);
  assert.equal(state.phase, 'flapping');
  assert.ok(Number.isFinite(state.pose.leftWingDeg));
  assert.ok(Number.isFinite(state.pose.rightWingDeg));
  assert.equal(state.pose.leftWingDeg, state.pose.rightWingDeg);
  assert.equal('motes' in state, false, 'stars and sparkle motes should be removed');
});

test('clap-and-fling wing stroke is smooth, continuous, and generates downstroke lift', () => {
  let maxDownstrokeLift = 0;
  let minDeg = Infinity;
  let maxDeg = -Infinity;
  let prevDeg = evaluateWingStroke(0).wingDeg;
  let maxDeltaPerStep = 0;

  for (let i = 1; i <= 100; i++) {
    const u = i / 100;
    const stroke = evaluateWingStroke(u);
    minDeg = Math.min(minDeg, stroke.wingDeg);
    maxDeg = Math.max(maxDeg, stroke.wingDeg);
    maxDownstrokeLift = Math.max(maxDownstrokeLift, stroke.downstrokeLift);
    maxDeltaPerStep = Math.max(maxDeltaPerStep, Math.abs(stroke.wingDeg - prevDeg));
    prevDeg = stroke.wingDeg;
  }

  assert.ok(maxDownstrokeLift > 0.9, 'downstroke should peak with buoyant lift');
  assert.ok(minDeg <= -7 && maxDeg >= 74, 'stroke should sweep full open-to-clap range');
  assert.ok(maxDeltaPerStep < 6.5, `wing stroke must be smooth with no jumps (got ${maxDeltaPerStep.toFixed(2)} deg/1%)`);
});

test('perched butterfly stays completely motionless with zero drift until cursor moves away', () => {
  const config = createDefaultConfig(false);
  let state = createInitialButterflyState(BOUNDS, 777);

  // Hold cursor still near butterfly so it lands around it
  const stationaryCursor = { x: state.x + 28, y: state.y - 16 };
  let idleSeconds = 0;
  for (let i = 0; i < 360; i++) {
    idleSeconds += 1 / 60;
    state = stepButterfly(
      state,
      1 / 60,
      BOUNDS,
      { x: stationaryCursor.x, y: stationaryCursor.y, active: true, idleSeconds, restSpot: null },
      config
    );
    if (state.phase === 'resting') break;
  }

  assert.equal(state.phase, 'resting', 'butterfly should land when cursor stays still');
  const landedX = state.x;
  const landedY = state.y;

  // Step 3 full seconds while cursor stays still -> ZERO positional drift!
  let wingAnglesSeen = new Set<number>();
  for (let i = 0; i < 180; i++) {
    idleSeconds += 1 / 60;
    state = stepButterfly(
      state,
      1 / 60,
      BOUNDS,
      { x: stationaryCursor.x, y: stationaryCursor.y, active: true, idleSeconds, restSpot: null },
      config
    );
    assert.equal(state.phase, 'resting', 'should remain perched while cursor stays still');
    assert.equal(state.x, landedX, 'perched butterfly must not drift horizontally');
    assert.equal(state.y, landedY, 'perched butterfly must not drift vertically');
    assert.equal(state.vx, 0);
    assert.equal(state.vy, 0);
    wingAnglesSeen.add(Math.round(state.pose.leftWingDeg));
  }

  assert.ok(wingAnglesSeen.size > 10, 'perched butterfly should keep gentle breathing wings');

  // Now move cursor away -> wakes smoothly and flies again!
  for (let i = 0; i < 20; i++) {
    state = stepButterfly(
      state,
      1 / 60,
      BOUNDS,
      { x: stationaryCursor.x + 220, y: stationaryCursor.y + 80, active: true, idleSeconds: 0, restSpot: null },
      config
    );
  }
  assert.notEqual(state.phase, 'resting', 'butterfly should take off once cursor moves away');
});

test('flight from A to B curves organically, spikes/slows in speed, and stays within warp-free attitude limits', () => {
  const config = createDefaultConfig(false);
  let state = createInitialButterflyState(BOUNDS, 202);
  const startX = state.x;
  const startY = state.y;
  const targetX = 1180;
  const targetY = 460;
  const abLen = Math.hypot(targetX - startX, targetY - startY);

  const pointer: PointerTarget = {
    x: targetX,
    y: targetY,
    active: true,
    idleSeconds: 0,
    restSpot: null,
  };

  let maxPerpDeviation = 0;
  let minSpeed = Infinity;
  let maxSpeed = 0;
  let maxAbsRoll = 0;
  let maxAbsFeather = 0;
  let maxWingAsym = 0;

  for (let i = 0; i < 360; i++) {
    state = stepButterfly(state, 1 / 60, BOUNDS, pointer, config);
    const speed = Math.hypot(state.vx, state.vy);
    if (i > 15) {
      minSpeed = Math.min(minSpeed, speed);
      maxSpeed = Math.max(maxSpeed, speed);
    }
    maxAbsRoll = Math.max(maxAbsRoll, Math.abs(state.pose.bodyRollDeg));
    maxAbsFeather = Math.max(maxAbsFeather, Math.abs(state.pose.wingFeatherDeg));
    maxWingAsym = Math.max(maxWingAsym, Math.abs(state.pose.leftWingDeg - state.pose.rightWingDeg));

    const cross = Math.abs(
      (targetX - startX) * (startY - state.y) - (startX - state.x) * (targetY - startY)
    );
    maxPerpDeviation = Math.max(maxPerpDeviation, cross / abLen);
  }

  const finalDist = Math.hypot(targetX - state.x, targetY - state.y);
  assert.ok(maxPerpDeviation > 35, `butterfly should meander off-line (got ${maxPerpDeviation.toFixed(1)}px)`);
  assert.ok(maxSpeed / Math.max(minSpeed, 1) > 2.2, `expected speed spikes & lulls (min=${minSpeed.toFixed(1)}, max=${maxSpeed.toFixed(1)})`);
  assert.ok(finalDist < abLen * 0.45, `should converge near B (start=${abLen.toFixed(0)}, end=${finalDist.toFixed(0)})`);
  assert.ok(maxAbsRoll <= 16.5, `roll should stay gentle to prevent 3D wing warping (got ${maxAbsRoll.toFixed(1)} deg)`);
  assert.ok(maxAbsFeather <= 6, `feathering should stay subtle (got ${maxAbsFeather.toFixed(1)} deg)`);
  assert.equal(maxWingAsym, 0, 'left and right wing fold angles should remain symmetric');
});

test('narrow mobile viewport maintains wingspan padding so wings never clip edges', () => {
  const mobileBounds: ViewportBounds = { width: 390, height: 844 };
  const config = createDefaultConfig(false);
  let state = createInitialButterflyState(mobileBounds, 606);
  const edgePointer: PointerTarget = {
    x: 390,
    y: 10,
    active: true,
    idleSeconds: 0,
    restSpot: null,
  };

  for (let i = 0; i < 240; i++) {
    state = stepButterfly(state, 1 / 60, mobileBounds, edgePointer, config);
    assert.ok(state.x >= 30 && state.x <= mobileBounds.width - 30);
    assert.ok(state.y >= 30 && state.y <= mobileBounds.height - 30);
  }
});

test('default preset uses configured defaults and color #59789c while reducedMotion keeps movement calm', () => {
  const defaults = createDefaultConfig(false);
  assert.equal(BUTTERFLY_COLOR, '#59789c');
  assert.equal(defaults.followGentleness, 0.54);
  assert.equal(defaults.unevenness, 0.78);
  assert.equal(defaults.wingCadence, 3.8);
  assert.equal(defaults.scale, 0.65);
  assert.ok(BUTTERFLY_PRESETS.breeze.config.unevenness > BUTTERFLY_PRESETS.rest.config.unevenness);

  const reducedConfig = createDefaultConfig(true);
  let state = createInitialButterflyState(BOUNDS, 505);
  const pointer: PointerTarget = { x: 1200, y: 700, active: true, idleSeconds: 0, restSpot: null };

  let maxStep = 0;
  for (let i = 0; i < 120; i++) {
    const px = state.x;
    const py = state.y;
    state = stepButterfly(state, 1 / 60, BOUNDS, pointer, reducedConfig);
    maxStep = Math.max(maxStep, Math.hypot(state.x - px, state.y - py));
  }

  assert.ok(maxStep < 5.0, 'reduced motion should keep movement extra gentle');
});
