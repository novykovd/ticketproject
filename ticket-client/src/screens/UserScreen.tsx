import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Platform } from 'react-native'
import { trpc } from '../lib/trpc'
import { TrackMap } from '../components/TrackMap'

// The real user surface: a full-screen map that's always on, recent report pins
// shown passively, a From/To journey planner, and a report button. Journey +
// report submission are STUBS for now — wired later.
const BRATISLAVA_BBOX = { minLat: 48.05, maxLat: 48.25, minLon: 16.95, maxLon: 17.25 }
const TOP = Platform.OS === 'ios' ? 56 : 16

export function UserScreen({ onOpenDev }: { onOpenDev: () => void }) {
    const [from, setFrom] = useState('')
    const [to, setTo] = useState('')
    const [journeyActive, setJourneyActive] = useState(false)
    const [notice, setNotice] = useState<string | null>(null)

    // Reports poll passively and are always shown — except while a journey is up.
    const reportsQuery = trpc.reports.byViewport.useQuery(BRATISLAVA_BBOX, { refetchInterval: 8000 })
    const reports = reportsQuery.data ?? []

    function submitJourney() {
        if (!from.trim() || !to.trim()) { setNotice('enter both a start and destination'); return }
        setNotice(null)
        setJourneyActive(true) // hides reports; real routing gets wired here later
    }
    function submitReport() {
        setNotice('report submission — coming soon')
    }

    return (
        <View style={s.root}>
            <TrackMap history={[]} reports={journeyActive ? [] : reports} />

            {/* From / To planner */}
            <View style={[s.search, { top: TOP }]}>
                <TextInput style={s.input} placeholder="From" placeholderTextColor="#666" value={from} onChangeText={setFrom} />
                <TextInput style={s.input} placeholder="To"   placeholderTextColor="#666" value={to}   onChangeText={setTo} />
                <TouchableOpacity style={s.goBtn} onPress={submitJourney} activeOpacity={0.7}>
                    <Text style={s.goBtnText}>Find route</Text>
                </TouchableOpacity>
            </View>

            {/* journey view (reports hidden while active) — placeholder until wired */}
            {journeyActive && (
                <View style={s.journeyCard}>
                    <Text style={s.journeyTitle}>{from} → {to}</Text>
                    <Text style={s.journeyDim}>danger routing coming soon</Text>
                    <TouchableOpacity style={s.closeBtn} onPress={() => setJourneyActive(false)} activeOpacity={0.7}>
                        <Text style={s.closeBtnText}>× back to map</Text>
                    </TouchableOpacity>
                </View>
            )}

            {/* bottom controls (hidden while a journey is up) */}
            {!journeyActive && <>
                <TouchableOpacity style={s.devBtn} onPress={onOpenDev} activeOpacity={0.5}>
                    <Text style={s.devBtnText}>⚙</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.reportFab} onPress={submitReport} activeOpacity={0.85}>
                    <Text style={s.reportFabText}>🎫  Report</Text>
                </TouchableOpacity>
            </>}

            {/* tap-to-dismiss notice */}
            {notice && (
                <TouchableOpacity style={s.notice} onPress={() => setNotice(null)} activeOpacity={0.8}>
                    <Text style={s.noticeText}>{notice}</Text>
                </TouchableOpacity>
            )}
        </View>
    )
}

const s = StyleSheet.create({
    root:         { flex: 1, backgroundColor: '#0f0f0f', position: 'relative' },
    search:       { position: 'absolute', left: 12, right: 12, zIndex: 2, backgroundColor: 'rgba(10,10,10,0.9)', borderRadius: 12, padding: 10, gap: 8, borderWidth: 1, borderColor: '#2a2a2a' },
    input:        { backgroundColor: '#1a1a1a', color: '#eee', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, borderWidth: 1, borderColor: '#2a2a2a' },
    goBtn:        { backgroundColor: '#2563eb', borderRadius: 8, paddingVertical: 11, alignItems: 'center' },
    goBtnText:    { color: '#fff', fontSize: 15, fontWeight: '700' },
    devBtn:       { position: 'absolute', bottom: 26, left: 18, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(20,20,20,0.6)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#2a2a2a', zIndex: 2 },
    devBtnText:   { color: '#555', fontSize: 18 },
    reportFab:    { position: 'absolute', bottom: 26, right: 18, backgroundColor: '#dc2626', borderRadius: 26, paddingVertical: 13, paddingHorizontal: 20, zIndex: 2, shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
    reportFabText:{ color: '#fff', fontSize: 15, fontWeight: '700' },
    journeyCard:  { position: 'absolute', bottom: 26, left: 18, right: 18, backgroundColor: 'rgba(10,10,10,0.92)', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#2a2a2a', zIndex: 2 },
    journeyTitle: { color: '#eee', fontSize: 16, fontWeight: '700', marginBottom: 4 },
    journeyDim:   { color: '#666', fontSize: 13, marginBottom: 12 },
    closeBtn:     { alignSelf: 'flex-start', paddingVertical: 6 },
    closeBtnText: { color: '#3b82f6', fontSize: 14, fontWeight: '600' },
    notice:       { position: 'absolute', bottom: 92, alignSelf: 'center', backgroundColor: 'rgba(20,20,20,0.95)', borderRadius: 20, paddingVertical: 8, paddingHorizontal: 16, borderWidth: 1, borderColor: '#333', zIndex: 3 },
    noticeText:   { color: '#ccc', fontSize: 13 },
})
