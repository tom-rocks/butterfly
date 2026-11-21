export type ButterflyPresetId = 'drift' | 'breeze' | 'rest';

export type FlightPhase = 'flapping' | 'gliding' | 'resting';

export interface ButterflyConfig {
  /** 0.2 (very lazy/distant) to 1.0 (closer, responsive) */
  followGentleness: number;
  /** 0.15 (smoother) to 1.0 (pronounced beat-glide unevenness & bobbing) */
  unevenness: number;
  /** Base wingbeat frequency in Hz during active flapping (2.0 to 6.8) */
  wingCadence: number;
  /** Visual scale multiplier relative to natural small butterfly size (0.65 to 1.5) */
  scale: number;
  /** Primary watercolor hex color */
  color: string;
  /** Respect prefers-reduced-motion */
  reducedMotion: boolean;
}

export interface WingPose {
  /** Fold angle in degrees: ~-10 (full wide downstroke) to +78 (dorsal clap up) */
  leftWingDeg: number;
  rightWingDeg: number;
  /** Subtle in-plane fore/aft wing sweep during downstroke vs upstroke (degrees) */
  wingSweepDeg: number;
  /** Subtle aeroelastic twist / feathering around spanwise axis (degrees) */
  wingFeatherDeg: number;
  /** Natural nose-up flight posture (degrees) so folded wings stay gracefully visible in 3D */
  bodyPitchDeg: number;
  /** Banking lean into turns (degrees) */
  bodyRollDeg: number;
  /** Height above paper surface [0..1] controlling soft shadow & gentle altitude scale */
  elevation: number;
}

export interface TrailPoint {
  x: number;
  y: number;
  age: number;
  phase: FlightPhase;
}

export interface PointerTarget {
  x: number;
  y: number;
  active: boolean;
  idleSeconds: number;
  restSpot: { x: number; y: number } | null;
}

export interface ViewportBounds {
  width: number;
  height: number;
}

export interface ButterflyState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Heading in radians: 0 = +x (right), PI/2 = +y (down) */
  heading: number;
  turnVelocity: number;
  /** Elapsed simulation time in seconds */
  time: number;
  phase: FlightPhase;
  /** Normalized wingbeat cycle position u in [0, 1):
   *  0.00 = dorsal clap (wings folded up)
   *  0.45..0.56 = open air-cushion (natural glide entry/exit at 0.50)
   *  0.56..0.94 = smooth upstroke back to clap
   */
  wingCycle: number;
  /** Current beat tempo jitter multiplier */
  beatTempoFactor: number;
  /** Remaining wingbeats before entering a glide at u=0.50 */
  beatsRemaining: number;
  /** Remaining glide duration in seconds */
  glideRemaining: number;
  /** Target dihedral angle during current glide (degrees) */
  glideDihedralDeg: number;
  /** Slow breathing cycle phase when resting (radians) */
  restBreathPhase: number;
  /** Continuous smoothed wing angle (degrees) preventing any phase-switch discontinuity */
  wingAngleDeg: number;
  wingSweepDeg: number;
  wingFeatherDeg: number;
  /** Vertical bobbing velocity & height [0..1] */
  elevation: number;
  elevationVel: number;
  /** Smoothed attitude angles */
  bodyPitchDeg: number;
  bodyRollDeg: number;
  /** Current rendered pose */
  pose: WingPose;
  /** Meandering off-axis detour waypoint bias so A->B is never a straight line */
  detourAngleOffset: number;
  detourTimer: number;
  /** Spontaneous brief mid-air course jink (radians, decays gently) */
  jinkAngle: number;
  /** Dynamic flight energy/speed envelope: alternates between floaty lulls (~0.25) and brisk spikes (~1.35) */
  surgeLevel: number;
  surgeTarget: number;
  surgeTimer: number;
  /** Locked perch coordinates when resting so the butterfly stays completely still until it flies again */
  perchPos: { x: number; y: number } | null;
  perchCursorPos: { x: number; y: number } | null;
  /** Subtle dotted trail history */
  trail: TrailPoint[];
  trailAccumulator: number;
  /** Deterministic PRNG state */
  rngState: number;
}

export interface PresetDefinition {
  id: ButterflyPresetId;
  label: string;
  description: string;
  config: Omit<ButterflyConfig, 'color' | 'reducedMotion'>;
}

export const BUTTERFLY_COLOR = '#59789c';

export const BUTTERFLY_PRESETS: Record<ButterflyPresetId, PresetDefinition> = {
  drift: {
    id: 'drift',
    label: 'Drift',
    description: 'Peaceful wandering flight with playful speed spikes, detours, and floaty lulls',
    config: {
      followGentleness: 0.54,
      unevenness: 0.78,
      wingCadence: 3.8,
      scale: 0.65,
    },
  },
  breeze: {
    id: 'breeze',
    label: 'Breeze',
    description: 'Wider meandering detours with airy open-wing glides and sudden gusts',
    config: {
      followGentleness: 0.36,
      unevenness: 0.94,
      wingCadence: 2.8,
      scale: 0.65,
    },
  },
  rest: {
    id: 'rest',
    label: 'Rest',
    description: 'Settles quietly near your cursor with slow breathing wings',
    config: {
      followGentleness: 0.72,
      unevenness: 0.62,
      wingCadence: 2.6,
      scale: 0.65,
    },
  },
};
