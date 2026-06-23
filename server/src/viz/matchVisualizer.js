import { createCanvas } from 'canvas'
import { Viewport } from './viewport.js'
import fs from 'fs'

const MAP_SIZE   = 700
const SIDEBAR    = 320
const TOTAL_W    = MAP_SIZE + SIDEBAR
const PAD        = 0.2

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
    const p  = viewport.project(seg.minX, seg.minY, seg.maxX, seg.maxY)
    const x1 = p.x, y1 = p.y
    const x2 = p.x + p.w, y2 = p.y - p.h

    ctx.strokeStyle = color
    ctx.lineWidth   = lineWidth
    ctx.beginPath()
    ctx.moveTo(x1, y1)
    ctx.lineTo(x2, y2)
    ctx.stroke()

    const angle = Math.atan2(y2 - y1, x2 - x1)
    const head  = 10
    ctx.beginPath()
    ctx.moveTo(x2, y2)
    ctx.lineTo(x2 - head * Math.cos(angle - Math.PI / 6), y2 - head * Math.sin(angle - Math.PI / 6))
    ctx.moveTo(x2, y2)
    ctx.lineTo(x2 - head * Math.cos(angle + Math.PI / 6), y2 - head * Math.sin(angle + Math.PI / 6))
    ctx.stroke()

    ctx.fillStyle = color
    ctx.beginPath()
    ctx.arc(x1, y1, 3, 0, Math.PI * 2)
    ctx.fill()

    if (label) {
        ctx.fillStyle = color
        ctx.font = '11px monospace'
        const ox = Math.cos(angle + Math.PI / 2) * 8
        const oy = Math.sin(angle + Math.PI / 2) * 8
        ctx.fillText(label, x2 + ox, y2 + oy)
    }
}

function coord(n) { return n.toFixed(6) }

function drawSidebar(ctx, { query, expected, candidates }) {
    const x0  = MAP_SIZE + 12
    const LH  = 15   // line height
    let   y   = 20

    function header(text) {
        ctx.font      = 'bold 11px monospace'
        ctx.fillStyle = '#888'
        ctx.fillText(text, x0, y)
        y += LH + 2
    }

    function line(text, color = '#bbb') {
        ctx.font      = '10px monospace'
        ctx.fillStyle = color
        ctx.fillText(text, x0, y)
        y += LH
    }

    function dot(color, text) {
        ctx.fillStyle = color
        ctx.beginPath()
        ctx.arc(x0 + 5, y - 3, 4, 0, Math.PI * 2)
        ctx.fill()
        ctx.font      = '10px monospace'
        ctx.fillStyle = '#bbb'
        ctx.fillText(text, x0 + 14, y)
        y += LH
    }

    function gap() { y += 6 }

    function segLines(seg) {
        line(`  from ${coord(seg.minX)}, ${coord(seg.minY)}`)
        line(`  to   ${coord(seg.maxX)}, ${coord(seg.maxY)}`)
    }

    // ── LEGEND ──────────────────────────────────
    header('LEGEND')
    dot('#ffffff', 'QUERY  — observed GPS vector')
    dot('#22c55e', 'EXPECTED — correct segment')
    dot('rgba(249,115,22,1)', 'WINNER — top-ranked (wrong)')
    dot('rgba(59,130,246,0.8)', 'CANDIDATES — lower ranked')
    gap()

    // ── QUERY ───────────────────────────────────
    header('QUERY')
    segLines(query)
    gap()

    // ── EXPECTED ────────────────────────────────
    header('EXPECTED (correct answer)')
    line(`  shape ${expected.shapeId}`, '#22c55e')
    segLines(expected)
    gap()

    // ── CANDIDATES ──────────────────────────────
    header(`CANDIDATES (${candidates.length} total, k=${candidates.length})`)
    candidates.forEach(({ segment, score }, i) => {
        const rank     = i + 1
        const isWinner = i === 0
        const isExpect = segment === expected || segment?.shapeId === expected?.shapeId
        const roleTag  = isExpect ? ' ✓EXPECTED' : isWinner ? ' ←WINNER' : ''
        const color    = isExpect ? '#22c55e' : isWinner ? 'rgba(249,115,22,1)' : '#6b9fd4'

        line(`#${rank}  score ${score.toFixed(6)}${roleTag}`, color)
        line(`  shape ${segment?.shapeId ?? '?'}`, color)
        segLines(segment)
        y += 3
    })
}

function drawInterpolationSidebar(ctx, { trueSeg, vectorResults, majorityWinner }) {
    const x0 = MAP_SIZE + 12
    const LH  = 15
    let   y   = 20

    function header(text) {
        ctx.font      = 'bold 11px monospace'
        ctx.fillStyle = '#888'
        ctx.fillText(text, x0, y)
        y += LH + 2
    }

    function line(text, color = '#bbb') {
        ctx.font      = '10px monospace'
        ctx.fillStyle = color
        ctx.fillText(text, x0, y)
        y += LH
    }

    function gap() { y += 6 }

    header('LEGEND')
    line('●  noisy GPS positions',         '#facc15')
    line('→  vector: correct match',       '#22c55e')
    line('→  vector: wrong match',         'rgba(249,115,22,1)')
    line('—  ideal segment (faint white)', 'rgba(255,255,255,0.5)')
    gap()

    header('IDEAL SEGMENT')
    if (trueSeg?.shapeId) line(`  shape ${trueSeg.shapeId}`)
    line(`  from ${coord(trueSeg.minX)}, ${coord(trueSeg.minY)}`)
    line(`  to   ${coord(trueSeg.maxX)}, ${coord(trueSeg.maxY)}`)
    gap()

    const voteCorrect = majorityWinner === trueSeg
    header('MAJORITY WINNER')
    line(
        `  shape ${majorityWinner?.shapeId ?? '?'}  ${voteCorrect ? '✓ CORRECT' : '✗ WRONG'}`,
        voteCorrect ? '#22c55e' : 'rgba(249,115,22,1)',
    )
    gap()

    header(`VECTORS (N=${vectorResults.length})`)
    vectorResults.forEach(({ matched }, i) => {
        const ok = matched === trueSeg
        line(`  v${i + 1}: ${matched?.shapeId ?? '?'}  ${ok ? '✓' : '✗'}`, ok ? '#22c55e' : 'rgba(249,115,22,1)')
    })
}

