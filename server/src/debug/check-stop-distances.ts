import fs from 'fs'

const GTFS = 'C:/Users/david/Documents/GTFS_latest'

function parseCSV(path: string) {
    const lines = fs.readFileSync(path, 'utf8').trim().split('\n')
    const headers = lines[0]!.split(',')
    return lines.slice(1).map(line => {
        const vals = line.split(',')
        return Object.fromEntries(headers.map((h, i) => [h.trim(), vals[i]?.trim() ?? '']))
    })
}

function distanceMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
    const dLat = (lat2 - lat1) * 111320
    const dLon = (lon2 - lon1) * 74500  // cos(48°) * 111320
    return Math.sqrt(dLat * dLat + dLon * dLon)
}

const stopRows = parseCSV(`${GTFS}/stops.txt`)
const shapeRows = parseCSV(`${GTFS}/shapes.txt`)

const stops = stopRows.map(r => ({
    id: r['stop_id']!,
    name: r['stop_name']!,
    lat: parseFloat(r['stop_lat']!),
    lon: parseFloat(r['stop_lon']!),
})).filter(s => !isNaN(s.lat))

const shapePoints = shapeRows.map(r => ({
    lat: parseFloat(r['shape_pt_lat']!),
    lon: parseFloat(r['shape_pt_lon']!),
})).filter(p => !isNaN(p.lat))

console.log(`stops: ${stops.length}, shape points: ${shapePoints.length}`)

// For each stop, find nearest shape point
const distances = stops.map(stop => {
    let minDist = Infinity
    for (const pt of shapePoints) {
        const d = distanceMeters(stop.lat, stop.lon, pt.lat, pt.lon)
        if (d < minDist) minDist = d
    }
    return { stop: stop.name, dist: minDist }
})

distances.sort((a, b) => a.dist - b.dist)

const within = (m: number) => distances.filter(d => d.dist <= m).length
console.log(`\nstops within 5m of a shape point:   ${within(5)} / ${stops.length}`)
console.log(`stops within 10m of a shape point:  ${within(10)} / ${stops.length}`)
console.log(`stops within 20m of a shape point:  ${within(20)} / ${stops.length}`)
console.log(`stops within 50m of a shape point:  ${within(50)} / ${stops.length}`)
console.log(`stops within 100m of a shape point: ${within(100)} / ${stops.length}`)

console.log(`\nfurthest stops from any shape point:`)
distances.slice(-10).reverse().forEach(d => {
    console.log(`  ${d.dist.toFixed(1)}m — ${d.stop}`)
})
