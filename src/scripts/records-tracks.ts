import type { FriendTrack } from '@/data/friend-links'
import { formatRecordDate, RECORDS_API } from '@/utils/records'

function updateTrack(root: HTMLElement, track: FriendTrack, titleSelector: string) {
  const title = root.querySelector(titleSelector)
  if (title)
    title.textContent = track.title
  for (const link of Array.from(root.querySelectorAll<HTMLAnchorElement>('a[data-umami-event-url]'))) {
    link.href = track.url
    link.dataset.umamiEventUrl = track.url
  }
  const date = root.querySelector('time')
  if (date) {
    date.dateTime = track.date ?? ''
    date.textContent = formatRecordDate(track.date)
    date.hidden = !date.textContent
  }
  const separator = root.querySelector<HTMLElement>('[data-date-sep]')
  if (separator)
    separator.hidden = !date?.textContent
  const excerpt = root.querySelector<HTMLElement>('.spinning__excerpt')
  if (excerpt) {
    excerpt.textContent = track.excerpt ?? ''
    excerpt.hidden = !track.excerpt
  }
}

function validTrack(track: FriendTrack | null): track is FriendTrack {
  return !!track && typeof track.title === 'string' && !!track.title.trim()
    && typeof track.url === 'string' && /^https?:\/\//i.test(track.url)
    && (!track.date || typeof track.date === 'string') && (!track.excerpt || typeof track.excerpt === 'string')
}

async function refresh(deck: HTMLElement) {
  try {
    const response = await fetch(`${RECORDS_API}/tracks`, { signal: AbortSignal.timeout(8000) })
    if (!response.ok || !deck.isConnected)
      return
    const { albums } = await response.json()
    if (!Array.isArray(albums) || !deck.isConnected)
      return
    const candidates: HTMLElement[] = []
    for (const card of Array.from(document.querySelectorAll<HTMLElement>('article.album[id]'))) {
      const catalogNo = card.id.slice('record-'.length)
      const shells = Array.from(deck.querySelectorAll<HTMLElement>('[data-album]')).filter(el => el.dataset.album === catalogNo)
      const album = albums.find(item => item?.catalogNo === catalogNo)
      const tracks: FriendTrack[] = Array.isArray(album?.tracks) ? album.tracks.filter(validTrack).slice(0, 3) : []
      if (!tracks.length || !shells[0]) {
        candidates.push(...shells.filter(el => el.dataset.spin))
        continue
      }
      const latest = card.querySelector<HTMLElement>('.album__track')
      if (latest) {
        updateTrack(latest, tracks[0], '.album__track-title')
        latest.hidden = false
      }
      for (const track of tracks) {
        const shell = shells[0].cloneNode(true) as HTMLElement
        shell.dataset.spin = track.url
        updateTrack(shell, track, '.spinning__title a')
        candidates.push(shell)
      }
    }
    if (!candidates.length)
      return
    let previous = ''
    try {
      previous = sessionStorage.getItem('slowmo-records:last-live-spin') ?? ''
    }
    catch {}
    const fresh = candidates.filter(item => item.dataset.spin !== previous)
    const pool = fresh.length ? fresh : candidates
    const pick = pool[Math.floor(Math.random() * pool.length)]
    try {
      sessionStorage.setItem('slowmo-records:last-live-spin', pick.dataset.spin ?? '')
    }
    catch {}
    for (const item of candidates)
      item.hidden = item !== pick
    deck.replaceChildren(...candidates)
    deck.closest('section')!.hidden = false
  }
  catch {
  }
}

function schedule() {
  const deck = document.querySelector<HTMLElement>('[data-spinning]')
  if (!deck || deck.dataset.requested)
    return
  deck.dataset.requested = 'true'
  requestAnimationFrame(() => window.setTimeout(() => refresh(deck), 0))
}

document.addEventListener('astro:page-load', schedule)
schedule()
