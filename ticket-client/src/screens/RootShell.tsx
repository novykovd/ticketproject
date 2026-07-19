import { useState } from 'react'
import { UserScreen } from './UserScreen'
import { DevScreen } from './DevScreen'

// The app is the user surface (map + planner + report). Dev is the hidden
// match-visualizer, reached via the ⚙ button and left via "← app". When auth
// lands, gate the ⚙ behind an admin check instead of showing it to everyone.
export function RootShell() {
    const [screen, setScreen] = useState<'user' | 'dev'>('user')

    return screen === 'user'
        ? <UserScreen onOpenDev={() => setScreen('dev')} />
        : <DevScreen onExit={() => setScreen('user')} />
}
