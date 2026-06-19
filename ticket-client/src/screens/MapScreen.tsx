import { useEffect, useRef, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { trpc } from '../lib/trpc'
import { useGpsSource } from '../hooks/useGpsSource'

const BRATISLAVA_LNG_LAT: [number, number] = [17.1077, 48.1486]
const ZOOM = 14
const MAX_HISTORY = 40
const BAR_HEIGHT = 56

const OSM_STYLE = {
    version: 8 as const,
    sources: {
        osm: {
            type: 'raster' as const,
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        },
    },
    layers: [{ id: 'osm', type: 'raster' as const, source: 'osm' }],
}

type MatchedSegment = {
    shapeId: string
    from: { lat: number; lon: number }
    to:   { lat: number; lon: number }
}

type Entry = {
    query: { from: { lat: number; lon: number }; to: { lat: number; lon: number } }
    match: MatchedSegment | null
}

function toLineFeature(from: { lat: number; lon: number }, to: { lat: number; lon: number }, isLatest: boolean) {
    return {
        type: 'Feature' as const,
        properties: { isLatest },
        geometry: { type: 'LineString' as const, coordinates: [[from.lon, from.lat], [to.lon, to.lat]] },
    }
}

function featureCollection(features: ReturnType<typeof toLineFeature>[]) {
    return { type: 'FeatureCollection' as const, features }
}

function bearing(from: { lat: number; lon: number }, to: { lat: number; lon: number }) {
    const deg = Math.atan2(to.lon - from.lon, to.lat - from.lat) * (180 / Math.PI)
    return ((deg % 360) + 360) % 360
}

function fmt(n: number) { return n.toFixed(5) }

export function MapScreen() {
    const [history, setHistory] = useState<Entry[]>([])
    const mapContainer = useRef<HTMLDivElement | null>(null)
    const mapInstance = useRef<any>(null)
    const mapReady = useRef(false)

    useEffect(() => {
        if (!mapContainer.current) return
        let map: any = null

        const initMap = () => {
            if (!mapContainer.current) return
            const ml = (window as any).maplibregl
            map = new ml.Map({
                container: mapContainer.current,
                style: OSM_STYLE,
                center: BRATISLAVA_LNG_LAT,
                zoom: ZOOM,
            })
            map.on('load', () => {
                map.addSource('query', { type: 'geojson', data: featureCollection([]) })
                map.addLayer({
                    id: 'query-lines', type: 'line', source: 'query',
                    paint: {
                        'line-color': '#3b82f6',
                        'line-width': ['case', ['get', 'isLatest'], 5, 2],
                        'line-opacity': ['case', ['get', 'isLatest'], 1, 0.25],
                    },
                })
                map.addSource('match', { type: 'geojson', data: featureCollection([]) })
                map.addLayer({
                    id: 'match-lines', type: 'line', source: 'match',
                    paint: {
                        'line-color': '#f97316',
                        'line-width': ['case', ['get', 'isLatest'], 5, 2],
                        'line-opacity': ['case', ['get', 'isLatest'], 1, 0.25],
                    },
                })
                mapReady.current = true
            })
            mapInstance.current = map
        }

        if ((window as any).maplibregl) {
            initMap()
        } else {
            if (!document.querySelector('link[href*="maplibre-gl"]')) {
                const link = document.createElement('link')
                link.rel = 'stylesheet'
                link.href = 'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css'
                document.head.appendChild(link)
            }
            const script = document.createElement('script')
            script.src = 'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js'
            script.onload = initMap
            document.head.appendChild(script)
        }

        return () => { if (map) { map.remove(); mapReady.current = false } }
    }, [])

    useEffect(() => {
        if (!mapReady.current || history.length === 0) return
        const map = mapInstance.current
        const latest = history[history.length - 1]!

        map.getSource('query').setData(featureCollection(
            history.map((e, i) => toLineFeature(e.query.from, e.query.to, i === history.length - 1))
        ))
        map.getSource('match').setData(featureCollection(
            history.filter(e => e.match).map((e, i, arr) =>
                toLineFeature(e.match!.from, e.match!.to, i === arr.length - 1)
            )
        ))
        map.panTo([latest.query.to.lon, latest.query.to.lat], { duration: 500 })
    }, [history])

    const mutation = trpc.location.match.useMutation({
        onSuccess(data, variables) {
            const entry: Entry = {
                query: variables,
                match: data.matched
                    ? { shapeId: data.shapeId, from: data.from, to: data.to }
                    : null,
            }
            setHistory(prev => [...prev.slice(-(MAX_HISTORY - 1)), entry])
        },
    })

    const { start, stop, isActive } = useGpsSource(
        obs => mutation.mutate({ from: obs.from, to: obs.to }),
        { mode: 'simulated', intervalMs: 1500 },
    )

    const latest = history[history.length - 1] ?? null

    return (
        <View style={s.root}>
            <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
                <div ref={mapContainer} style={{ position: 'absolute', inset: 0 }} />

                <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 1, pointerEvents: 'none' }}>
                    <View style={s.hud}>
                        <Text style={s.hudLabel}>QUERY</Text>
                        {latest ? <>
                            <Text style={s.hudRow}><Text style={s.hudKey}>from  </Text><Text style={s.hudVal}>{fmt(latest.query.from.lat)}, {fmt(latest.query.from.lon)}</Text></Text>
                            <Text style={s.hudRow}><Text style={s.hudKey}>to    </Text><Text style={s.hudVal}>{fmt(latest.query.to.lat)}, {fmt(latest.query.to.lon)}</Text></Text>
                            <Text style={s.hudRow}><Text style={s.hudKey}>hdg   </Text><Text style={s.hudVal}>{bearing(latest.query.from, latest.query.to).toFixed(1)}°</Text></Text>
                        </> : <Text style={s.hudDim}>—</Text>}
                        <View style={s.hudDivider} />
                        <Text style={[s.hudLabel, { color: '#f97316' }]}>MATCH</Text>
                        {latest?.match ? <>
                            <Text style={s.hudRow}><Text style={s.hudKey}>shape </Text><Text style={[s.hudVal, { color: '#f97316' }]}>{latest.match.shapeId}</Text></Text>
                            <Text style={s.hudRow}><Text style={s.hudKey}>from  </Text><Text style={s.hudVal}>{fmt(latest.match.from.lat)}, {fmt(latest.match.from.lon)}</Text></Text>
                            <Text style={s.hudRow}><Text style={s.hudKey}>to    </Text><Text style={s.hudVal}>{fmt(latest.match.to.lat)}, {fmt(latest.match.to.lon)}</Text></Text>
                        </> : <Text style={s.hudDim}>{latest ? 'no match' : '—'}</Text>}
                    </View>
                </div>
            </div>

            <View style={s.bar}>
                <View style={s.legend}>
                    <View style={[s.swatch, { backgroundColor: '#3b82f6' }]} />
                    <Text style={s.legendText}>query vector</Text>
                    <View style={[s.swatch, { backgroundColor: '#f97316', marginLeft: 16 }]} />
                    <Text style={s.legendText}>matched segment</Text>
                </View>
                <TouchableOpacity style={[s.btn, isActive && s.btnStop]} onPress={isActive ? stop : start} activeOpacity={0.8}>
                    <Text style={s.btnText}>{isActive ? 'Stop' : 'Start'}</Text>
                </TouchableOpacity>
            </View>
        </View>
    )
}

