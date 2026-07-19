import { useState } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Platform } from 'react-native'
import { trpc } from '../lib/trpc'
import { TrackMap } from '../components/TrackMap'

const BAR_HEIGHT = 64

// Fixed Bratislava bounding box for now. Later this should come from TrackMap's
// visible bounds instead of being hard-coded.
const BRATISLAVA_BBOX = { minLat: 48.05, maxLat: 48.25, minLon: 16.95, maxLon: 17.25 }

const TYPE_GLYPH: Record<string, string> = {
    ticket_inspector: '🎫',
    crowding: '👥',
}

const IOS_TOP = Platform.OS === 'ios' ? 60 : 12

function minsAgo(when: string | Date) {
    const m = Math.round((Date.now() - new Date(when).getTime()) / 60000)
    return m < 1 ? 'now' : `${m}m`
}

// The user map: recent reports as pins, always live-polling. The list panel is
// toggle-able so it doesn't cover the map when you don't need it.
export function MapScreen() {
    const [showList, setShowList] = useState(false)

    const reportsQuery = trpc.reports.byViewport.useQuery(BRATISLAVA_BBOX, {
        refetchInterval: 8000,
    })
    const reports = reportsQuery.data ?? []

    return (
        <View style={s.root}>
            <View style={s.mapArea}>
                <TrackMap history={[]} reports={reports} />

                {showList && (
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
            </View>

            <View style={s.bar}>
                <TouchableOpacity
                    style={[s.barBtn, showList && s.barBtnActive]}
                    onPress={() => setShowList(v => !v)}
                    activeOpacity={0.7}
                >
                    <Text style={[s.barBtnText, showList && s.barBtnTextActive]}>
                        {showList ? '■ Reports' : `Reports (${reports.length})`}
                    </Text>
                </TouchableOpacity>
            </View>
        </View>
    )
}

const s = StyleSheet.create({
    root:              { flex: 1, backgroundColor: '#0f0f0f', flexDirection: 'column' },
    mapArea:           { flex: 1, position: 'relative' },
    hudDim:            { color: '#444', fontSize: 12 },
    reportsContainer:  { position: 'absolute', left: 12, zIndex: 1 },
    reportsPanel:      { backgroundColor: 'rgba(10,10,10,0.85)', borderRadius: 8, padding: 12, width: 220, maxHeight: 260, borderWidth: 1, borderColor: '#2a2a2a' },
    reportsLabel:      { color: '#10b981', fontSize: 10, fontWeight: '700', letterSpacing: 1.2, marginBottom: 6 },
    reportsList:       { maxHeight: 210 },
    reportRow:         { flexDirection: 'row', alignItems: 'center', paddingVertical: 3, gap: 6 },
    reportGlyph:       { fontSize: 12, width: 16 },
    reportName:        { color: '#ccc', fontSize: 11, flex: 1 },
    reportTime:        { color: '#666', fontSize: 10, fontFamily: 'monospace' },
    bar:               { height: BAR_HEIGHT, backgroundColor: '#111', paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#222' },
    barBtn:            { flex: 1, borderRadius: 8, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: '#2a2a2a', backgroundColor: '#1a1a1a' },
    barBtnActive:      { backgroundColor: '#14361f', borderColor: '#10b981' },
    barBtnText:        { color: '#777', fontSize: 13, fontWeight: '600' },
    barBtnTextActive:  { color: '#10b981' },
})
