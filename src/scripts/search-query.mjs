const han = /\p{Script=Han}/u

export function normalizeSearchText(text) {
  return text.normalize('NFKC').replace(/\u200B/g, '').replace(/\s+/g, ' ').trim()
}

export function getSearchTerms(query) {
  return (normalizeSearchText(query).match(/"[^"]+"|\S+/g) ?? [])
    .map(term => term.replace(/^"|"$/g, '').toLocaleLowerCase())
    .filter(Boolean)
}

export function highlightSearchText(text, terms) {
  const lower = text.toLocaleLowerCase()
  const matches = []
  for (const term of terms) {
    let start = lower.indexOf(term)
    while (start !== -1) {
      matches.push({ start, end: start + term.length })
      start = lower.indexOf(term, start + term.length)
    }
  }
  matches.sort((a, b) => a.start - b.start || b.end - a.end)
  const ranges = []
  for (const match of matches) {
    const last = ranges.at(-1)
    if (last && match.start <= last.end)
      last.end = Math.max(last.end, match.end)
    else
      ranges.push({ ...match })
  }
  const segments = []
  let cursor = 0
  for (const { start, end } of ranges) {
    if (cursor < start)
      segments.push({ text: text.slice(cursor, start), match: false })
    segments.push({ text: text.slice(start, end), match: true })
    cursor = end
  }
  if (cursor < text.length)
    segments.push({ text: text.slice(cursor), match: false })
  return segments
}

function getExcerpt(content, terms, fallback, title) {
  const plain = normalizeSearchText(content)
  const lower = plain.toLocaleLowerCase()
  // Prefer a match after the article heading, beyond the indexed tags and title.
  const heading = normalizeSearchText(title || '')
  const headingStart = heading ? plain.indexOf(heading) : -1
  const bodyStart = headingStart < 0 ? 0 : headingStart + heading.length
  let positions = terms.map(term => lower.indexOf(term, bodyStart)).filter(position => position >= 0)
  let excerptStart = bodyStart
  if (!positions.length) {
    positions = terms.map(term => lower.indexOf(term)).filter(position => position >= 0)
    excerptStart = 0
  }
  if (!positions.length)
    return normalizeSearchText(fallback || plain).slice(0, 150)
  const start = Math.max(excerptStart, Math.min(...positions) - 28)
  const end = Math.min(plain.length, start + 150)
  return `${start > 0 ? '…' : ''}${plain.slice(start, end)}${end < plain.length ? '…' : ''}`
}

function getResult(document, terms) {
  return {
    url: document.url,
    title: normalizeSearchText(document.meta?.title || document.url),
    excerpt: getExcerpt(document.content, terms, document.plain_excerpt, document.meta?.title),
    tags: normalizeSearchText(document.meta?.tags || ''),
  }
}

/** Search the indexed text literally for CJK, whose token boundaries vary by tokenizer. */
export function createBlogSearch(pagefind) {
  let documentsPromise
  return async (query) => {
    const terms = getSearchTerms(query)
    if (!terms.length)
      return []
    if (!han.test(query)) {
      const response = await pagefind.search(normalizeSearchText(query))
      const documents = await Promise.all(response.results.map(result => result.data()))
      return documents.map(document => getResult(document, terms))
    }

    // Pagefind fragments are fetched once and cached across searches. Using their full
    // indexed text avoids both prefix false positives and tokenizer false negatives.
    documentsPromise ??= pagefind.search(null)
      .then(response => Promise.all(response.results.map(result => result.data())))
      .catch((error) => {
        documentsPromise = undefined
        throw error
      })
    const documents = await documentsPromise
    return documents
      .filter((document) => {
        const text = normalizeSearchText(document.content).toLocaleLowerCase()
        return terms.every(term => text.includes(term))
      })
      .map((document) => {
        const result = getResult(document, terms)
        const title = result.title.toLocaleLowerCase()
        const tags = result.tags.toLocaleLowerCase()
        const score = terms.reduce((total, term) => total
          + (title === term ? 100 : title.includes(term) ? 30 : 0)
          + (tags.includes(term) ? 10 : 0), 0)
        return { ...result, score }
      })
      .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title, 'zh'))
  }
}
