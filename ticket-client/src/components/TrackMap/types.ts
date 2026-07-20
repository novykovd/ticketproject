export type MatchedSegment = {
    shapeId: string
    from: { lat: number; lon: number }
    to:   { lat: number; lon: number }
}

export type Entry = {
    query: { from: { lat: number; lon: number }; to: { lat: number; lon: number } }
    match: MatchedSegment | null
}

export type ReportPin = {
    id: number
    type: string
    lat: number
    lon: number
    stopName: string | null
}

// Ordered stops of a planned journey; colour is precomputed from danger by the
// caller so the map doesn't need to know the danger model.
export type JourneyStopPin = {
    lat: number
    lon: number
    color: string
}

export interface TrackMapProps {
    history: Entry[]
    reports?: ReportPin[]
    journey?: JourneyStopPin[]
}
