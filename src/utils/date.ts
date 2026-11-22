import type { ThemeConfig } from '@/types'

export type DateFormat = ThemeConfig['global']['dateFormat'] | 'MM/DD' | 'MM.DD' | 'MMM D'

const monthDay = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })

export function formatPostDate(date: Date, format: DateFormat) {
  if (format === 'MMM D')
    return monthDay.format(date)
  const iso = date.toISOString().split('T')[0]
  if (format === 'YYYY-MM-DD')
    return iso
  if (format === 'MM/DD' || format === 'MM.DD')
    return iso.slice(5).replace('-', format === 'MM/DD' ? '/' : '.')

  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: format === 'MMM D YYYY' || format === 'D MMM YYYY' ? 'short' : '2-digit',
    day: format === 'MMM D YYYY' || format === 'D MMM YYYY' ? 'numeric' : '2-digit',
    timeZone: 'UTC',
  }
  const locale = format === 'DD-MM-YYYY' || format === 'D MMM YYYY' ? 'en-GB' : 'en-US'
  return date.toLocaleDateString(locale, options).replace(/\//g, '-').replace(',', '')
}
