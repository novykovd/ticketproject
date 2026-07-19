import { useEffect, useRef, useState } from 'react'
import type { TrackMapProps, Entry } from './types'

const BRATISLAVA_LNG_LAT: [number, number] = [17.1077, 48.1486]
const ZOOM = 14
const PITCH = 50   // angular tilt for a 3D-ish look

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

function toLineFeature(from: { lat: number; lon: number }, to: { lat: number; lon: number }, isLatest: boolean) {
    return {
        type: 'Feature' as const,
        properties: { isLatest },
        geometry: { type: 'LineString' as const, coordinates: [[from.lon, from.lat], [to.lon, to.lat]] },
    }
}

function toPointFeature(report: { id: number; type: string; lat: number; lon: number }) {
    return {
        type: 'Feature' as const,
        properties: { type: report.type },
        geometry: { type: 'Point' as const, coordinates: [report.lon, report.lat] },
    }
}

function featureCollection(features: any[]) {
    return { type: 'FeatureCollection' as const, features }
}

export function TrackMap({ history, reports = [] }: TrackMapProps) {
    const mapContainer = useRef<HTMLDivElement | null>(null)
    const mapInstance = useRef<any>(null)
    // State (not a ref) so that becoming ready re-runs the data effects below and
    // applies any reports that arrived before the map finished loading.
    const [mapReady, setMapReady] = useState(false)

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
                pitch: PITCH,
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
                map.addSource('reports', { type: 'geojson', data: featureCollection([]) })
                map.addLayer({
                    id: 'report-pins', type: 'circle', source: 'reports',
                    paint: {
                        'circle-radius': 6,
                        'circle-color': ['match', ['get', 'type'],
                            'ticket_inspector', '#ef4444',
                            'crowding', '#eab308',
                            '#9ca3af'],
                        'circle-stroke-width': 2,
                        'circle-stroke-color': '#0a0a0a',
                    },
                })
                setMapReady(true)
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

        return () => { if (map) { map.remove(); setMapReady(false) } }
    }, [])

    useEffect(() => {
        if (!mapReady || history.length === 0) return
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

        const ml = (window as any).maplibregl
        const allCoords: [number, number][] = history.flatMap(e => [
            [e.query.from.lon, e.query.from.lat],
            [e.query.to.lon,   e.query.to.lat],
        ])
        const bounds = allCoords.reduce(
            (b, c) => b.extend(c),
            new ml.LngLatBounds(allCoords[0]!, allCoords[0]!)
        )
        map.fitBounds(bounds, { padding: 60, maxZoom: 16, duration: 500, pitch: PITCH })
    }, [history, mapReady])

    useEffect(() => {
        if (!mapReady) return
        const source = mapInstance.current?.getSource('reports')
        if (source) source.setData(featureCollection(reports.map(toPointFeature)))
    }, [reports, mapReady])

    return <div ref={mapContainer} style={{ position: 'absolute', inset: 0 }} />
}
