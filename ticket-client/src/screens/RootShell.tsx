import { useEffect, useState } from 'react'
import * as Location from 'expo-location'
import { UserScreen } from './UserScreen'
import { DevScreen } from './DevScreen'

// The app is the user surface (map + planner + report). Dev is the hidden
// match-visualizer, reached via the ⚙ button and left via "← app". When auth
// lands, gate the ⚙ behind an admin check instead of showing it to everyone.
export function RootShell() {
    const [screen, setScreen] = useState<'user' | 'dev'>('user')

    // Ask for location up front so the permission prompt isn't blocking the very
    // first report, and fire one throwaway fix to start the GPS receiver warming
    // (cuts down the cold-start "too few fixes" on the first real capture).
    useEffect(() => {
        (async () => {
            const { status } = await Location.requestForegroundPermissionsAsync()
            if (status === 'granted') Location.getCurrentPositionAsync({}).catch(() => {})
        })().catch(() => {})
    }, [])

    return screen === 'user'
        ? <UserScreen onOpenDev={() => setScreen('dev')} />
        : <DevScreen onExit={() => setScreen('user')} />
}
