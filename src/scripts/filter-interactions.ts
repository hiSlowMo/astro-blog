import { getMotionDuration, MOTION_EASING_STANDARD, prefersReducedMotion } from '@/scripts/motion'

const MOTION_EASING = MOTION_EASING_STANDARD
const MOTION_DURATION = getMotionDuration('slow')
const ENTER_OFFSET_Y = 10
const EXIT_DURATION = getMotionDuration('base')

const activeAnimations = new WeakMap<HTMLElement, Animation>()
const layoutTransitionTokens = new WeakMap<HTMLElement, symbol>()

function cancelAnimation(element: HTMLElement) {
  const animation = activeAnimations.get(element)
  if (!animation) {
    return
  }

  animation.cancel()
  activeAnimations.delete(element)
}

function trackAnimation(element: HTMLElement, animation: Animation) {
  activeAnimations.set(element, animation)

  const clear = () => {
    if (activeAnimations.get(element) === animation) {
      activeAnimations.delete(element)
    }
  }

  animation.addEventListener('finish', clear, { once: true })
  animation.addEventListener('cancel', clear, { once: true })
}

function isVisibleForLayout(element: HTMLElement) {
  if (element.classList.contains('is-hidden')) {
    return false
  }

  const rect = element.getBoundingClientRect()
  return rect.width > 0 && rect.height > 0
}

function collectLayoutRects(root: ParentNode, selectors: string[]) {
  const rects = new Map<HTMLElement, DOMRect>()

  selectors.forEach((selector) => {
    root.querySelectorAll<HTMLElement>(selector).forEach((element) => {
      cancelAnimation(element)

      if (isVisibleForLayout(element)) {
        rects.set(element, element.getBoundingClientRect())
      }
    })
  })

  return rects
}

function supportsIndependentTranslate() {
  return typeof CSS !== 'undefined'
    && typeof CSS.supports === 'function'
    && CSS.supports('translate', '0 0')
}

function markLayoutAnimating(root: HTMLElement, duration: number) {
  const token = Symbol('layout-transition')
  layoutTransitionTokens.set(root, token)
  root.dataset.layoutAnimating = '1'

  window.setTimeout(() => {
    if (layoutTransitionTokens.get(root) !== token) {
      return
    }

    delete root.dataset.layoutAnimating
    layoutTransitionTokens.delete(root)
  }, duration + 96)
}

function createMoveKeyframes(deltaX: number, deltaY: number): Keyframe[] {
  if (supportsIndependentTranslate()) {
    return [
      { translate: `${deltaX}px ${deltaY}px` },
      { translate: '0 0' },
    ]
  }

  return [
    { transform: `translate(${deltaX}px, ${deltaY}px)` },
    { transform: 'translate(0, 0)' },
  ]
}

function createEnterKeyframes(): Keyframe[] {
  if (supportsIndependentTranslate()) {
    return [
      { opacity: 0, translate: `0 ${ENTER_OFFSET_Y}px` },
      { opacity: 1, translate: '0 0' },
    ]
  }

  return [
    { opacity: 0, transform: `translate(0, ${ENTER_OFFSET_Y}px)` },
    { opacity: 1, transform: 'translate(0, 0)' },
  ]
}

export function runFlipTransition(
  root: HTMLElement,
  selectors: string[],
  updateDOM: () => void,
  duration: number = MOTION_DURATION,
) {
  if (prefersReducedMotion() || typeof HTMLElement.prototype.animate !== 'function') {
    updateDOM()
    return
  }

  markLayoutAnimating(root, duration)
  const firstRects = collectLayoutRects(root, selectors)

  updateDOM()

  const lastRects = collectLayoutRects(root, selectors)

  lastRects.forEach((lastRect, element) => {
    const firstRect = firstRects.get(element)
    if (!firstRect) {
      const animation = element.animate(
        createEnterKeyframes(),
        {
          duration: Math.round(duration * 0.82),
          easing: MOTION_EASING,
          fill: 'both',
        },
      )

      trackAnimation(element, animation)
      return
    }

    const deltaX = firstRect.left - lastRect.left
    const deltaY = firstRect.top - lastRect.top
    if (Math.abs(deltaX) < 0.5 && Math.abs(deltaY) < 0.5) {
      return
    }

    const animation = element.animate(
      createMoveKeyframes(deltaX, deltaY),
      {
        duration,
        easing: MOTION_EASING,
        fill: 'both',
      },
    )

    trackAnimation(element, animation)
  })
}

