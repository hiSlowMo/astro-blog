import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const dist = fileURLToPath(new URL('../../../dist/', import.meta.url))
const root = resolve(process.argv[2], '.cloudflare/output/v0')
const target = join(root, 'workers/default')
const assets = join(target, 'assets')
const prefix = '/links/_records-assets/'
const files = readdirSync(join(dist, '_astro'), { withFileTypes: true }).filter(entry => entry.isFile()).map(entry => entry.name)
const visited = new Set()
mkdirSync(join(target, 'bundle'), { recursive: true })
mkdirSync(join(assets, prefix), { recursive: true })

function rewrite(text) {
  const updated = text.replaceAll('/_astro/', prefix)
  for (const name of files) {
    if (visited.has(name) || !updated.includes(name))
      continue
    visited.add(name)
    const bytes = readFileSync(join(dist, '_astro', name))
    const content = /\.(?:css|m?js)$/.test(name) ? rewrite(bytes.toString()) : bytes
    writeFileSync(join(assets, prefix, name), content)
  }
  return updated
}

for (const [path, name] of [['links/index.html', 'collection'], ['links/submit/index.html', 'application']])
  writeFileSync(join(assets, `${name}.html`), rewrite(readFileSync(join(dist, path), 'utf8')))
writeFileSync(join(root, 'config.json'), JSON.stringify({ buildContext: { isPreview: false } }))
writeFileSync(join(target, 'bundle/worker.js'), readFileSync(new URL('./worker.js', import.meta.url)))
writeFileSync(join(target, 'worker.config.json'), JSON.stringify({
  name: 'slowmo-records-pages',
  compatibilityDate: '2026-11-18',
  manifest: { type: 'complete', mainModule: 'worker.js', modules: { 'worker.js': { type: 'esm' } } },
  env: { ASSETS: { type: 'assets' } },
  assets: { runWorkerFirst: true, htmlHandling: 'none' },
  workersDev: false,
  observability: { enabled: true, traces: { enabled: true } },
  triggers: [{ type: 'fetch', pattern: 'www.theslowmo.com/links*', zone: 'theslowmo.com' }],
}))
console.warn(`Prepared two Astro pages and ${visited.size} shared assets.`)
