// Shared behaviour for THE SLOWMO RECORDS pages (/links/ and /links/submit/).
//
// Copy buttons: any <button data-copy-value> copies its value. Optional parts:
//   data-copy-label   what is being copied, e.g. 站点名称 (used in the status line)
//   .copy-tip         tooltip inside the button; shows 已复制 / 复制失败 for a moment
//   [data-copy-scope] ancestor holding a [data-copy-status] line, which reads the result out
// Album covers: an <img> inside [data-cover] that fails to load tries its data-fallback-src
// (the apple-touch-icon) once, then the cover shows the shared placeholder.
// One delegated listener survives client-side navigation, so nothing needs rebinding.
import { copyText } from '@/utils/clipboard'

const COPY_SELECTOR = 'button[data-copy-value]'
const TIP_RESET_MS = 1600
const STATUS_RESET_MS = 4000
const FAILURE_RESET_MS = 15000

const tipTimers = new WeakMap<HTMLElement, number>()
const statusTimers = new WeakMap<HTMLElement, number>()

const TIP_EDGE_PX = 8

// Centre the tip over its button, nudged sideways just enough to stay on screen
function placeTip(button: HTMLElement) {
  const tip = button.querySelector<HTMLElement>('.copy-tip')
  if (!tip) {
    return
  }
  tip.style.setProperty('--tip-shift', '0px')
  const buttonBox = button.getBoundingClientRect()
  const half = tip.offsetWidth / 2
  const centre = buttonBox.left + buttonBox.width / 2
  const viewport = document.documentElement.clientWidth
  const shift = Math.max(TIP_EDGE_PX + half - centre, Math.min(0, viewport - TIP_EDGE_PX - half - centre))
  tip.style.setProperty('--tip-shift', `${Math.round(shift)}px`)
}

function handleEnter(event: Event) {
  const button = (event.target as Element | null)?.closest<HTMLElement>(COPY_SELECTOR)
  if (button) {
    placeTip(button)
  }
}

function showTip(button: HTMLElement, copied: boolean) {
  placeTip(button)
  const tip = button.querySelector<HTMLElement>('.copy-tip')
  if (tip) {
    tip.dataset.idle ??= tip.textContent ?? ''
    tip.textContent = copied ? '已复制' : '复制失败'
  }
  button.dataset.copyState = copied ? 'done' : 'failed'
  delete button.dataset.tipHidden

  window.clearTimeout(tipTimers.get(button))
  tipTimers.set(button, window.setTimeout(() => {
    delete button.dataset.copyState
    if (tip && tip.dataset.idle !== undefined) {
      tip.textContent = tip.dataset.idle
    }
  }, TIP_RESET_MS))
}

function showStatus(button: HTMLElement, copied: boolean, value: string) {
  const status = button.closest('[data-copy-scope]')?.querySelector<HTMLElement>('[data-copy-status]')
  if (!status) {
    return
  }
  const label = button.dataset.copyLabel ?? ''
  status.dataset.idle ??= status.textContent?.trim() ?? ''
  status.dataset.state = copied ? 'done' : 'failed'

  const message = document.createElement('span')
  message.className = 'copy-status__message'
  message.textContent = copied ? `已复制${label}：` : `复制失败，请手动复制${label}：`
  const valueEl = document.createElement('span')
  valueEl.className = 'copy-status__value'
  valueEl.textContent = value
  status.replaceChildren(message, valueEl)

  // When the browser refused, select the value so a long press or ⌘C finishes the job
  if (!copied) {
    const selection = window.getSelection()
    const range = document.createRange()
    range.selectNodeContents(valueEl)
    selection?.removeAllRanges()
    selection?.addRange(range)
  }

  window.clearTimeout(statusTimers.get(status))
  statusTimers.set(status, window.setTimeout(() => {
    delete status.dataset.state
    status.textContent = status.dataset.idle ?? ''
  }, copied ? STATUS_RESET_MS : FAILURE_RESET_MS))
}

async function handleCopyClick(event: MouseEvent) {
  const button = (event.target as Element | null)?.closest<HTMLElement>(COPY_SELECTOR)
  if (!button) {
    return
  }
  const value = button.dataset.copyValue ?? ''
  const copied = await copyText(value)
  showTip(button, copied)
  showStatus(button, copied, value)
}

// Escape dismisses a tooltip until the pointer or focus leaves its button
function handleKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape') {
    return
  }
  const focused = (document.activeElement as Element | null)?.closest<HTMLElement>(COPY_SELECTOR)
  const hovered = document.querySelectorAll<HTMLElement>(`${COPY_SELECTOR}:hover`)
  for (const button of [focused, ...Array.from(hovered)]) {
    if (button) {
      button.dataset.tipHidden = ''
    }
  }
}

function handleLeave(event: FocusEvent | PointerEvent) {
  const button = (event.target as Element | null)?.closest<HTMLElement>(COPY_SELECTOR)
  const next = event.relatedTarget as Node | null
  if (button && !(next && button.contains(next))) {
    delete button.dataset.tipHidden
  }
}

// A record folded away under 展开更多 opens when something links to it
function revealHashTarget() {
  const id = decodeURIComponent(location.hash.slice(1))
  const target = id ? document.getElementById(id) : null
  const details = target?.closest('details')
  if (target && details && !details.open) {
    details.open = true
    target.scrollIntoView()
  }
}

const COVER_IMG_SELECTOR = '[data-cover] img'

function coverFailed(img: HTMLImageElement) {
  const cover = img.closest<HTMLElement>('[data-cover]')
  if (!cover || cover.dataset.coverState === 'failed') {
    return
  }
  const fallback = img.dataset.fallbackSrc
  if (fallback) {
    delete img.dataset.fallbackSrc
    // The apple-touch-icon has its own pixel size, so the favicon's limit no longer applies
    cover.style.removeProperty('--icon-max')
    img.src = fallback
    return
  }
  cover.dataset.coverState = 'failed'
}

// Error events do not bubble, so listen in the capture phase
function handleImageError(event: Event) {
  const img = event.target
  if (img instanceof HTMLImageElement && img.matches(COVER_IMG_SELECTOR)) {
    coverFailed(img)
  }
}

// Covers that failed before this script ran
function sweepCovers() {
  document.querySelectorAll<HTMLImageElement>(COVER_IMG_SELECTOR).forEach((img) => {
    if (img.complete) {
      img.decode().catch(() => coverFailed(img))
    }
  })
}

const boundFlag = '__slowmoRecordsPageBound'
const scope = window as typeof window & { [boundFlag]?: boolean }
if (!scope[boundFlag]) {
  scope[boundFlag] = true
  document.addEventListener('click', handleCopyClick)
  document.addEventListener('keydown', handleKeydown)
  document.addEventListener('focusout', handleLeave)
  document.addEventListener('pointerout', handleLeave)
  document.addEventListener('pointerover', handleEnter)
  document.addEventListener('focusin', handleEnter)
  window.addEventListener('hashchange', revealHashTarget)
  document.addEventListener('error', handleImageError, true)
  document.addEventListener('astro:page-load', revealHashTarget)
  document.addEventListener('astro:page-load', sweepCovers)
  sweepCovers()
}
