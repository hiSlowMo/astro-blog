const pages = new Map([
  ['/links/', { file: '/collection.html', marker: 'data-album=' }],
  ['/links/submit/', { file: '/application.html', marker: 'data-receipt' }],
])

async function checkOrigin(url, marker, key) {
  const origin = await fetch(url, { redirect: 'manual' })
  const native = origin.ok && (await origin.text()).includes(marker)
  await caches.default.put(key, new Response(native ? 'native' : 'edge', {
    headers: { 'Cache-Control': 'public, max-age=300' },
  }))
}

export default {
  async fetch(request, env, context) {
    const url = new URL(request.url)
    if (pages.has(`${url.pathname}/`)) {
      url.pathname += '/'
      return Response.redirect(url.href, 308)
    }
    const page = pages.get(url.pathname)
    const isAsset = url.pathname.startsWith('/links/_records-assets/')
    if (!page && !isAsset)
      return fetch(request)
    if (!['GET', 'HEAD'].includes(request.method))
      return new Response(null, { status: 405 })
    if (isAsset)
      return env.ASSETS.fetch(request)
    const canonical = new URL(url.pathname, url.origin)
    const key = new Request(`${canonical}?_records_origin_state=1`)
    const cached = await caches.default.match(key)
    if (cached && await cached.text() === 'native')
      return fetch(request)
    if (!cached)
      context.waitUntil(checkOrigin(canonical, page.marker, key).catch(() => {}))
    const asset = await env.ASSETS.fetch(new Request(new URL(page.file, url.origin), { method: request.method }))
    const response = new Response(asset.body, asset)
    response.headers.set('Cache-Control', 'public, max-age=60')
    response.headers.set('X-Records-Release', 'astro-static')
    return response
  },
}
