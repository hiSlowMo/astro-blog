import { prefersReducedMotion } from '@/scripts/motion'

// Mark only crossings between the browsing layout and the reading layout.
// Direct loads, theme changes and navigation between articles stay still.
document.addEventListener('astro:before-swap', (event) => {
  const wasReading = document.documentElement.dataset.readingLayout === 'article'
  const nextRoot = event.newDocument.documentElement
  const willRead = nextRoot.dataset.readingLayout === 'article'
  if (wasReading === willRead || !window.matchMedia('(min-width: 768px)').matches || prefersReducedMotion())
    return

  const direction = willRead ? 'enter' : 'leave'
  nextRoot.dataset.readingTransition = direction
  void event.viewTransition.finished.finally(() => {
    if (document.documentElement.dataset.readingTransition === direction)
      delete document.documentElement.dataset.readingTransition
  }).catch(() => {})
})