export function animateTextSwap(element: HTMLElement | null) {
  if (!element || prefersReducedMotion() || typeof HTMLElement.prototype.animate !== 'function') {
    return
  }

  cancelAnimation(element)

  const animation = element.animate(
    [
      { opacity: 0.6, transform: 'translateY(-2px)' },
      { opacity: 1, transform: 'translateY(0)' },
    ],
    {
      duration: 160,
      easing: MOTION_EASING,
      fill: 'both',
    },
  )

  trackAnimation(element, animation)
}

export async function animateExitTransition(
  elements: HTMLElement[],
  className: string = 'is-exiting',
  duration: number = EXIT_DURATION,
) {
  const targets = [...new Set(elements)]
    .filter(element => element && element.isConnected)

  if (targets.length === 0 || prefersReducedMotion()) {
    return
  }

  targets.forEach((element) => {
    cancelAnimation(element)
    element.classList.add(className)
  })

  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      window.setTimeout(resolve, duration)
    })
  })
}

export function clearTransitionState(elements: HTMLElement[], className: string = 'is-exiting') {
  elements.forEach(element => element.classList.remove(className))
}

interface DropdownController {
  close: () => void
  destroy: () => void
}

export function createDropdownController(dropdown: HTMLElement | null): DropdownController {
  if (!dropdown) {
    return {
      close: () => {},
      destroy: () => {},
    }
  }

  const trigger = dropdown.querySelector<HTMLElement>('[data-dropdown-trigger]')
  const menu = dropdown.querySelector<HTMLElement>('[data-dropdown-menu]')

  if (!trigger || !menu) {
    return {
      close: () => {},
      destroy: () => {},
    }
  }

  const controller = new AbortController()
  let isOpen = dropdown.dataset.open === '1'
  const getOptions = () => Array.from(menu.querySelectorAll<HTMLElement>('[role="option"]'))

  const setOpen = (nextOpen: boolean) => {
    isOpen = nextOpen
    dropdown.dataset.open = nextOpen ? '1' : '0'
    trigger.setAttribute('aria-expanded', nextOpen ? 'true' : 'false')
    menu.setAttribute('aria-hidden', nextOpen ? 'false' : 'true')
    menu.toggleAttribute('inert', !nextOpen)
  }

  const focusOption = (index: number) => {
    const options = getOptions()
    if (options.length === 0)
      return

    const normalizedIndex = (index + options.length) % options.length
    options[normalizedIndex]?.focus()
  }

  trigger.addEventListener('click', (event) => {
    event.preventDefault()
    setOpen(!isOpen)
  }, { signal: controller.signal })

  trigger.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp')
      return

    event.preventDefault()
    setOpen(true)
    const options = getOptions()
    const selectedIndex = options.findIndex(option => option.getAttribute('aria-selected') === 'true')
    focusOption(event.key === 'ArrowDown' ? Math.max(0, selectedIndex) : (selectedIndex < 0 ? options.length - 1 : selectedIndex))
  }, { signal: controller.signal })

  menu.addEventListener('keydown', (event) => {
    const options = getOptions()
    const currentIndex = options.indexOf(document.activeElement as HTMLElement)

    if (event.key === 'Home') {
      event.preventDefault()
      focusOption(0)
    }
    else if (event.key === 'End') {
      event.preventDefault()
      focusOption(options.length - 1)
    }
    else if (event.key === 'ArrowDown') {
      event.preventDefault()
      focusOption(currentIndex + 1)
    }
    else if (event.key === 'ArrowUp') {
      event.preventDefault()
      focusOption(currentIndex - 1)
    }
  }, { signal: controller.signal })

  menu.addEventListener('click', (event) => {
    const target = event.target
    if (!(target instanceof Element) || !target.closest('[role="option"]'))
      return

    setOpen(false)
    trigger.focus()
  }, { signal: controller.signal })

  document.addEventListener('click', (event) => {
    if (!isOpen) {
      return
    }

    const target = event.target
    if (!(target instanceof Node)) {
      return
    }

    if (!dropdown.contains(target)) {
      setOpen(false)
    }
  }, { signal: controller.signal })

  document.addEventListener('keydown', (event) => {
    if (!isOpen || event.key !== 'Escape') {
      return
    }

    setOpen(false)
    trigger.focus()
  }, { signal: controller.signal })

  setOpen(isOpen)

  return {
    close: () => setOpen(false),
    destroy: () => controller.abort(),
  }
}
