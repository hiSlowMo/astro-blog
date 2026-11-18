import { writeFileSync } from 'node:fs'
import { friendLinks } from '../../src/data/friend-links.ts'

writeFileSync(new URL('./catalog.json', import.meta.url), `${JSON.stringify(friendLinks, null, 2)}\n`)
