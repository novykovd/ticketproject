import { createCanvas } from 'canvas'
import { Viewport } from './viewport.js'
import fs from 'fs'

const SIZE = 700
const PAD = 0.2  // 20% padding so arrows near the edge aren't clipped

function boundsFromSegments(segs) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const s of segs) {
        minX = Math.min(minX, s.minX, s.maxX)
        minY = Math.min(minY, s.minY, s.maxY)
        maxX = Math.max(maxX, s.minX, s.maxX)
        maxY = Math.max(maxY, s.minY, s.maxY)
    }
    const dx = Math.max(maxX - minX, 1e-6)
    const dy = Math.max(maxY - minY, 1e-6)
    return { minX: minX - dx * PAD, minY: minY - dy * PAD, maxX: maxX + dx * PAD, maxY: maxY + dy * PAD }
}

function arrow(ctx, viewport, seg, color, lineWidth, label) {
    const p = viewport.project(seg.minX, seg.minY, seg.maxX, seg.maxY)
    const x1 = p.x,       y1 = p.y
    const x2 = p.x + p.w, y2 = p.y - p.h  // -h because viewport flips Y

    ctx.strokeStyle = color
    ctx.lineWidth = lineWidth
    ctx.beginPath()
    ctx.moveTo(x1, y1)
    ctx.lineTo(x2, y2)
    ctx.stroke()

    // arrowhead
    const angle = Math.atan2(y2 - y1, x2 - x1)
    const head = 10
    ctx.beginPath()
    ctx.moveTo(x2, y2)
    ctx.lineTo(x2 - head * Math.cos(angle - Math.PI / 6), y2 - head * Math.sin(angle - Math.PI / 6))
    ctx.moveTo(x2, y2)
    ctx.lineTo(x2 - head * Math.cos(angle + Math.PI / 6), y2 - head * Math.sin(angle + Math.PI / 6))
    ctx.stroke()

    // dot at origin
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.arc(x1, y1, 3, 0, Math.PI * 2)
    ctx.fill()

    if (label) {
        ctx.fillStyle = color
        ctx.font = '11px monospace'
        // offset label from arrowhead so it doesn't sit on the line
        const ox = Math.cos(angle + Math.PI / 2) * 8
        const oy = Math.sin(angle + Math.PI / 2) * 8
        ctx.fillText(label, x2 + ox, y2 + oy)
    }
}

/**
 * Renders a single matcher failure case to a PNG.
 *
 * @param {{ query, expected, candidates: {segment, score}[] }} failureCase
 * @param {string} outputPath
 */
export function renderFailureCase({ query, expected, candidates }, outputPath) {
    const allSegs = [query, expected, ...candidates.map(c => c.segment)]
    const bounds = boundsFromSegments(allSegs)

    const canvas = createCanvas(SIZE, SIZE)
    const ctx = canvas.getContext('2d')
    const viewport = new Viewport(bounds, SIZE, SIZE)

    ctx.fillStyle = '#0f0f0f'
    ctx.fillRect(0, 0, SIZE, SIZE)

    // candidates back-to-front: dimmest first, winner last so it's on top
    const reversed = [...candidates].reverse()
    reversed.forEach(({ segment, score }, revIdx) => {
        const rank = candidates.length - revIdx  // 1 = winner
        const isWinner = rank === 1
        const alpha = isWinner ? 1 : Math.max(0.2, 0.85 - revIdx * 0.08)
        const color = isWinner
            ? `rgba(249,115,22,${alpha})`   // orange — wrong winner
            : `rgba(59,130,246,${alpha})`   // blue — other candidates
        const lw = isWinner ? 2.5 : 1.2
        arrow(ctx, viewport, segment, color, lw, `#${rank} ${score.toFixed(4)}`)
    })

    // correct answer in green, on top of candidates
    arrow(ctx, viewport, expected, '#22c55e', 3, `✓ ${expected.shapeId}`)

    // query vector in white, drawn last so it's never obscured
    arrow(ctx, viewport, query, '#ffffff', 4, 'query')

    // legend
    ctx.fillStyle = '#555'
    ctx.font = '10px monospace'
    ctx.fillText('white=query  green=expected  orange=#1(wrong)  blue=other', 8, SIZE - 10)

    fs.mkdirSync('debug-output', { recursive: true })
    fs.writeFileSync(outputPath, canvas.toBuffer('image/png'))
}
