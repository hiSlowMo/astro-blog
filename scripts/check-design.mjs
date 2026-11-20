import assert from 'node:assert/strict'
import process from 'node:process'
import { chromium, webkit } from 'playwright'
import sharp from 'sharp'

const baseURL = process.env.BLOG_TEST_URL || 'http://localhost:4321'
const routes = ['/', '/about/', '/archive/', '/tags/', '/moments/', '/search/', '/links/', '/links/submit/']

async function headerGeometry(page) {
  await page.locator('#site-nav[data-nav-bound="1"]').waitFor()
  await page.evaluate(() => document.fonts.ready)
  return page.locator('#site-title-link, #site-status, #theme-toggle-button, #site-nav')
    .evaluateAll(elements => elements.map((element) => {
      const { x, y, width, height } = element.getBoundingClientRect()
      return [x, y, width, height]
    }))
}

async function checkNavigation(page) {
  for (const width of [320, 375, 768, 769, 810, 1023, 1024]) {
    await page.setViewportSize({ width, height: 800 })
    await page.goto('/')
    const home = await headerGeometry(page)
    const links = page.locator('.nav-primary-item a')
    const first = await links.first().boundingBox()
    const last = await links.last().boundingBox()
    assert.equal(first.y === last.y, width < 1024, `Navigation direction at ${width}px`)
    if (width >= 1024)
      continue
    await links.nth(1).click()
    await page.waitForURL('**/moments/')
    assert.deepEqual(await headerGeometry(page), home, `Header moved on Moments at ${width}px`)
    await page.locator('[data-nav-more-trigger]').click()
    await page.locator('#site-nav[data-nav-open="1"]').waitFor()
    const more = await page.locator('.nav-more-list li').evaluateAll(items => items.map(item => item.getBoundingClientRect().toJSON()))
    assert(more.every(item => item.y === more[0].y && item.right <= width), `More links at ${width}px`)
    await page.locator('.nav-more-list a[href="/archive/"]').click()
    await page.waitForURL('**/archive/')
    assert.deepEqual(await headerGeometry(page), home, `Header moved on Archive at ${width}px`)
  }
}

async function checkFade(page) {
  const sky = page.locator('.ascii-sky[data-ready]')
  await sky.waitFor()
  const rect = await sky.boundingBox()
  assert(rect.height + rect.y <= (await page.locator('main').boundingBox()).y, 'Sky extends into the reading column')
  const probe = await page.addStyleTag({ content: `
    body::before { content: ''; position: fixed; inset: 0; z-index: 999998; background: black; }
    .ascii-sky[data-ready] { z-index: 999999 !important; opacity: 1 !important; background: white; transition: none !important; }
    .ascii-sky canvas { visibility: hidden; }
  ` })
  try {
    const image = await page.screenshot({ clip: { x: Math.floor(rect.x + rect.width / 2), y: rect.y, width: 1, height: Math.floor(rect.height) }, scale: 'css' })
    const { data, info } = await sharp(image).removeAlpha().raw().toBuffer({ resolveWithObject: true })
    const samples = [0.2, 0.46, 0.68, 0.86, 1].map(position => data[Math.floor((info.height - 1) * position) * info.channels])
    assert(samples[0] >= 250 && samples.at(-1) <= 5, `Fade endpoints ${samples}`)
    assert(samples.slice(1).every((value, index) => value < samples[index]), `Fade progression ${samples}`)
  }
  finally {
    await probe.evaluate(element => element.remove())
  }
}

async function checkArticleControls(page) {
  const trigger = page.locator('#toc-mobile-trigger')
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
  await page.waitForFunction(() => !document.documentElement.hasAttribute('data-reading-controls-hidden'))
  await page.evaluate(() => window.scrollTo({ top: 320, behavior: 'instant' }))
  await page.waitForFunction(() => getComputedStyle(document.querySelector('#site-utility')).opacity === '0')
  await page.evaluate(() => window.scrollBy({ top: -40, behavior: 'instant' }))
  await page.waitForFunction(() => getComputedStyle(document.querySelector('#site-utility')).opacity === '1')
  await trigger.click()
  const panel = page.locator('#toc-mobile-panel')
  const bar = await page.locator('#site-utility').boundingBox()
  const button = await trigger.boundingBox()
  assert.equal(button.y, bar.y)
  assert.equal(button.height, bar.height)
  const list = panel.locator('[data-mobile-tab-panel][aria-hidden="false"]')
  const visibleList = await list.boundingBox()
  const frame = await panel.boundingBox()
  assert(visibleList.y + visibleList.height <= frame.y + frame.height, 'TOC extends outside panel')
  await list.locator('a').last().click()
  assert.equal(await trigger.getAttribute('aria-expanded'), 'false')
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
  await page.waitForFunction(() => !document.documentElement.hasAttribute('data-reading-controls-hidden'))
  await trigger.click()
  await page.keyboard.press('Escape')
  assert.equal(await trigger.getAttribute('aria-expanded'), 'false')
}

for (const engine of [chromium, webkit]) {
  const browser = await engine.launch()
  try {
    const page = await browser.newPage({ baseURL, reducedMotion: 'reduce' })
    await page.route('**/*', route => new URL(route.request().url()).origin === new URL(baseURL).origin ? route.continue() : route.abort())
    await page.goto('/archive/')
    const post = await page.locator('.archive-title[href]').first().getAttribute('href')
    const tag = await page.locator('.archive-tag[href]').first().getAttribute('href')
    await checkNavigation(page)
    for (const path of [...routes, post, tag]) {
      assert.equal((await page.goto(path)).status(), 200, path)
      await page.evaluate(() => document.fonts.ready)
      for (const width of [320, 375, 390, 430, 768, 844, 1024, 1440]) {
        await page.setViewportSize({ width, height: width === 844 ? 390 : 844 })
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
        assert(overflow <= 1, `${path} at ${width}px overflows by ${overflow}px`)
        if (path === '/' && width === 390) {
          const root = page.locator('html')
          const wasDark = await root.evaluate(element => element.classList.contains('dark'))
          await page.locator('#theme-toggle-button').click()
          await page.waitForFunction(previous => document.documentElement.classList.contains('dark') !== previous, wasDark)
        }
        if ((path === '/' || path === post) && width === 390)
          await checkFade(page)
      }
    }
    await page.goto(post)
    for (const viewport of [{ width: 320, height: 640 }, { width: 844, height: 390 }]) {
      await page.setViewportSize(viewport)
      await checkArticleControls(page)
    }
    console.log(`${engine.name()} passed viewport and gradient checks`)
  }
  finally {
    await browser.close()
  }
}
