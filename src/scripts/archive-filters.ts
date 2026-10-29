import { animateExitTransition, animateTextSwap, clearTransitionState, createDropdownController, runFlipTransition } from '@/scripts/filter-interactions'

type ArchiveSortKey = 'created' | 'updated'
type ArchiveRoot = HTMLElement & {
  __archiveCleanup?: () => void
}

function initArchiveInteractions() {
  const root = document.querySelector<ArchiveRoot>('[data-archive-root]')
  if (!root || root.dataset.archiveBound === '1')
    return

  const yearsContainer = root.querySelector<HTMLElement>('.archive-years')
  if (!yearsContainer)
    return

  const filterLabel = root.querySelector<HTMLElement>('[data-dropdown-label]')
  const sortLabel = root.querySelector<HTMLElement>('.archive-sort-label')
  const filterButtons = Array.from(root.querySelectorAll<HTMLElement>('.archive-filter-option[data-filter]'))
  const items = Array.from(root.querySelectorAll<HTMLElement>('.archive-item'))
  const years = Array.from(root.querySelectorAll<HTMLElement>('.archive-year'))
  const dropdown = createDropdownController(root.querySelector<HTMLElement>('[data-filter-dropdown]'))
  const originalYearOrder = years.slice()
  const originalItemsMap = new Map<HTMLElement, HTMLElement[]>()
  let currentSortKey: ArchiveSortKey = 'created'
  let transitionRequestId = 0

  years.forEach((year) => {
    originalItemsMap.set(year, Array.from(year.querySelectorAll<HTMLElement>('.archive-item')))
  })

  const getKeyTime = (item: HTMLElement, key: ArchiveSortKey) => {
    const value = key === 'updated' ? item.dataset.updated : item.dataset.created
    const time = Number(value)
    return Number.isFinite(time) ? time : 0
  }

  const isLayoutAnimating = () => root.dataset.layoutAnimating === '1'

  const updateFilterButtons = (filter: string) => {
    filterButtons.forEach((button) => {
      const isActive = button.dataset.filter === filter
      button.classList.toggle('is-active', isActive)
      button.setAttribute('aria-selected', isActive ? 'true' : 'false')

      if (!isActive || !filterLabel) {
        return
      }

      const nextLabel = button.dataset.triggerLabel || button.textContent?.trim() || '分类'
      if (filterLabel.textContent !== nextLabel) {
        filterLabel.textContent = nextLabel
        animateTextSwap(filterLabel)
      }
    })
  }

  const syncSortLabel = () => {
    if (!sortLabel) {
      return
    }

    const nextLabel = currentSortKey === 'updated' ? '更新日期' : '创建日期'
    if (sortLabel.textContent !== nextLabel) {
      sortLabel.textContent = nextLabel
      animateTextSwap(sortLabel)
    }
  }

  const reorderBySortKey = () => {
    const yearOrderIndex = new Map(originalYearOrder.map((year, index) => [year, index]))
    const yearEntries = years.map((year) => {
      const list = year.querySelector<HTMLElement>('.archive-list')
      const itemsInYear = originalItemsMap.get(year) ?? []
      const orderedItems = itemsInYear
        .slice()
        .sort((a, b) => getKeyTime(b, currentSortKey) - getKeyTime(a, currentSortKey))

      orderedItems.forEach(item => list?.appendChild(item))

      const visibleItems = orderedItems.filter(item => !item.classList.contains('is-hidden'))
      const maxTime = visibleItems.length > 0
        ? Math.max(...visibleItems.map(item => getKeyTime(item, currentSortKey)))
        : -1

      return { year, maxTime, index: yearOrderIndex.get(year) ?? 0 }
    })

    yearEntries
      .sort((a, b) => (b.maxTime - a.maxTime) || (a.index - b.index))
      .forEach(entry => yearsContainer.appendChild(entry.year))
  }

  let activeFilterValues: string[] = []

  const matchesFilter = (item: HTMLElement, filter: string, filterValues: string[]) => {
    const categories = (item.dataset.categories || '').split(',').filter(Boolean)
    return filter === 'all' || categories.some(category => filterValues.includes(category))
  }

  const clearExitState = () => {
    clearTransitionState(items)
    clearTransitionState(years)
  }

  const collectExitTargets = (filter: string, filterValues: string[]) => {
    const nextVisibleItems = new Set(items.filter(item => matchesFilter(item, filter, filterValues)))
    const exitingItems = items.filter(item => !item.classList.contains('is-hidden') && !nextVisibleItems.has(item))
    const exitingYears = years.filter((year) => {
      if (year.classList.contains('is-hidden')) {
        return false
      }

      const visibleItemsInYear = Array.from(year.querySelectorAll<HTMLElement>('.archive-item:not(.is-hidden)'))
      if (visibleItemsInYear.length === 0) {
        return false
      }

      return visibleItemsInYear.every(item => !nextVisibleItems.has(item))
    })

    return [...exitingItems, ...exitingYears]
  }

  const updateArchiveState = (filter: string) => {
    updateFilterButtons(filter)
    syncSortLabel()

    items.forEach((item) => {
      const match = matchesFilter(item, filter, activeFilterValues)
      item.classList.toggle('is-hidden', !match)
      item.setAttribute('aria-hidden', match ? 'false' : 'true')
      item.toggleAttribute('inert', !match)
    })

    years.forEach((year) => {
      year.classList.remove('is-active')
      const visibleItems = year.querySelectorAll('.archive-item:not(.is-hidden)')
      year.classList.toggle('is-hidden', visibleItems.length === 0)
      year.toggleAttribute('inert', visibleItems.length === 0)
    })

    reorderBySortKey()
  }

  const applyFilter = async (filter: string, filterValues: string[] = [], animate: boolean = true) => {
    const requestId = ++transitionRequestId
    const sync = () => updateArchiveState(filter)

    activeFilterValues = filterValues
    dropdown.close()
    clearExitState()

    if (animate) {
      const exitTargets = collectExitTargets(filter, filterValues)
      await animateExitTransition(exitTargets)
      if (requestId !== transitionRequestId) {
        return
      }

      clearExitState()
      runFlipTransition(root, ['.archive-item', '.archive-year'], sync)
    }
    else {
      clearExitState()
      sync()
    }
  }

  const applySort = (key: ArchiveSortKey, animate: boolean = true) => {
    transitionRequestId += 1
    clearExitState()
    const sync = () => {
      currentSortKey = key
      syncSortLabel()
      reorderBySortKey()
    }

    dropdown.close()

    if (animate) {
      runFlipTransition(root, ['.archive-item', '.archive-year'], sync)
    }
    else {
      sync()
    }
  }

  const interactionController = new AbortController()

  root.addEventListener('click', (event) => {
    const target = event.target
    if (!(target instanceof Element))
      return

    const filterButton = target.closest<HTMLElement>('.archive-filter-option[data-filter]')
    if (filterButton && root.contains(filterButton)) {
      const filterValues = (filterButton.dataset.filterValues || '')
        .split(',')
        .map(value => value.trim())
        .filter(Boolean)
      void applyFilter(filterButton.dataset.filter || 'all', filterValues)
      return
    }

    if (target.closest('[data-sort-button]')) {
      const nextSortKey: ArchiveSortKey = currentSortKey === 'created' ? 'updated' : 'created'
      applySort(nextSortKey)
    }
  }, { signal: interactionController.signal })

  root.addEventListener('pointerover', (event) => {
    if (isLayoutAnimating())
      return

    const target = event.target
    if (!(target instanceof Element))
      return

    const item = target.closest<HTMLElement>('.archive-item')
    if (!item || !root.contains(item))
      return

    item.closest<HTMLElement>('.archive-year')?.classList.add('is-active')
  }, { signal: interactionController.signal })

  root.addEventListener('pointerout', (event) => {
    if (isLayoutAnimating())
      return

    const target = event.target
    if (!(target instanceof Element))
      return

    const item = target.closest<HTMLElement>('.archive-item')
    if (!item || !root.contains(item))
      return

    const year = item.closest<HTMLElement>('.archive-year')
    const relatedTarget = event.relatedTarget
    const relatedNode = relatedTarget instanceof Node ? relatedTarget : null
    if (year && (!relatedNode || !year.contains(relatedNode))) {
      year.classList.remove('is-active')
    }
  }, { signal: interactionController.signal })

  root.addEventListener('focusin', (event) => {
    if (isLayoutAnimating())
      return

    const target = event.target
    if (!(target instanceof Element))
      return

    target.closest<HTMLElement>('.archive-item')?.closest<HTMLElement>('.archive-year')?.classList.add('is-active')
  }, { signal: interactionController.signal })

  root.addEventListener('focusout', (event) => {
    if (isLayoutAnimating())
      return

    const target = event.target
    if (!(target instanceof Element))
      return

    const year = target.closest<HTMLElement>('.archive-item')?.closest<HTMLElement>('.archive-year')
    const relatedTarget = event.relatedTarget
    const relatedNode = relatedTarget instanceof Node ? relatedTarget : null
    if (year && (!relatedNode || !year.contains(relatedNode))) {
      year.classList.remove('is-active')
    }
  }, { signal: interactionController.signal })

  root.dataset.archiveBound = '1'
  root.__archiveCleanup = () => {
    interactionController.abort()
    dropdown.destroy()
    delete root.dataset.archiveBound
    delete root.__archiveCleanup
  }

  const activeButton = root.querySelector<HTMLElement>('.archive-filter-option.is-active[data-filter]')
  const initialFilterValues = (activeButton?.dataset.filterValues || '')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean)
  void applyFilter(activeButton?.dataset.filter || 'all', initialFilterValues, false)
}

function cleanupArchiveInteractions() {
  document.querySelectorAll<ArchiveRoot>('[data-archive-root]').forEach(root => root.__archiveCleanup?.())
}

document.addEventListener('astro:page-load', initArchiveInteractions)
document.addEventListener('astro:before-swap', cleanupArchiveInteractions)

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initArchiveInteractions, { once: true })
}
else {
  initArchiveInteractions()
}
