import { forwardRef, useImperativeHandle, useRef } from 'react';
import { BUTTERFLY_COLOR, ButterflyState } from '../butterfly/types';
import { ProjectedWing, projectButterflyTo2D } from '../butterfly/wingProjection';

export interface ButterflyArtworkHandle {
  applyState: (state: ButterflyState, scale: number) => void;
}

interface ButterflyArtworkProps {
  color?: string;
}

interface WingDomRefs {
  group: SVGGElement | null;
  hindWash: SVGPathElement | null;
  hindBloom: SVGPathElement | null;
  hindContour: SVGPathElement | null;
  hindAccent: SVGPathElement | null;
  foreWash: SVGPathElement | null;
  foreBloom: SVGPathElement | null;
  foreDetail: SVGPathElement | null;
  foreContour: SVGPathElement | null;
  foreAccent: SVGPathElement | null;
  foreGrad: SVGRadialGradientElement | null;
  hindGrad: SVGRadialGradientElement | null;
}

function updateWingDom(refs: WingDomRefs, wing: ProjectedWing, strokeScale: number) {
  refs.hindWash?.setAttribute('d', wing.hindWash);
  refs.hindBloom?.setAttribute('d', wing.hindBloom);
  refs.hindContour?.setAttribute('d', wing.hindContour);
  refs.hindContour?.setAttribute('stroke-width', (1.8 * strokeScale).toFixed(2));
  refs.hindAccent?.setAttribute('d', wing.hindAccent);
  refs.hindAccent?.setAttribute('stroke-width', (2.15 * strokeScale).toFixed(2));

  refs.foreWash?.setAttribute('d', wing.foreWash);
  refs.foreBloom?.setAttribute('d', wing.foreBloom);
  refs.foreDetail?.setAttribute('d', wing.foreDetail);
  refs.foreContour?.setAttribute('d', wing.foreContour);
  refs.foreContour?.setAttribute('stroke-width', (1.9 * strokeScale).toFixed(2));
  refs.foreAccent?.setAttribute('d', wing.foreAccent);
  refs.foreAccent?.setAttribute('stroke-width', (3.0 * strokeScale).toFixed(2));

  if (refs.foreGrad) {
    refs.foreGrad.setAttribute('cx', wing.foreGrad.cx.toFixed(2));
    refs.foreGrad.setAttribute('cy', wing.foreGrad.cy.toFixed(2));
    refs.foreGrad.setAttribute('r', wing.foreGrad.r.toFixed(2));
  }
  if (refs.hindGrad) {
    refs.hindGrad.setAttribute('cx', wing.hindGrad.cx.toFixed(2));
    refs.hindGrad.setAttribute('cy', wing.hindGrad.cy.toFixed(2));
    refs.hindGrad.setAttribute('r', wing.hindGrad.r.toFixed(2));
  }
}

/**
 * Pure 2D native-vector SVG butterfly in #59789c driven by exact 3D Bezier projection.
 * Uses ZERO CSS 3D transforms and ZERO `will-change: transform` bitmap caching,
 * ensuring silky, subpixel-antialiased edges at every angle — especially during slow landing breaths.
 */
