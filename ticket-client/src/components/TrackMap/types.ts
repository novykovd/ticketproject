export type MatchedSegment = {
    shapeId: string
    from: { lat: number; lon: number }
    to:   { lat: number; lon: number }
}

export type Entry = {
    query: { from: { lat: number; lon: number }; to: { lat: number; lon: number } }
    match: MatchedSegment | null
}

export interface TrackMapProps {
    history: Entry[]
}
