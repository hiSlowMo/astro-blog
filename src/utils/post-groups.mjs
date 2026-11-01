/**
 * @template {{ data: { published: Date, pin?: number } }} T
 * @param {T[]} posts
 * @param {{ includePinned?: boolean }} options
 * @returns {Map<number, T[]>} Posts in descending year and publication order.
 */
export function groupPostsByYear(posts, { includePinned = false } = {}) {
  const years = new Map()
  for (const post of posts) {
    if (!includePinned && post.data.pin)
      continue
    const year = post.data.published.getFullYear()
    const entries = years.get(year) ?? []
    entries.push(post)
    years.set(year, entries)
  }
  for (const entries of years.values())
    entries.sort((a, b) => b.data.published.valueOf() - a.data.published.valueOf())
  return new Map([...years.entries()].sort((a, b) => b[0] - a[0]))
}