export function renderInterpolationCase({ trueSeg, vectorResults, majorityWinner }, outputPath) {
    // Reconstruct the N+1 noisy position samples from the N direction vectors
    const points = []
    if (vectorResults.length > 0) {
        points.push({ x: vectorResults[0].vector.minX, y: vectorResults[0].vector.minY })
        for (const { vector } of vectorResults) {
            points.push({ x: vector.maxX, y: vector.maxY })
        }
    }

    const allSegs = [
        trueSeg,
        ...vectorResults.map(r => r.vector),
        ...vectorResults.map(r => r.matched).filter(Boolean),
    ]
    const bounds  = boundsFromSegments(allSegs)

    const canvas   = createCanvas(TOTAL_W, MAP_SIZE)
    const ctx      = canvas.getContext('2d')
    const viewport = new Viewport(bounds, MAP_SIZE, MAP_SIZE)

    // map background
    ctx.fillStyle = '#0f0f0f'
    ctx.fillRect(0, 0, MAP_SIZE, MAP_SIZE)

    // sidebar background
    ctx.fillStyle = '#111'
    ctx.fillRect(MAP_SIZE, 0, SIDEBAR, MAP_SIZE)
    ctx.strokeStyle = '#2a2a2a'
    ctx.lineWidth   = 1
    ctx.beginPath()
    ctx.moveTo(MAP_SIZE, 0)
    ctx.lineTo(MAP_SIZE, MAP_SIZE)
    ctx.stroke()

    // ideal segment — faint white reference line
    arrow(ctx, viewport, trueSeg, 'rgba(255,255,255,0.35)', 1.5, 'ideal')

    // wrong-matched segments (faint orange) so you can see what the matcher picked
    for (const { matched } of vectorResults) {
        if (matched && matched !== trueSeg) {
            arrow(ctx, viewport, matched, 'rgba(249,115,22,0.25)', 1, null)
        }
    }

    // direction vectors — green=correct, orange=wrong
    vectorResults.forEach(({ vector, matched }, i) => {
        const ok    = matched === trueSeg
        const color = ok ? '#22c55e' : 'rgba(249,115,22,1)'
        arrow(ctx, viewport, vector, color, 2, `v${i + 1}`)
    })

    // noisy position dots (yellow)
    for (const pt of points) {
        const p = viewport.project(pt.x, pt.y, pt.x, pt.y)
        ctx.fillStyle = '#facc15'
        ctx.beginPath()
        ctx.arc(p.x, p.y, 4, 0, Math.PI * 2)
        ctx.fill()
    }

    drawInterpolationSidebar(ctx, { trueSeg, vectorResults, majorityWinner })

    fs.mkdirSync('debug-output', { recursive: true })
    fs.writeFileSync(outputPath, canvas.toBuffer('image/png'))
}

export function renderFailureCase({ query, expected, candidates }, outputPath) {
    const allSegs = [query, expected, ...candidates.map(c => c.segment)]
    const bounds  = boundsFromSegments(allSegs)

    const canvas   = createCanvas(TOTAL_W, MAP_SIZE)
    const ctx      = canvas.getContext('2d')
    const viewport = new Viewport(bounds, MAP_SIZE, MAP_SIZE)

    // map background
    ctx.fillStyle = '#0f0f0f'
    ctx.fillRect(0, 0, MAP_SIZE, MAP_SIZE)

    // sidebar background
    ctx.fillStyle = '#111'
    ctx.fillRect(MAP_SIZE, 0, SIDEBAR, MAP_SIZE)
    ctx.strokeStyle = '#2a2a2a'
    ctx.lineWidth   = 1
    ctx.beginPath()
    ctx.moveTo(MAP_SIZE, 0)
    ctx.lineTo(MAP_SIZE, MAP_SIZE)
    ctx.stroke()

    // candidates back-to-front
    ;[...candidates].reverse().forEach(({ segment, score }, revIdx) => {
        const rank     = candidates.length - revIdx
        const isWinner = rank === 1
        const alpha    = isWinner ? 1 : Math.max(0.2, 0.85 - revIdx * 0.08)
        const color    = isWinner ? `rgba(249,115,22,${alpha})` : `rgba(59,130,246,${alpha})`
        arrow(ctx, viewport, segment, color, isWinner ? 2.5 : 1.2, `#${rank} ${score.toFixed(4)}`)
    })

    arrow(ctx, viewport, expected, '#22c55e', 3, `✓ ${expected.shapeId}`)
    arrow(ctx, viewport, query,    '#ffffff', 4, 'query')

    drawSidebar(ctx, { query, expected, candidates })

    fs.mkdirSync('debug-output', { recursive: true })
    fs.writeFileSync(outputPath, canvas.toBuffer('image/png'))
}
