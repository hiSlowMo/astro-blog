import { RECORDS_API } from '@/utils/records'

const FORM_SELECTOR = 'form[data-record-form]'

interface FieldRule {
  label: string
  required?: boolean
  url?: boolean
  email?: boolean
  maxLength?: number
}

const RULES: Record<string, FieldRule> = {
  name: { label: '站点名称', required: true, maxLength: 40 },
  url: { label: '站点链接', required: true, url: true },
  description: { label: '站点简介', required: true, maxLength: 60 },
  icon: { label: '图标链接', required: true, url: true },
  rss: { label: 'RSS / Feed', url: true },
  cover: { label: '专辑封面', url: true },
  article: { label: '代表文章', url: true },
  artist: { label: '署名', required: true, maxLength: 40 },
  email: { label: '联系邮箱', required: true, email: true },
  genres: { label: '类型标签', maxLength: 60 },
}

type Control = HTMLInputElement | HTMLTextAreaElement

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return (url.protocol === 'https:' || url.protocol === 'http:') && url.hostname.includes('.')
  }
  catch {
    return false
  }
}

function checkControl(control: Control): string {
  const rule = RULES[control.name]
  if (!rule) {
    return ''
  }
  const value = control.value.trim()
  if (!value) {
    return rule.required ? `请填写${rule.label}` : ''
  }
  if (rule.url && !isHttpUrl(value)) {
    return `${rule.label}需要是以 https:// 开头的完整网址`
  }
  if (rule.email && !/^[^\s@]+@[^\s@][^\s.@]*\.[^\s@]+$/.test(value)) {
    return '邮箱格式不正确'
  }
  if (rule.maxLength && Array.from(value).length > rule.maxLength) {
    return `${rule.label}请控制在 ${rule.maxLength} 字以内`
  }
  return ''
}

function showError(control: Control, message: string) {
  const field = control.closest<HTMLElement>('[data-field]')
  const error = field?.querySelector<HTMLElement>('[data-error]')
  if (error) {
    error.textContent = message
  }
  if (message) {
    field?.setAttribute('data-invalid', '')
    control.setAttribute('aria-invalid', 'true')
  }
  else {
    field?.removeAttribute('data-invalid')
    control.removeAttribute('aria-invalid')
  }
}

function controlsOf(form: HTMLFormElement): Control[] {
  return Array.from(form.elements).filter((el): el is Control =>
    (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) && el.name in RULES,
  )
}

function buildSummary(form: HTMLFormElement): string {
  const data = new FormData(form)
  const get = (key: string) => String(data.get(key) ?? '').trim()
  const lines = [
    '【THE SLOWMO RECORDS · 推荐一张专辑】',
    `站点名称：${get('name')}`,
    `站点链接：${get('url')}`,
    `站点简介：${get('description')}`,
    `图标链接：${get('icon')}`,
    get('rss') && `RSS：${get('rss')}`,
    get('cover') && `专辑封面：${get('cover')}`,
    get('article') && `代表文章：${get('article')}`,
    `署名：${get('artist')}`,
    `联系邮箱：${get('email')}`,
    get('genres') && `类型标签：${get('genres')}`,
  ]
  return lines.filter(Boolean).join('\n')
}

