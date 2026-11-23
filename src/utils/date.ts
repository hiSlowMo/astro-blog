import type { ThemeConfig } from '@/types'
import { calendarDay, siteTimeZone } from './calendar.mjs'

export type DateFormat = ThemeConfig['global']['dateFormat'] | 'MM/DD' | 'MM.DD' | 'MMM D'

const monthDay = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: siteTimeZone })
const fullDate = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: siteTimeZone })

export function formatPostDate(date: Date, format: DateFormat) {
  if (format === 'MMM D')
    return monthDay.format(date)
  if (format === 'MMM D YYYY')
    return fullDate.format(date)
  const iso = calendarDay(date)
  if (format === 'YYYY-MM-DD')
    return iso
  if (format === 'MM/DD' || format === 'MM.DD')
    return iso.slice(5).replace('-', format === 'MM/DD' ? '/' : '.')

  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: format === 'D MMM YYYY' ? 'short' : '2-digit',
    day: format === 'D MMM YYYY' ? 'numeric' : '2-digit',
    timeZone: siteTimeZone,
  }
  const locale = format === 'DD-MM-YYYY' || format === 'D MMM YYYY' ? 'en-GB' : 'en-US'
  return date.toLocaleDateString(locale, options).replace(/\//g, '-').replace(',', '')
}
