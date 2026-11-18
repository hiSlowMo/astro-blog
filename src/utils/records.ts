import type { FriendAlbum, FriendTrack } from '@/data/friend-links'

export const RECORDS_API = 'https://api.theslowmo.com/records/v1'

/** NEW ARRIVALS only appears once the collection holds this many albums. */
const NEW_ARRIVALS_MIN_ALBUMS = 5
/** NEW ARRIVALS shows this many of the most recently added albums. */
const NEW_ARRIVAL_LIMIT = 3
/** THE COLLECTION lists this many albums before folding the rest behind 展开更多. */
export const COLLECTION_PREVIEW_LIMIT = 8

/** Parse a YYYY-MM-DD string as a calendar day (UTC midnight), so no timezone shifts it. */
export function parseDay(value?: string): Date | undefined {
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) {
    return undefined
  }
  const [, year, month, day] = match
  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)))
}

/** 2026-09-30 -> SEP 30, 2026 */
export function formatRecordDate(value?: string): string {
  const date = parseDay(value)
  if (!date) {
    return ''
  }
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date).toUpperCase()
}

export function padNumber(value: number, length = 2): string {
  return String(value).padStart(length, '0')
}

const dayValue = (value?: string) => parseDay(value)?.valueOf() ?? 0

/** The album card's LATEST TRACK: the newest of the blog's hand-picked posts. */
export function getLatestTrack(album: FriendAlbum): FriendTrack | undefined {
  return [...(album.tracks ?? [])].sort((a, b) => dayValue(b.date) - dayValue(a.date))[0]
}

export interface SpinningTrack {
  album: FriendAlbum
  track: FriendTrack
}

/**
 * Every hand-picked post on every album, newest first. NOW SPINNING renders them all and the
 * browser picks one at random on each visit; the first one is what readers without JavaScript see.
 */
export function getSpinningCandidates(albums: FriendAlbum[]): SpinningTrack[] {
  return albums
    .flatMap(album => (album.tracks ?? []).map(track => ({ album, track })))
    .sort((a, b) => dayValue(b.track.date) - dayValue(a.track.date))
}

/**
 * The most recently added albums, newest first. Empty while the collection is small enough
 * that THE COLLECTION already shows everything at a glance.
 */
export function getNewArrivals(albums: FriendAlbum[]): FriendAlbum[] {
  if (albums.length < NEW_ARRIVALS_MIN_ALBUMS) {
    return []
  }
  return albums
    .filter(album => parseDay(album.addedAt) !== undefined)
    .sort((a, b) => dayValue(b.addedAt) - dayValue(a.addedAt))
    .slice(0, NEW_ARRIVAL_LIMIT)
}

/** Resolve an image address against the site it belongs to, so a relative path still works. */
function toAbsoluteUrl(value: string | undefined, base: string): string | undefined {
  if (!value?.trim()) {
    return undefined
  }
  try {
    const url = new URL(value.trim(), base)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : undefined
  }
  catch {
    return undefined
  }
}

export interface CoverSource {
  /** First choice: the favicon */
  src?: string
  /** Tried when the first choice fails to load: the apple-touch-icon */
  fallbackSrc?: string
  /** Natural pixel size of a raster favicon, so it is never enlarged past it */
  size?: number
  background?: string
}

/** The album cover is the site's own icon: favicon first, then apple-touch-icon. */
export function getCoverSource(album: Pick<FriendAlbum, 'url' | 'icon' | 'appleTouchIcon' | 'iconSize' | 'iconBackground'>): CoverSource {
  const favicon = toAbsoluteUrl(album.icon, album.url)
  const touchIcon = toAbsoluteUrl(album.appleTouchIcon, album.url)
  const src = favicon ?? touchIcon
  return {
    src,
    fallbackSrc: touchIcon && touchIcon !== src ? touchIcon : undefined,
    size: favicon ? album.iconSize : undefined,
    background: album.iconBackground,
  }
}
