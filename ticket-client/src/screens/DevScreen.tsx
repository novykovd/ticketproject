import { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native'
import { MatchScreen } from './MatchScreen'
import { JourneyScreen } from './JourneyScreen'

// The dev/admin surface: an exit back to the app + a toggle between the two
// dev tools (the match-visualizer and the preset-journey tester).
const TOP = Platform.OS === 'ios' ? 50 : 12

type DevTab = 'match' | 'journey'
const LABEL: Record<DevTab, string> = { match: 'Match', journey: 'Journey' }

export function DevScreen({ onExit }: { onExit?: () => void }) {
    const [tab, setTab] = useState<DevTab>('match')

    return (
        <View style={s.root}>
            <View style={[s.bar, { paddingTop: TOP }]}>
                {onExit && (
                    <TouchableOpacity style={s.exit} onPress={onExit} activeOpacity={0.7}>
                        <Text style={s.exitText}>← app</Text>
                    </TouchableOpacity>
                )}
                <View style={s.tabs}>
                    {(['match', 'journey'] as DevTab[]).map(t => (
                        <TouchableOpacity
                            key={t}
                            style={[s.tab, tab === t && s.tabActive]}
                            onPress={() => setTab(t)}
                            activeOpacity={0.7}
                        >
                            <Text style={[s.tabText, tab === t && s.tabTextActive]}>{LABEL[t]}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            <View style={s.body}>
                {tab === 'match' ? <MatchScreen /> : <JourneyScreen />}
            </View>
        </View>
    )
}

const s = StyleSheet.create({
    root:          { flex: 1, backgroundColor: '#0f0f0f' },
    bar:           { flexDirection: 'row', alignItems: 'center', backgroundColor: '#111', borderBottomWidth: 1, borderBottomColor: '#222', paddingHorizontal: 10, paddingBottom: 8, gap: 10 },
    exit:          { paddingVertical: 8, paddingHorizontal: 10, borderRadius: 8, backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#2a2a2a' },
    exitText:      { color: '#888', fontSize: 13, fontWeight: '600' },
    tabs:          { flexDirection: 'row', flex: 1, justifyContent: 'flex-end', gap: 8 },
    tab:           { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8, borderWidth: 1, borderColor: '#2a2a2a', backgroundColor: '#1a1a1a' },
    tabActive:     { backgroundColor: '#1d3a5e', borderColor: '#3b82f6' },
    tabText:       { color: '#666', fontSize: 13, fontWeight: '700' },
    tabTextActive: { color: '#3b82f6' },
    body:          { flex: 1 },
})
