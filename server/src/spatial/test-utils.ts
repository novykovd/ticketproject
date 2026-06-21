import type { GpsSegment } from './matcher.js'

export function applyGpsNoise(perfectVector: {x: number, y: number}, maxAngle: number) {
    const randomAngleDeg = (Math.random() * maxAngle * 2) - maxAngle;
    const radians = randomAngleDeg * (Math.PI / 180);

    return {
        x: perfectVector.x * Math.cos(radians) - perfectVector.y * Math.sin(radians),
        y: perfectVector.x * Math.sin(radians) + perfectVector.y * Math.cos(radians)
    };
}

// Box-Muller: uniform → Gaussian
function gaussian(sigma: number): number {
    const u1 = Math.random()
    const u2 = Math.random()
    return sigma * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
}

// Interpolate `steps+1` evenly-spaced points along a segment, each perturbed by
// Gaussian position noise with std dev `sigmaDeg` (degrees, ~0.0001° ≈ 10m).
// Returns `steps` consecutive direction vectors — the observable GPS readings.
export function interpolateWithNoise(seg: GpsSegment, steps: number, sigmaDeg = 0.0001): GpsSegment[] {
    const points: Array<{ x: number; y: number }> = []
    for (let i = 0; i <= steps; i++) {
        const t = i / steps
        points.push({
            x: seg.minX + t * (seg.maxX - seg.minX) + gaussian(sigmaDeg),
            y: seg.minY + t * (seg.maxY - seg.minY) + gaussian(sigmaDeg),
        })
    }
    const vectors: GpsSegment[] = []
    for (let i = 0; i < steps; i++) {
        vectors.push({ minX: points[i].x, minY: points[i].y, maxX: points[i+1].x, maxY: points[i+1].y })
    }
    return vectors
}