const s = StyleSheet.create({
    root:       { flex: 1, backgroundColor: '#0f0f0f', display: 'flex' as any, flexDirection: 'column' },
    hud: {
        backgroundColor: 'rgba(10,10,10,0.85)',
        borderRadius: 8, padding: 12, minWidth: 240,
        borderWidth: 1, borderColor: '#2a2a2a',
    },
    hudDivider:  { height: 1, backgroundColor: '#2a2a2a', marginVertical: 8 },
    hudLabel:    { color: '#3b82f6', fontSize: 10, fontWeight: '700', letterSpacing: 1.2, marginBottom: 4 },
    hudRow:      { fontSize: 11, fontFamily: 'monospace' },
    hudKey:      { color: '#555' },
    hudVal:      { color: '#ccc' },
    hudDim:      { color: '#444', fontSize: 12 },
    bar:        { height: BAR_HEIGHT, backgroundColor: '#111', paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#222' },
    legend:     { flexDirection: 'row', alignItems: 'center' },
    swatch:     { width: 14, height: 4, borderRadius: 2, marginRight: 6 },
    legendText: { color: '#555', fontSize: 12 },
    btn:        { backgroundColor: '#22c55e', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 28 },
    btnStop:    { backgroundColor: '#ef4444' },
    btnText:    { color: '#fff', fontSize: 14, fontWeight: '700' },
})