async function handleSubmit(event: SubmitEvent) {
  const form = event.target
  if (!(form instanceof HTMLFormElement) || !form.matches(FORM_SELECTOR)) {
    return
  }
  event.preventDefault()
  if (form.dataset.sending) {
    return
  }

  const summary = form.querySelector<HTMLElement>('[data-form-summary]')
  const result = form.parentElement?.querySelector<HTMLElement>('[data-submit-result]')
  let firstInvalid: Control | undefined
  let invalidCount = 0

  for (const control of controlsOf(form)) {
    const message = checkControl(control)
    showError(control, message)
    if (message) {
      invalidCount += 1
      firstInvalid ??= control
    }
  }

  if (firstInvalid) {
    if (result) {
      result.hidden = true
    }
    if (summary) {
      summary.textContent = `还有 ${invalidCount} 项需要修改。`
    }
    firstInvalid.focus()
    return
  }

  const rules = form.querySelector<HTMLInputElement>('[name="rules"]')
  if (!rules?.checked) {
    if (summary)
      summary.textContent = '请先阅读并确认申请规则。'
    rules?.focus()
    return
  }
  const button = form.querySelector<HTMLButtonElement>('[type="submit"]')
  if (!button || !summary || !result)
    return
  result.hidden = true
  button.disabled = true
  form.dataset.sending = 'true'
  summary.textContent = '正在提交…'
  const data = new FormData(form)
  const fields: Record<string, string> = {}
  data.forEach((value, key) => {
    fields[key] = String(value)
  })
  const text = buildSummary(form)
  try {
    const response = await fetch(`${RECORDS_API}/applications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...fields, rules: true }),
      signal: AbortSignal.timeout(15000),
    })
    const receipt = await response.json()
    if (response.status !== 201 || receipt.status !== 'pending' || typeof receipt.id !== 'string') {
      summary.textContent = typeof receipt.error === 'string' ? receipt.error : '未收到提交回执，请稍后重试。'
      return
    }
    summary.textContent = ''
    const receiptText = result.querySelector<HTMLElement>('[data-receipt]')
    if (receiptText)
      receiptText.textContent = `申请编号 ${receipt.id}`
    const copyButton = result.querySelector<HTMLElement>('[data-submit-copy]')
    if (copyButton) {
      copyButton.dataset.copyValue = `${receiptText?.textContent}\n${text}`
    }
    result.hidden = false
    result.focus({ preventScroll: true })
    result.scrollIntoView({ block: 'nearest', behavior: document.documentElement.classList.contains('reduce-motion') ? 'auto' : 'smooth' })
  }
  catch {
    summary.textContent = '未收到服务器回执，填写内容已保留。请稍后重试。'
  }
  finally {
    button.disabled = false
    delete form.dataset.sending
  }
}

// Re-check a field once it has been marked, so the message clears as soon as it is fixed
function handleInput(event: Event) {
  const control = event.target
  if (!(control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement)) {
    return
  }
  if (!control.closest(FORM_SELECTOR)) {
    return
  }
  const field = control.closest('[data-field]')
  if (field?.hasAttribute('data-invalid')) {
    showError(control, checkControl(control))
  }
  // Any edit after a clean check means the copied summary would be stale
  const result = control.closest(FORM_SELECTOR)?.parentElement?.querySelector<HTMLElement>('[data-submit-result]')
  if (result && !result.hidden) {
    result.hidden = true
    const summary = control.form?.querySelector<HTMLElement>('[data-form-summary]')
    if (summary) {
      summary.textContent = ''
    }
  }
}

function handleBlur(event: FocusEvent) {
  const control = event.target
  if (!(control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement) || !control.closest(FORM_SELECTOR)) {
    return
  }
  // Mark a field on leaving it only once something was typed, so tabbing through stays quiet
  if (control.value.trim()) {
    showError(control, checkControl(control))
  }
}

// Our own messages replace the browser's bubbles
function prepareForms() {
  document.querySelectorAll<HTMLFormElement>(FORM_SELECTOR).forEach((form) => {
    form.noValidate = true
  })
}

const boundFlag = '__slowmoRecordsSubmitBound'
const scope = window as typeof window & { [boundFlag]?: boolean }
if (!scope[boundFlag]) {
  scope[boundFlag] = true
  document.addEventListener('submit', handleSubmit)
  document.addEventListener('input', handleInput)
  document.addEventListener('change', handleInput)
  document.addEventListener('focusout', handleBlur)
  document.addEventListener('astro:page-load', prepareForms)
}
prepareForms()
