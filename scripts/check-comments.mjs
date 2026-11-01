import assert from 'node:assert/strict'
import process from 'node:process'
import { chromium } from 'playwright'

// Run against `pnpm dev`, or set BLOG_TEST_URL to a production preview URL.
// Mock only Giscus's network boundary: never publish comments to GitHub.
const baseURL = process.env.BLOG_TEST_URL || 'http://localhost:4321'
const postPath = '/posts/我在树莓派上醒来/'
const browser = await chromium.launch({ headless: true })
const clientURL = 'https://giscus.app/client.js'
const widgetURL = 'https://giscus.app/zh-CN/widget'
const mockClient = `(() => {
  const config = document.currentScript.dataset;
  const frame = document.createElement('iframe');
  frame.className = 'giscus-frame';
  frame.src = '${widgetURL}?' + new URLSearchParams({
    theme: config.theme, term: location.pathname, repo: config.repo,
  });
  document.querySelector('#giscus').replaceChildren(frame);
})();`

function mockWidget(mode) {
  const message = mode === 'api-error'
    ? { error: 'API rate limit exceeded' }
    : mode === 'empty' ? { error: 'Discussion not found' } : { resizeHeight: 420 }
  return `<!doctype html><html><body>Comment widget<script>
    window.addEventListener('message', event => {
      if (event.data?.giscus?.setConfig?.theme)
        document.body.dataset.theme = event.data.giscus.setConfig.theme;
    });
    document.body.dataset.theme = new URL(location.href).searchParams.get('theme');
    parent.postMessage({giscus: ${JSON.stringify(message)}}, '*');
    ${mode === 'empty' ? 'parent.postMessage({giscus: {resizeHeight: 420}}, \'*\');' : ''}
  </script></body></html>`
}

async function scenario(name, mode, run) {
  const context = await browser.newContext({ viewport: { width: 820, height: 900 }, reducedMotion: 'reduce' })
  const page = await context.newPage()
  const errors = []
  let clientRequests = 0
  let widgetMode = mode
  page.on('pageerror', error => errors.push(error.message))
  await context.route(`${clientURL}*`, async (route) => {
    clientRequests++
    if (widgetMode === 'script-error')
      return route.abort('failed')
    if (widgetMode === 'script-hang')
      return
    return route.fulfill({ contentType: 'text/javascript', body: mockClient, headers: { 'Access-Control-Allow-Origin': '*' } })
  })
  await context.route(`${widgetURL}?**`, (route) => {
    if (widgetMode === 'frame-error')
      return route.abort('failed')
    if (widgetMode === 'silent')
      return route.fulfill({ contentType: 'text/html', body: '<!doctype html><body>Loading</body>' })
    return route.fulfill({ contentType: 'text/html', body: mockWidget(widgetMode) })
  })
  try {
    await page.goto(new URL(postPath, baseURL).href, { waitUntil: 'domcontentloaded', timeout: 60000 })
    await page.clock.install()
    await run({
      page,
      requests: () => clientRequests,
      recover: () => {
        widgetMode = 'ready'
      },
    })
    assert.deepEqual(errors, [], 'no unhandled browser errors')
    console.log(`✓ ${name}`)
  }
  finally {
    await context.close()
  }
}

async function scrollToComments(page) {
  await page.locator('#giscus').scrollIntoViewIfNeeded()
  await page.waitForFunction(() => document.querySelector('#giscus iframe'))
}

async function expectReady(page) {
  await page.waitForFunction(() => document.querySelector('[data-giscus-status]')?.hidden)
  assert.equal(await page.locator('iframe.giscus-frame').count(), 1)
  assert.equal(await page.locator('[data-giscus-retry]').isHidden(), true)
  assert.equal(await page.locator('iframe.giscus-frame').getAttribute('title'), '评论与回复')
}

