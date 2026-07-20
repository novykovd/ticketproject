import { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native'
import { trpc } from '../lib/trpc'
import { useGpsSource, type GpsMode } from '../hooks/useGpsSource'
import { useReportCapture } from '../hooks/useReportCapture'
import { TrackMap } from '../components/TrackMap'
import type { Entry } from '../components/TrackMap/types'

// The match-visualizer: feeds synthetic/real GPS through location.match and
// shows the query vs matched segment. Lives inside the Dev surface.
const MAX_HISTORY = 40
const BAR_HEIGHT = 64
const IOS_TOP = Platform.OS === 'ios' ? 16 : 12

const MODES: { key: GpsMode; label: string }[] = [
    { key: 'stops',     label: 'Stops'  },
    { key: 'simulated', label: 'Walk'   },
    { key: 'device',    label: 'Record' },
]

function bearing(from: { lat: number; lon: number }, to: { lat: number; lon: number }) {
    const deg = Math.atan2(to.lon - from.lon, to.lat - from.lat) * (180 / Math.PI)
    return ((deg % 360) + 360) % 360
}
function fmt(n: number) { return n.toFixed(5) }

export function MatchScreen() {
    const [history, setHistory] = useState<Entry[]>([])
    const [activeMode, setActiveMode] = useState<GpsMode | null>(null)
    const [lastCapture, setLastCapture] = useState<string | null>(null)
    // Held in state (not just a ref) so the last track is inspectable on the
    // component instance via React DevTools, not only in the console.
    const [lastSamples, setLastSamples] = useState<{ lat: number; lon: number }[] | null>(null)
    const utils = trpc.useUtils()

    const capture = useReportCapture((samples, arrived) => {
        console.log('[dev report capture]', { count: samples.length, arrived, samples })
        setLastSamples(samples.map(p => ({ lat: p.lat, lon: p.lon })))
        setLastCapture(`${samples.length} samples${arrived ? ' · arrived' : ''}`)
    })

    // Pull a canned noisy track from the server (develop from a desk, no moving).
    async function grabSample() {
        const res = await utils.dev.sampleTrack.fetch({ steps: 6 })
        console.log('[dev sample track]', res)
        setLastSamples(res.points)
        setLastCapture(`${res.points.length} canned · ${res.shapeId ?? '?'}`)
    }

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

    useGpsSource(
        obs => mutation.mutate({ from: obs.from, to: obs.to }),
        { mode: activeMode, intervalMs: 1500 },
    )

    function handleMode(mode: GpsMode) {
        setActiveMode(prev => prev === mode ? null : mode)
    }

    const latest = history[history.length - 1] ?? null

    return (
        <View style={s.root}>
            <View style={s.mapArea}>
                <TrackMap history={history} reports={[]} />

                <View style={[s.reportBox, { top: IOS_TOP }]}>
                    {capture.capturing ? <>
                        <View style={s.repProcessing}><Text style={s.repProcessingText}>🔧 processing…</Text></View>
                        <TouchableOpacity style={s.repArrived} onPress={capture.markArrived} activeOpacity={0.7}>
                            <Text style={s.repArrivedText}>✅ arrived</Text>
                        </TouchableOpacity>
                    </> : <>
                        <TouchableOpacity style={s.repBtn} onPress={capture.start} activeOpacity={0.8}>
                            <Text style={s.repBtnText}>🎫 Report</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={s.sampleBtn} onPress={grabSample} activeOpacity={0.8}>
                            <Text style={s.sampleBtnText}>🧪 Sample</Text>
                        </TouchableOpacity>
                    </>}
                    {lastCapture && <Text style={s.repLast}>last: {lastCapture}</Text>}
                </View>

                <View style={[s.hudContainer, { top: IOS_TOP }]} pointerEvents="none">
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
                </View>
            </View>

            <View style={s.bar}>
                {MODES.map(({ key, label }) => {
                    const active = activeMode === key
                    return (
                        <TouchableOpacity
                            key={key}
                            style={[s.modeBtn, active && s.modeBtnActive]}
                            onPress={() => handleMode(key)}
                            activeOpacity={0.7}
                        >
                            <Text style={[s.modeBtnText, active && s.modeBtnTextActive]}>
                                {active ? `■ ${label}` : label}
                            </Text>
                        </TouchableOpacity>
                    )
                })}
            </View>
        </View>
    )
}

const s = StyleSheet.create({
    root:              { flex: 1, backgroundColor: '#0f0f0f', flexDirection: 'column' },
    mapArea:           { flex: 1, position: 'relative' },
    hudContainer:      { position: 'absolute', right: 12, zIndex: 1 },
    hud:               { backgroundColor: 'rgba(10,10,10,0.85)', borderRadius: 8, padding: 12, minWidth: 240, borderWidth: 1, borderColor: '#2a2a2a' },
    hudDivider:        { height: 1, backgroundColor: '#2a2a2a', marginVertical: 8 },
    hudLabel:          { color: '#3b82f6', fontSize: 10, fontWeight: '700', letterSpacing: 1.2, marginBottom: 4 },
    hudRow:            { fontSize: 11, fontFamily: 'monospace' },
    hudKey:            { color: '#555' },
    hudVal:            { color: '#ccc' },
    hudDim:            { color: '#444', fontSize: 12 },
    reportBox:         { position: 'absolute', left: 12, zIndex: 1, gap: 6, alignItems: 'flex-start' },
    repBtn:            { backgroundColor: '#dc2626', borderRadius: 20, paddingVertical: 8, paddingHorizontal: 14 },
    repBtnText:        { color: '#fff', fontSize: 13, fontWeight: '700' },
    repProcessing:     { backgroundColor: 'rgba(80,80,80,0.5)', borderRadius: 20, paddingVertical: 8, paddingHorizontal: 14, borderWidth: 1, borderColor: '#3a3a3a' },
    repProcessingText: { color: '#ccc', fontSize: 13, fontWeight: '700' },
    repArrived:        { backgroundColor: 'rgba(16,185,129,0.12)', borderColor: 'rgba(16,185,129,0.5)', borderWidth: 1, borderRadius: 18, paddingVertical: 7, paddingHorizontal: 14 },
    repArrivedText:    { color: 'rgba(16,185,129,0.85)', fontSize: 12, fontWeight: '600' },
    sampleBtn:         { backgroundColor: '#1a1a1a', borderRadius: 20, paddingVertical: 8, paddingHorizontal: 14, borderWidth: 1, borderColor: '#2a2a2a' },
    sampleBtnText:     { color: '#a78bfa', fontSize: 13, fontWeight: '700' },
    repLast:           { color: '#666', fontSize: 11, fontFamily: 'monospace' },
    bar:               { height: BAR_HEIGHT, backgroundColor: '#111', paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#222', gap: 8 },
    modeBtn:           { flex: 1, borderRadius: 8, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: '#2a2a2a', backgroundColor: '#1a1a1a' },
    modeBtnActive:     { backgroundColor: '#1d3a5e', borderColor: '#3b82f6' },
    modeBtnText:       { color: '#555', fontSize: 13, fontWeight: '600' },
    modeBtnTextActive: { color: '#3b82f6' },
})