export const ButterflyArtwork = forwardRef<ButterflyArtworkHandle, ButterflyArtworkProps>(
  function ButterflyArtwork({ color = BUTTERFLY_COLOR }, ref) {
    const shadowGroupRef = useRef<SVGGElement>(null);
    const rigGroupRef = useRef<SVGGElement>(null);
    const bodyGroupRef = useRef<SVGGElement>(null);
    const bodyPathRef = useRef<SVGPathElement>(null);
    const headCircleRef = useRef<SVGCircleElement>(null);

    const leftRefs = useRef<WingDomRefs>({
      group: null,
      hindWash: null,
      hindBloom: null,
      hindContour: null,
      hindAccent: null,
      foreWash: null,
      foreBloom: null,
      foreDetail: null,
      foreContour: null,
      foreAccent: null,
      foreGrad: null,
      hindGrad: null,
    });

    const rightRefs = useRef<WingDomRefs>({
      group: null,
      hindWash: null,
      hindBloom: null,
      hindContour: null,
      hindAccent: null,
      foreWash: null,
      foreBloom: null,
      foreDetail: null,
      foreContour: null,
      foreAccent: null,
      foreGrad: null,
      hindGrad: null,
    });

    const lastOrderKeyRef = useRef<string>('left,body,right');

    useImperativeHandle(ref, () => ({
      applyState(state: ButterflyState, scale: number) {
        const projected = projectButterflyTo2D(state.heading, state.pose, scale);
        const { altitudeScale, headingDeg } = projected;

        if (rigGroupRef.current) {
          rigGroupRef.current.setAttribute(
            'transform',
            `translate(${state.x.toFixed(2)} ${state.y.toFixed(2)})`
          );
        }

        // Update pure 2D projected Bezier paths & gradients for left and right wings
        updateWingDom(leftRefs.current, projected.leftWing, altitudeScale);
        updateWingDom(rightRefs.current, projected.rightWing, altitudeScale);

        if (bodyPathRef.current) {
          bodyPathRef.current.setAttribute('d', projected.bodyPath);
        }
        if (headCircleRef.current) {
          headCircleRef.current.setAttribute('cx', projected.headX.toFixed(2));
          headCircleRef.current.setAttribute('cy', projected.headY.toFixed(2));
          headCircleRef.current.setAttribute('r', projected.headR.toFixed(2));
        }

        // Reorder SVG wing/body groups cleanly only when 3D banking flips depth order
        const orderKey = projected.renderOrder.join(',');
        if (rigGroupRef.current && orderKey !== lastOrderKeyRef.current) {
          lastOrderKeyRef.current = orderKey;
          const nodeMap: Record<'left' | 'body' | 'right', SVGGElement | null> = {
            left: leftRefs.current.group,
            body: bodyGroupRef.current,
            right: rightRefs.current.group,
          };
          for (const id of projected.renderOrder) {
            const el = nodeMap[id];
            if (el) rigGroupRef.current.appendChild(el);
          }
        }

        // Update soft paper shadow inside the same pure SVG surface
        if (shadowGroupRef.current) {
          const { leftWingDeg, rightWingDeg, elevation } = state.pose;
          const effectiveScale = scale * 0.5;
          const shadowDx = 3 + elevation * 12;
          const shadowDy = 4 + elevation * 15;
          const avgFoldRad = (((leftWingDeg + rightWingDeg) * 0.5) * Math.PI) / 180;
          const wingProjection = Math.max(0.2, Math.cos(Math.max(0, avgFoldRad)));
          const shadowScaleX = effectiveScale * (0.28 + wingProjection * 0.74);
          const shadowScaleY = effectiveScale * (0.86 + elevation * 0.08);
          const shadowOpacity = 0.045 + (1 - elevation) * 0.125;

          shadowGroupRef.current.setAttribute(
            'transform',
            `translate(${(state.x + shadowDx).toFixed(2)} ${(state.y + shadowDy).toFixed(2)}) ` +
              `rotate(${headingDeg.toFixed(2)}) ` +
              `scale(${shadowScaleX.toFixed(3)} ${shadowScaleY.toFixed(3)})`
          );
          shadowGroupRef.current.setAttribute('opacity', shadowOpacity.toFixed(3));
        }
      },
    }));

    return (
      <svg
        className="pointer-events-none fixed inset-0 w-full h-full overflow-visible"
        shapeRendering="geometricPrecision"
        aria-hidden="true"
      >
        <defs>
          <radialGradient id="bf-shadow-grad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={color} stopOpacity="0.58" />
            <stop offset="65%" stopColor={color} stopOpacity="0.18" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </radialGradient>

          <radialGradient
            id="bf-wash-fore-l"
            ref={(el) => {
              leftRefs.current.foreGrad = el;
            }}
            gradientUnits="userSpaceOnUse"
            cx="0"
            cy="0"
            r="30"
          >
            <stop offset="0%" stopColor={color} stopOpacity="0.6" />
            <stop offset="36%" stopColor={color} stopOpacity="0.36" />
            <stop offset="70%" stopColor={color} stopOpacity="0.18" />
            <stop offset="92%" stopColor={color} stopOpacity="0.07" />
            <stop offset="100%" stopColor={color} stopOpacity="0.01" />
          </radialGradient>

          <radialGradient
            id="bf-wash-hind-l"
            ref={(el) => {
              leftRefs.current.hindGrad = el;
            }}
            gradientUnits="userSpaceOnUse"
            cx="0"
            cy="0"
            r="22"
          >
            <stop offset="0%" stopColor={color} stopOpacity="0.5" />
            <stop offset="46%" stopColor={color} stopOpacity="0.25" />
            <stop offset="84%" stopColor={color} stopOpacity="0.09" />
            <stop offset="100%" stopColor={color} stopOpacity="0.01" />
          </radialGradient>

          <radialGradient
            id="bf-wash-fore-r"
            ref={(el) => {
              rightRefs.current.foreGrad = el;
            }}
            gradientUnits="userSpaceOnUse"
            cx="0"
            cy="0"
            r="30"
          >
            <stop offset="0%" stopColor={color} stopOpacity="0.6" />
            <stop offset="36%" stopColor={color} stopOpacity="0.36" />
            <stop offset="70%" stopColor={color} stopOpacity="0.18" />
            <stop offset="92%" stopColor={color} stopOpacity="0.07" />
            <stop offset="100%" stopColor={color} stopOpacity="0.01" />
          </radialGradient>

          <radialGradient
            id="bf-wash-hind-r"
            ref={(el) => {
              rightRefs.current.hindGrad = el;
            }}
            gradientUnits="userSpaceOnUse"
            cx="0"
            cy="0"
            r="22"
          >
            <stop offset="0%" stopColor={color} stopOpacity="0.5" />
            <stop offset="46%" stopColor={color} stopOpacity="0.25" />
            <stop offset="84%" stopColor={color} stopOpacity="0.09" />
            <stop offset="100%" stopColor={color} stopOpacity="0.01" />
          </radialGradient>

          <linearGradient id="bf-body-grad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={color} stopOpacity="0.72" />
            <stop offset="42%" stopColor={color} stopOpacity="0.92" />
            <stop offset="100%" stopColor={color} stopOpacity="0.5" />
          </linearGradient>
        </defs>

        {/* Soft ambient shadow on paper */}
        <g ref={shadowGroupRef} opacity="0.08">
          <ellipse cx="-21" cy="-8" rx="25" ry="20" fill="url(#bf-shadow-grad)" />
          <ellipse cx="21" cy="-8" rx="25" ry="20" fill="url(#bf-shadow-grad)" />
          <ellipse cx="-14" cy="14" rx="17" ry="15" fill="url(#bf-shadow-grad)" />
          <ellipse cx="14" cy="14" rx="17" ry="15" fill="url(#bf-shadow-grad)" />
        </g>

        {/* Native 2D projected vector butterfly rig */}
        <g ref={rigGroupRef} data-testid="butterfly-rig">
          {/* Left Wing */}
          <g
            ref={(el) => {
              leftRefs.current.group = el;
            }}
          >
            <path
              ref={(el) => {
                leftRefs.current.hindWash = el;
              }}
              fill="url(#bf-wash-hind-l)"
            />
            <path
              ref={(el) => {
                leftRefs.current.hindBloom = el;
              }}
              fill={color}
              fillOpacity="0.13"
            />
            <path
              ref={(el) => {
                leftRefs.current.hindContour = el;
              }}
              fill="none"
              stroke={color}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeOpacity="0.78"
            />
            <path
              ref={(el) => {
                leftRefs.current.hindAccent = el;
              }}
              fill="none"
              stroke={color}
              strokeLinecap="round"
              strokeOpacity="0.74"
            />
            <path
              ref={(el) => {
                leftRefs.current.foreWash = el;
              }}
              fill="url(#bf-wash-fore-l)"
            />
            <path
              ref={(el) => {
                leftRefs.current.foreBloom = el;
              }}
              fill={color}
              fillOpacity="0.15"
            />
            <path
              ref={(el) => {
                leftRefs.current.foreDetail = el;
              }}
              fill={color}
              fillOpacity="0.08"
            />
            <path
              ref={(el) => {
                leftRefs.current.foreContour = el;
              }}
              fill="none"
              stroke={color}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeOpacity="0.82"
            />
            <path
              ref={(el) => {
                leftRefs.current.foreAccent = el;
              }}
              fill="none"
              stroke={color}
              strokeLinecap="round"
              strokeOpacity="0.88"
            />
          </g>

          {/* Slender painted body */}
          <g ref={bodyGroupRef}>
            <path ref={bodyPathRef} fill="url(#bf-body-grad)" />
            <circle ref={headCircleRef} fill={color} fillOpacity="0.82" />
          </g>

          {/* Right Wing */}
          <g
            ref={(el) => {
              rightRefs.current.group = el;
            }}
          >
            <path
              ref={(el) => {
                rightRefs.current.hindWash = el;
              }}
              fill="url(#bf-wash-hind-r)"
            />
            <path
              ref={(el) => {
                rightRefs.current.hindBloom = el;
              }}
              fill={color}
              fillOpacity="0.13"
            />
            <path
              ref={(el) => {
                rightRefs.current.hindContour = el;
              }}
              fill="none"
              stroke={color}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeOpacity="0.78"
            />
            <path
              ref={(el) => {
                rightRefs.current.hindAccent = el;
              }}
              fill="none"
              stroke={color}
              strokeLinecap="round"
              strokeOpacity="0.74"
            />
            <path
              ref={(el) => {
                rightRefs.current.foreWash = el;
              }}
              fill="url(#bf-wash-fore-r)"
            />
            <path
              ref={(el) => {
                rightRefs.current.foreBloom = el;
              }}
              fill={color}
              fillOpacity="0.15"
            />
            <path
              ref={(el) => {
                rightRefs.current.foreDetail = el;
              }}
              fill={color}
              fillOpacity="0.08"
            />
            <path
              ref={(el) => {
                rightRefs.current.foreContour = el;
              }}
              fill="none"
              stroke={color}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeOpacity="0.82"
            />
            <path
              ref={(el) => {
                rightRefs.current.foreAccent = el;
              }}
              fill="none"
              stroke={color}
              strokeLinecap="round"
              strokeOpacity="0.88"
            />
          </g>
        </g>
      </svg>
    );
  }
);