async function expectFailure(page) {
  await page.locator('[data-giscus-retry]').waitFor({ state: 'visible' })
  assert.equal(await page.locator('[data-giscus-status]').textContent(), '评论暂时无法载入。')
  assert.equal(await page.locator('iframe.giscus-frame').count(), 0)
}

try {
  await scenario('lazy loading, theme changes and repeated initialization', 'ready', async ({ page, requests }) => {
    assert.equal(requests(), 0, 'do not load comments before scrolling near them')
    await scrollToComments(page)
    await expectReady(page)
    await page.evaluate(() => {
      document.dispatchEvent(new Event('astro:page-load'))
      document.dispatchEvent(new Event('astro:page-load'))
    })
    assert.equal(requests(), 1, 'initialization must not duplicate the widget')
    await page.locator('#theme-toggle-button').click()
    const expectedMode = await page.evaluate(() => document.documentElement.classList.contains('dark') ? 'dark' : 'light')
    const frame = page.frames().find(frame => frame.url().startsWith(widgetURL))
    await frame.waitForFunction(mode => document.body.dataset.theme?.includes(`theme-${mode}.css`), expectedMode)
  })

  for (const mode of ['script-error', 'script-hang', 'frame-error', 'silent', 'api-error']) {
    await scenario(`${mode} has a working retry`, mode, async ({ page, recover, requests }) => {
      await page.locator('#giscus').scrollIntoViewIfNeeded()
      if (mode === 'script-hang') {
        await page.waitForFunction(() => document.querySelector('#giscus')?.dataset.loading === '1')
        await page.clock.fastForward(21000)
      }
      if (mode === 'frame-error' || mode === 'silent') {
        await page.waitForFunction(() => document.querySelector('#giscus iframe'))
        await page.evaluate(() => {
          // A valid origin alone is insufficient: another window must not mark it ready.
          window.dispatchEvent(new MessageEvent('message', {
            origin: 'https://giscus.app',
            source: window,
            data: { giscus: { resizeHeight: 420 } },
          }))
        })
        assert.equal(await page.locator('[data-giscus-status]').isVisible(), true)
        await page.clock.fastForward(21000)
      }
      await expectFailure(page)
      recover()
      await page.locator('[data-giscus-retry]').click()
      await expectReady(page)
      assert.equal(requests(), 2)
    })
  }

  await scenario('a new article without a discussion remains usable', 'empty', async ({ page }) => {
    await scrollToComments(page)
    await expectReady(page)
    await page.clock.fastForward(21000)
    await expectReady(page)
  })

  await scenario('Astro navigation and browser back recreate the correct widget', 'ready', async ({ page }) => {
    await scrollToComments(page)
    await expectReady(page)
    await page.evaluate(() => {
      window.__commentNavigationMarker = true
      window.__commentPageLoads = 0
      document.addEventListener('astro:page-load', () => {
        window.__commentPageLoads++
      })
    })
    const navigate = async (action, path) => {
      const previousLoads = await page.evaluate(() => window.__commentPageLoads)
      await action()
      await page.waitForURL(new URL(path, baseURL).href)
      // Popstate changes the URL before ClientRouter has swapped the document.
      await page.waitForFunction(count => window.__commentPageLoads > count, previousLoads)
    }
    // Use the real site navigation so ClientRouter lifecycle handlers execute.
    await navigate(() => page.locator('#back-button').click(), '/')
    assert.equal(await page.evaluate(() => window.__commentNavigationMarker), true, 'use an Astro transition')
    const next = page.locator('a[href*="/posts/"]').first()
    const path = await next.getAttribute('href')
    await navigate(() => next.click(), path)
    await scrollToComments(page)
    await expectReady(page)
    assert.equal(new URL(await page.locator('iframe.giscus-frame').getAttribute('src')).searchParams.get('term'), new URL(page.url()).pathname)
    await navigate(() => page.goBack(), '/')
    await navigate(() => page.goBack(), postPath)
    await scrollToComments(page)
    await expectReady(page)
  })
}
finally {
  await browser.close()
}
