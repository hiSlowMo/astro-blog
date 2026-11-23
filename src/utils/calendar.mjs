export const siteTimeZone = 'Asia/Shanghai'
const calendar = new Intl.DateTimeFormat('sv-SE', {
  year: 'numeric', month: '2-digit', day: '2-digit', timeZone: siteTimeZone,
})

/** @param {Date} date */
export function calendarDay(date) {
  return calendar.format(date)
}

/** @param {Date} date */
export function calendarYear(date) {
  return Number(calendarDay(date).slice(0, 4))
}
