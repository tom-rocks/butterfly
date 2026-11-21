import { useEffect, useRef } from 'react';
import {
  createInitialButterflyState,
  stepButterfly,
} from '../butterfly/flightEngine';
import {
  BUTTERFLY_COLOR,
  ButterflyConfig,
  ButterflyState,
  PointerTarget,
} from '../butterfly/types';
import { ButterflyArtwork, ButterflyArtworkHandle } from './ButterflyArtwork';

interface ButterflyStageProps {
  config: ButterflyConfig;
  paused: boolean;
  showTrail: boolean;
  showPinboardGrid: boolean;
  resetToken: number;
}

interface RippleMark {
  x: number;
  y: number;
  age: number;
  maxAge: number;
}

export function ButterflyStage({
  config,
  paused,
  showTrail,
  showPinboardGrid,
  resetToken,
}: ButterflyStageProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const artworkRef = useRef<ButterflyArtworkHandle>(null);

  // Live mutable refs so the 60fps loop never tears down on prop changes
  const configRef = useRef<ButterflyConfig>(config);
  const pausedRef = useRef<boolean>(paused);
  const showTrailRef = useRef<boolean>(showTrail);

  configRef.current = config;
  pausedRef.current = paused;
  showTrailRef.current = showTrail;

  const stateRef = useRef<ButterflyState | null>(null);
  const pointerRef = useRef<PointerTarget>({
    x: 0,
    y: 0,
    active: false,
    idleSeconds: 0,
    restSpot: null,
  });
  const lastMovePosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const ripplesRef = useRef<RippleMark[]>([]);

  // Handle explicit reset without unmounting the RAF loop
  useEffect(() => {
    if (resetToken === 0) return;
    const width = window.innerWidth || 1440;
    const height = window.innerHeight || 900;
    pointerRef.current = {
      x: width * 0.5,
      y: height * 0.5,
      active: false,
      idleSeconds: 0,
      restSpot: null,
    };
    ripplesRef.current = [];
    const fresh = createInitialButterflyState({ width, height }, 1337 + resetToken * 97);
    stateRef.current = fresh;
    artworkRef.current?.applyState(fresh, configRef.current.scale);
  }, [resetToken]);

  useEffect(() => {
    const stageEl = stageRef.current;
    const canvasEl = canvasRef.current;
    if (!stageEl || !canvasEl) return;

    const ctx = canvasEl.getContext('2d');
    if (!ctx) return;

    let width = window.innerWidth || 1440;
    let height = window.innerHeight || 900;

    const syncCanvasSize = () => {
      width = window.innerWidth || 1440;
      height = window.innerHeight || 900;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvasEl.width = Math.floor(width * dpr);
      canvasEl.height = Math.floor(height * dpr);
      canvasEl.style.width = `${width}px`;
      canvasEl.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Keep butterfly cleanly inside wingspan margins after viewport resize
      if (stateRef.current) {
        const pad = Math.min(36 * configRef.current.scale, Math.min(width, height) * 0.25);
        const clampedX = Math.max(pad, Math.min(width - pad, stateRef.current.x));
        const clampedY = Math.max(pad, Math.min(height - pad, stateRef.current.y));
        if (clampedX !== stateRef.current.x || clampedY !== stateRef.current.y) {
          stateRef.current = { ...stateRef.current, x: clampedX, y: clampedY };
          artworkRef.current?.applyState(stateRef.current, configRef.current.scale);
        }
      }
    };

    syncCanvasSize();
    stateRef.current = createInitialButterflyState({ width, height }, 1337);
    artworkRef.current?.applyState(stateRef.current, configRef.current.scale);

    const handlePointerMove = (e: PointerEvent) => {
      const dx = e.clientX - lastMovePosRef.current.x;
      const dy = e.clientY - lastMovePosRef.current.y;
      const moved = Math.hypot(dx, dy);

      pointerRef.current.x = e.clientX;
      pointerRef.current.y = e.clientY;
      pointerRef.current.active = true;

      if (moved > 3) {
        lastMovePosRef.current = { x: e.clientX, y: e.clientY };
        pointerRef.current.idleSeconds = 0;

        // Release an invited rest spot once the user moves the cursor noticeably away
        if (pointerRef.current.restSpot) {
          const distFromRest = Math.hypot(
            e.clientX - pointerRef.current.restSpot.x,
            e.clientY - pointerRef.current.restSpot.y
          );
          if (distFromRest > 64) {
            pointerRef.current.restSpot = null;
          }
        }
      }
    };

    const handlePointerLeave = () => {
      // Gently return to autonomous peaceful roaming when cursor leaves window
      if (!pointerRef.current.restSpot) {
        pointerRef.current.active = false;
      }
    };

    const handleStageClick = (e: MouseEvent) => {
      // Only invite rest when clicking directly on the open canvas (not on controls)
      const target = e.target as HTMLElement | null;
      if (target && target.closest('[data-ui-control="true"]')) {
        return;
      }

      pointerRef.current.x = e.clientX;
      pointerRef.current.y = e.clientY;
      pointerRef.current.active = true;
      pointerRef.current.idleSeconds = 0;
      pointerRef.current.restSpot = { x: e.clientX, y: e.clientY };
      lastMovePosRef.current = { x: e.clientX, y: e.clientY };

      ripplesRef.current.push({
        x: e.clientX,
        y: e.clientY,
        age: 0,
        maxAge: 1.35,
      });
    };

    window.addEventListener('resize', syncCanvasSize);
    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    document.addEventListener('pointerleave', handlePointerLeave);
    stageEl.addEventListener('click', handleStageClick);

    let rafId = 0;
    let lastTimestamp = performance.now();
    let attrTick = 0;

    const renderOverlay = (state: ButterflyState, dt: number) => {
      ctx.clearRect(0, 0, width, height);
      const color = configRef.current.color || BUTTERFLY_COLOR;

      // 1. Optional faint ink-dotted flight path showing uneven beat-glide rhythm
      if (showTrailRef.current && state.trail.length > 1) {
        for (let i = 1; i < state.trail.length; i++) {
          const prevPt = state.trail[i - 1];
          const pt = state.trail[i];
          const life = Math.max(0, 1 - pt.age / 6.5);
          const alpha = life * life * (pt.phase === 'gliding' ? 0.52 : 0.36);

          ctx.beginPath();
          ctx.moveTo(prevPt.x, prevPt.y);
          ctx.lineTo(pt.x, pt.y);
          ctx.strokeStyle = color;
          ctx.globalAlpha = alpha;
          ctx.lineWidth = pt.phase === 'gliding' ? 1.85 : 1.25;
          ctx.setLineDash(pt.phase === 'gliding' ? [] : [3, 4.5]);
          ctx.stroke();
        }
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
      }

      // 2. Subtle click-to-rest invitation ripple
      const nextRipples: RippleMark[] = [];
      for (const r of ripplesRef.current) {
        const nextAge = r.age + dt;
        if (nextAge < r.maxAge) {
          const p = nextAge / r.maxAge;
          const easeOut = 1 - Math.pow(1 - p, 3);
          const radius = 5 + easeOut * 28;
          ctx.beginPath();
          ctx.arc(r.x, r.y, radius, 0, Math.PI * 2);
          ctx.strokeStyle = color;
          ctx.lineWidth = 1.1;
          ctx.globalAlpha = (1 - p) * 0.34;
          ctx.stroke();
          nextRipples.push({ ...r, age: nextAge });
        }
      }
      ripplesRef.current = nextRipples;

      // Subtle resting anchor whisper dot while waiting for butterfly to land
      if (pointerRef.current.restSpot) {
        const { x: rx, y: ry } = pointerRef.current.restSpot;
        ctx.beginPath();
        ctx.arc(rx, ry, 2.2, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.28;
        ctx.fill();
      }

      ctx.globalAlpha = 1;
    };

    const tick = (now: number) => {
      const rawDt = Math.min((now - lastTimestamp) / 1000, 0.05);
      lastTimestamp = now;

      const currentState = stateRef.current;
      if (currentState) {
        if (!pausedRef.current) {
          if (pointerRef.current.active) {
            pointerRef.current.idleSeconds += rawDt;
          }
          const nextState = stepButterfly(
            currentState,
            rawDt,
            { width, height },
            pointerRef.current,
            configRef.current
          );
          stateRef.current = nextState;
          artworkRef.current?.applyState(nextState, configRef.current.scale);
          renderOverlay(nextState, rawDt);

          // Expose lightweight DOM attributes periodically for verification & testability
          attrTick += 1;
          if (attrTick % 6 === 0) {
            stageEl.dataset.phase = nextState.phase;
            stageEl.dataset.butterflyX = String(Math.round(nextState.x));
            stageEl.dataset.butterflyY = String(Math.round(nextState.y));
          }
        } else {
          // Even while paused, reflect scale/trail changes immediately
          artworkRef.current?.applyState(currentState, configRef.current.scale);
          renderOverlay(currentState, 0);
        }
      }

      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener('resize', syncCanvasSize);
      window.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerleave', handlePointerLeave);
      stageEl.removeEventListener('click', handleStageClick);
    };
  }, []);

  return (
    <div
      ref={stageRef}
      data-testid="butterfly-stage"
      data-phase="flapping"
      data-paused={paused ? 'true' : 'false'}
      data-trail={showTrail ? 'on' : 'off'}
      data-grid={showPinboardGrid ? 'on' : 'off'}
      className="relative w-full h-full paper-canvas select-none cursor-default overflow-hidden"
    >
      {/* Subtle cotton paper grain texture */}
      <div className="pointer-events-none absolute inset-0 paper-grain" aria-hidden="true" />

      {/* Optional faint pinboard dot grid */}
      <div
        className={`pointer-events-none absolute inset-0 pinboard-grid transition-opacity duration-500 ${
          showPinboardGrid ? 'opacity-100' : 'opacity-0'
        }`}
        aria-hidden="true"
      />

      {/* Lightweight overlay canvas for optional flight path, rest ripple, and sparse star motes */}
      <canvas
        ref={canvasRef}
        data-testid="butterfly-overlay-canvas"
        className="pointer-events-none absolute inset-0"
        aria-hidden="true"
      />

      {/* The watercolor #59789c butterfly */}
      <ButterflyArtwork ref={artworkRef} color={config.color} />
    </div>
  );
}
