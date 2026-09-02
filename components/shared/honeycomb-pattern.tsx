import { cn } from '@/lib/utils'

/**
 * A tiling honeycomb of hexagon outlines, drawn in `currentColor`.
 *
 * Background texture for the landing pages. It exists instead of the
 * usual blurred gradient blob because it is literally the brand
 * (Runbee, bees) and because a geometric lattice suits a platform about
 * machining, PLCs and CAD better than a soft glow does.
 *
 * Tuned to sit *under* the content rather than compete with it. The
 * cells are intentionally large and the stroke is a hairline, so the
 * pattern reads as a quiet texture instead of a wallpaper.
 *
 * Geometry: flat-top hexagons, circumradius R = 46, so the tile is
 * 3R × R√3 = 138 × 79.67 and the five hex centres below wrap seamlessly
 * across tile edges.
 */
export function HoneycombPattern({ className }: { className?: string }) {
  return (
    <svg className={cn('h-full w-full', className)} aria-hidden="true" focusable="false">
      <defs>
        <pattern id="runbee-honeycomb" width="138" height="79.6743" patternUnits="userSpaceOnUse">
          <path
            d="M46,0 L23,39.8372 L-23,39.8372 L-46,0 L-23,-39.8372 L23,-39.8372 Z
               M115,39.8372 L92,79.6743 L46,79.6743 L23,39.8372 L46,0 L92,0 Z
               M184,0 L161,39.8372 L115,39.8372 L92,0 L115,-39.8372 L161,-39.8372 Z
               M46,79.6743 L23,119.5115 L-23,119.5115 L-46,79.6743 L-23,39.8372 L23,39.8372 Z
               M184,79.6743 L161,119.5115 L115,119.5115 L92,79.6743 L115,39.8372 L161,39.8372 Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="0.55"
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#runbee-honeycomb)" />
    </svg>
  )
}
