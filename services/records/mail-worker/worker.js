export default {
  async fetch(request, env) {
    if (request.method !== 'POST' || new URL(request.url).pathname !== '/_records/notify')
      return new Response(null, { status: 404 })
    const encoder = new TextEncoder()
    const digest = value => crypto.subtle.digest('SHA-256', encoder.encode(value))
    const [provided, expected] = await Promise.all([
      digest(request.headers.get('Authorization') ?? ''),
      digest(`Bearer ${env.NOTIFY_TOKEN}`),
    ])
    if (!env.NOTIFY_TOKEN || !crypto.subtle.timingSafeEqual(provided, expected))
      return new Response(null, { status: 403 })
    let identifier, text
    if (request.headers.get('Content-Type')?.split(';')[0] === 'application/json') {
      const message = await request.json().catch(() => null)
      identifier = message?.id
      text = message?.text
    }
    else {
      identifier = await request.text()
      text = `新申请 ${identifier} 已保存，等待审核。`
    }
    if (typeof identifier !== 'string' || !/^SR-[a-f0-9]{32}$/.test(identifier)
      || typeof text !== 'string' || !text.trim() || text.length > 32768) {
      return new Response(null, { status: 422 })
    }
    try {
      const result = await env.EMAIL.send({
        from: 'me@theslowmo.com',
        to: env.RECIPIENT,
        subject: 'SlowMo Records 新友链申请',
        text,
      })
      return Response.json({ accepted: true, messageId: result.messageId })
    }
    catch (error) {
      console.error({ event: 'mail_failure', code: error.code })
      return Response.json({ accepted: false, code: error.code }, { status: 502 })
    }
  },
}
