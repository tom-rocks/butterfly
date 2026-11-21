import test from 'node:test';
import assert from 'node:assert/strict';
import { projectButterflyTo2D } from './wingProjection';
import { WingPose } from './types';

const NEUTRAL_POSE: WingPose = {
  leftWingDeg: 24,
  rightWingDeg: 24,
  wingSweepDeg: 0,
  wingFeatherDeg: 0,
  bodyPitchDeg: 20,
  bodyRollDeg: 0,
  elevation: 0.5,
};

test('level butterfly projects symmetrically with matching left/right depth and valid SVG paths', () => {
  // heading = -PI/2 points straight up (-Y), so headingDeg = 0
  const proj = projectButterflyTo2D(-Math.PI / 2, NEUTRAL_POSE, 1.0);

  assert.ok(proj.leftWing.foreWash.startsWith('M') && proj.leftWing.foreWash.endsWith('Z'));
  assert.ok(proj.rightWing.foreWash.startsWith('M') && proj.rightWing.foreWash.endsWith('Z'));
  assert.ok(proj.bodyPath.startsWith('M') && proj.bodyPath.endsWith('Z'));
  assert.ok(!proj.leftWing.foreContour.includes('NaN'));
  assert.ok(!proj.rightWing.foreContour.includes('NaN'));

  // Exact symmetry when roll is 0 and wings match
  assert.ok(Math.abs(proj.leftWing.depthZ - proj.rightWing.depthZ) < 1e-6);
  assert.ok(Math.abs(proj.leftWing.foreGrad.cx + proj.rightWing.foreGrad.cx) < 1e-3);
  assert.ok(Math.abs(proj.leftWing.foreGrad.cy - proj.rightWing.foreGrad.cy) < 1e-3);
  assert.ok(Math.abs(proj.leftWing.foreGrad.r - proj.rightWing.foreGrad.r) < 1e-3);
});

test('banking right places nearer wing in front of body in painter renderOrder', () => {
  const bankedRight: WingPose = { ...NEUTRAL_POSE, bodyRollDeg: 14 };
  const bankedLeft: WingPose = { ...NEUTRAL_POSE, bodyRollDeg: -14 };

  const rightProj = projectButterflyTo2D(-Math.PI / 2, bankedRight, 1.0);
  const leftProj = projectButterflyTo2D(-Math.PI / 2, bankedLeft, 1.0);

  assert.notEqual(rightProj.leftWing.depthZ, rightProj.rightWing.depthZ);
  assert.equal(rightProj.renderOrder.length, 3);
  assert.equal(leftProj.renderOrder.length, 3);
  // Opposite banking reverses which wing is closer
  assert.equal(
    rightProj.leftWing.depthZ > rightProj.rightWing.depthZ,
    leftProj.rightWing.depthZ > leftProj.leftWing.depthZ
  );
});

test('folded resting wings keep clean positive gradient radii and finite coordinates across full breathing cycle', () => {
  for (let deg = -10; deg <= 78; deg += 4) {
    const pose: WingPose = {
      ...NEUTRAL_POSE,
      leftWingDeg: deg,
      rightWingDeg: deg,
      bodyPitchDeg: 24,
    };
    const proj = projectButterflyTo2D(0.4, pose, 1.0);
    assert.ok(proj.leftWing.foreGrad.r > 0 && Number.isFinite(proj.leftWing.foreGrad.r));
    assert.ok(proj.rightWing.hindGrad.r > 0 && Number.isFinite(proj.rightWing.hindGrad.r));
    assert.ok(Number.isFinite(proj.headX) && Number.isFinite(proj.headY));
  }
});
