// Wipes report/transaction data (observations) for a clean re-seed.
// Leaves `stops` alone — that's static reference data, re-imported idempotently
// by seed:stops. RESTART IDENTITY resets the id counter back to 1.
import { db } from '@ticketproject/db'
import { sql } from 'drizzle-orm'

await db.execute(sql`TRUNCATE observations RESTART IDENTITY`)
console.log('observations wiped')
process.exit(0)
