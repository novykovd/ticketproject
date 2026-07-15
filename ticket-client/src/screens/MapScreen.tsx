import { useState } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Platform } from 'react-native'
import { trpc } from '../lib/trpc'
import { useGpsSource, type GpsMode } from '../hooks/useGpsSource'
import { TrackMap } from '../components/TrackMap'
import type { Entry } from '../components/TrackMap/types'

const MAX_HISTORY = 40
const BAR_HEIGHT = 64

// Fixed Bratislava bounding box (same box as server test:queries). Later this
// should come from TrackMap's visible bounds instead of being hard-coded.
const BRATISLAVA_BBOX = { minLat: 48.05, maxLat: 48.25, minLon: 16.95, maxLon: 17.25 }

const TYPE_GLYPH: Record<string, string> = {
    ticket_inspector: '🎫',
    crowding: '👥',
}

function bearing(from: { lat: number; lon: number }, to: { lat: number; lon: number }) {
    const deg = Math.atan2(to.lon - from.lon, to.lat - from.lat) * (180 / Math.PI)
    return ((deg % 360) + 360) % 360
}

function fmt(n: number) { return n.toFixed(5) }

function minsAgo(when: string | Date) {
    const m = Math.round((Date.now() - new Date(when).getTime()) / 60000)
    return m < 1 ? 'now' : `${m}m`
}

const MODES: { key: GpsMode; label: string }[] = [
    { key: 'stops',     label: 'Stops'  },
    { key: 'simulated', label: 'Walk'   },
    { key: 'device',    label: 'Record' },
]

const IOS_TOP = Platform.OS === 'ios' ? 60 : 12

export function MapScreen() {
    const [history, setHistory] = useState<Entry[]>([])
    const [activeMode, setActiveMode] = useState<GpsMode | null>(null)
    const [showReports, setShowReports] = useState(false)

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

    // Live viewport reports — only fetches while the Reports panel is open,
    // then polls so the panel keeps up with new reports.
    const reportsQuery = trpc.reports.byViewport.useQuery(BRATISLAVA_BBOX, {
        enabled: showReports,
        refetchInterval: showReports ? 8000 : false,
    })

    useGpsSource(
        obs => mutation.mutate({ from: obs.from, to: obs.to }),
        { mode: activeMode, intervalMs: 1500 },
    )

    function handleMode(mode: GpsMode) {
        setActiveMode(prev => prev === mode ? null : mode)
    }

    const latest = history[history.length - 1] ?? null
    const reports = reportsQuery.data ?? []

    return (
        <View style={s.root}>
            <View style={s.mapArea}>
                <TrackMap history={history} reports={showReports ? reports : []} />

                {showReports && (
                    <View style={[s.reportsContainer, { top: IOS_TOP }]}>
                        <View style={s.reportsPanel}>
                            <Text style={s.reportsLabel}>REPORTS ({reports.length})</Text>
                            {reportsQuery.isLoading ? (
                                <Text style={s.hudDim}>loading…</Text>
                            ) : reports.length === 0 ? (
                                <Text style={s.hudDim}>none in view</Text>
                            ) : (
                                <ScrollView style={s.reportsList}>
                                    {reports.map(r => (
                                        <View key={r.id} style={s.reportRow}>
                                            <Text style={s.reportGlyph}>{TYPE_GLYPH[r.type] ?? '•'}</Text>
                                            <Text style={s.reportName} numberOfLines={1}>
                                                {r.stopName ?? 'unmatched'}
                                            </Text>
                                            <Text style={s.reportTime}>{minsAgo(r.createdAt)}</Text>
                                        </View>
                                    ))}
                                </ScrollView>
                            )}
                        </View>
                    </View>
                )}

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
                <TouchableOpacity
                    style={[s.modeBtn, showReports && s.reportsBtnActive]}
                    onPress={() => setShowReports(v => !v)}
                    activeOpacity={0.7}
                >
                    <Text style={[s.modeBtnText, showReports && s.reportsBtnTextActive]}>
                        {showReports ? '■ Reports' : 'Reports'}
                    </Text>
                </TouchableOpacity>
            </View>
        </View>
    )
}

const s = StyleSheet.create({
    root:              { flex: 1, backgroundColor: '#0f0f0f', flexDirection: 'column' },
    mapArea:           { flex: 1, position: 'relative' },
    hudContainer:      { position: 'absolute', right: 12, zIndex: 1 },
    hud: {
        backgroundColor: 'rgba(10,10,10,0.85)',
        borderRadius: 8, padding: 12, minWidth: 240,
        borderWidth: 1, borderColor: '#2a2a2a',
    },
    hudDivider:        { height: 1, backgroundColor: '#2a2a2a', marginVertical: 8 },
    hudLabel:          { color: '#3b82f6', fontSize: 10, fontWeight: '700', letterSpacing: 1.2, marginBottom: 4 },
    hudRow:            { fontSize: 11, fontFamily: 'monospace' },
    hudKey:            { color: '#555' },
    hudVal:            { color: '#ccc' },
    hudDim:            { color: '#444', fontSize: 12 },
    reportsContainer:  { position: 'absolute', left: 12, zIndex: 1 },
    reportsPanel: {
        backgroundColor: 'rgba(10,10,10,0.85)',
        borderRadius: 8, padding: 12, width: 220, maxHeight: 260,
        borderWidth: 1, borderColor: '#2a2a2a',
    },
    reportsLabel:      { color: '#10b981', fontSize: 10, fontWeight: '700', letterSpacing: 1.2, marginBottom: 6 },
    reportsList:       { maxHeight: 210 },
    reportRow:         { flexDirection: 'row', alignItems: 'center', paddingVertical: 3, gap: 6 },
    reportGlyph:       { fontSize: 12, width: 16 },
    reportName:        { color: '#ccc', fontSize: 11, flex: 1 },
    reportTime:        { color: '#666', fontSize: 10, fontFamily: 'monospace' },
    bar:               { height: BAR_HEIGHT, backgroundColor: '#111', paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#222', gap: 8 },
    modeBtn:           { flex: 1, borderRadius: 8, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: '#2a2a2a', backgroundColor: '#1a1a1a' },
    modeBtnActive:     { backgroundColor: '#1d3a5e', borderColor: '#3b82f6' },
    modeBtnText:       { color: '#555', fontSize: 13, fontWeight: '600' },
    modeBtnTextActive: { color: '#3b82f6' },
    reportsBtnActive:     { backgroundColor: '#14361f', borderColor: '#10b981' },
    reportsBtnTextActive: { color: '#10b981' },
})
