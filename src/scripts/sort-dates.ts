export function syncSortDates(root: HTMLElement, key: 'created' | 'updated') {
  root.querySelectorAll<HTMLTimeElement>('time[data-sort-date]').forEach((time) => {
    const label = key === 'updated' ? time.dataset.updatedLabel : time.dataset.createdLabel
    const datetime = key === 'updated' ? time.dataset.updatedDatetime : time.dataset.createdDatetime
    const title = key === 'updated' ? time.dataset.updatedTitle : time.dataset.createdTitle
    if (label && datetime && title) {
      time.textContent = label
      time.dateTime = datetime
      time.title = title
      time.setAttribute('aria-label', title)
    }
  })
}
