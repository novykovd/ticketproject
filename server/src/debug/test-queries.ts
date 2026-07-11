import { getReportsByViewport, getReportsByRoute, addObservation } from '@ticketproject/db'

// Bratislava bounding box — should return seeded rows
const viewport = await getReportsByViewport(48.05, 48.25, 16.95, 17.25)
console.log(`byViewport: ${viewport.length} rows`)
console.log(viewport[0])

// routeId null on seeded rows so this returns 0 — confirms the filter works
const route = await getReportsByRoute('99')
console.log(`\nbyRoute '99': ${route.length} rows`)

// insert a real row and check it comes back
const inserted = await addObservation({
    clerkUserId: 'test_user',
    lat: 48.1486,
    lon: 17.1077,
    type: 'ticket_inspector',
    data: { test: true },
})
console.log(`\ninserted:`, inserted)

process.exit(0)
