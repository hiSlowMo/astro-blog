/**
 * Copy text to the clipboard. Resolves to false when the browser refuses; never throws.
 * Tries the async Clipboard API first, then the legacy execCommand path for older or
 * non-secure contexts, and reports what actually happened rather than assuming success.
 */
export async function copyText(text: string): Promise<boolean> {
  if (!text) {
    return false
  }

  if (window.isSecureContext && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    }
    catch {
      // Permission denied or the page lost focus: fall through to the legacy path
    }
  }

  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.setAttribute('aria-hidden', 'true')
  Object.assign(textarea.style, { position: 'fixed', top: '0', left: '0', opacity: '0', pointerEvents: 'none' })
  const previousFocus = document.activeElement as HTMLElement | null
  document.body.append(textarea)
  textarea.select()
  textarea.setSelectionRange(0, text.length)

  let copied = false
  try {
    // Deprecated, but still the only fallback where the async API is missing or refused

    copied = document.execCommand('copy')
  }
  catch {
    copied = false
  }
  textarea.remove()
  previousFocus?.focus({ preventScroll: true })
  return copied
}
