// Site-wide light/dark switch.
// Any element with id="theme-toggle-button" toggles the theme: the floating utility button
// on regular pages, and the top bar button in standalone layouts such as RecordLayout.
// The theme lives in localStorage('theme') and the `dark` class on <html>; the inline script
// in Head.astro restores it on load and before every client-side navigation.

const THEME_TOGGLE_SELECTOR = '#theme-toggle-button'

// Apply theme changes
function applyTheme(isDark: boolean) {
  document.documentElement.classList.toggle('dark', isDark)

  // Update meta theme-color tag
  const metaThemeColor = document.head.querySelector('meta[name="theme-color"]')
  const themeButton = document.querySelector<HTMLElement>(THEME_TOGGLE_SELECTOR)
  const lightMode = themeButton?.dataset.lightMode
  const darkMode = themeButton?.dataset.darkMode

  if (metaThemeColor && lightMode && darkMode) {
    metaThemeColor.setAttribute('content', isDark ? darkMode : lightMode)
  }

  localStorage.setItem('theme', isDark ? 'dark' : 'light')
  document.dispatchEvent(new Event('theme-changed'))
}

// Toggle theme mode
function toggleTheme() {
  const isDark = !document.documentElement.classList.contains('dark')
  applyTheme(isDark)
}

// Handle theme toggle click events
function handleThemeToggle(e: MouseEvent) {
  if (!(e.target instanceof Element)) {
    return
  }

  if (!e.target.closest(THEME_TOGGLE_SELECTOR)) {
    return
  }

  // If reduceMotion is enabled, update theme directly
  if (document.documentElement.classList.contains('reduce-motion')) {
    toggleTheme()
    return
  }

  // Add temporary markers before view transition
  document.documentElement.style.setProperty('view-transition-name', 'theme-toggle-transition')
  document.documentElement.setAttribute('data-theme-changing', '')

  // Use View Transitions API for theme toggle
  const transition = document.startViewTransition(toggleTheme)

  // Remove temporary markers after view transition
  transition.finished.then(() => {
    document.documentElement.style.removeProperty('view-transition-name')
    document.documentElement.removeAttribute('data-theme-changing')
  })
}

// Listen to system theme changes in real time
function handleSystemChange(event: MediaQueryListEvent) {
  const isDark = event.matches
  applyTheme(isDark)
}

// Both the regular and the standalone layouts load this module. Bind once per document,
// even if a bundler ever ships it twice, or one click would toggle the theme twice.
const boundFlag = '__slowmoThemeToggleBound'
const scope = window as typeof window & { [boundFlag]?: boolean }

if (!scope[boundFlag]) {
  scope[boundFlag] = true
  document.addEventListener('click', handleThemeToggle)
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', handleSystemChange)
}
