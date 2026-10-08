import { animateExitTransition, animateTextSwap, clearTransitionState, createDropdownController, runFlipTransition } from '@/scripts/filter-interactions'

type PostSortKey = 'created' | 'updated'
type PostFilterRoot = HTMLElement & {
  __postFilterCleanup?: () => void
}

function initPostFilters() {
  const root = document.querySelector<PostFilterRoot>('[data-posts-root]')
  if (!root || root.dataset.filterBound === '1')
    return

  const triggerLabel = root.querySelector<HTMLElement>('[data-dropdown-label]')
  const sortLabel = root.querySelector<HTMLElement>('.post-sort-label')
  const buttons = Array.from(root.querySelectorAll<HTMLElement>('.post-filter-option[data-filter]'))
  const items = Array.from(root.querySelectorAll<HTMLElement>('.post-item'))
  const sections = Array.from(root.querySelectorAll<HTMLElement>('.post-year-section'))
  const sortableSections = sections.filter(section =>
    !section.classList.contains('post-year-section--pinned')
    && !section.classList.contains('post-year-section--featured'),
  )
  const dropdown = createDropdownController(root.querySelector<HTMLElement>('[data-filter-dropdown]'))
  const originalSectionOrder = sortableSections.slice()
  const originalItemsMap = new Map<HTMLElement, HTMLElement[]>()
  let currentSortKey: PostSortKey = 'created'
  let transitionRequestId = 0

  sortableSections.forEach((section) => {
    originalItemsMap.set(section, Array.from(section.querySelectorAll<HTMLElement>('.post-item')))
  })

  const getKeyTime = (item: HTMLElement, key: PostSortKey) => {
    const value = key === 'updated' ? item.dataset.updated : item.dataset.created
    const time = Number(value)
    return Number.isFinite(time) ? time : 0
  }

  const updateButtons = (filter: string) => {
    buttons.forEach((button) => {
      const isActive = button.dataset.filter === filter
      button.classList.toggle('is-active', isActive)
      button.setAttribute('aria-selected', isActive ? 'true' : 'false')

      if (!isActive || !triggerLabel) {
        return
      }

      const nextLabel = button.dataset.triggerLabel || button.textContent?.trim() || '全部分类'
      if (triggerLabel.textContent !== nextLabel) {
        triggerLabel.textContent = nextLabel
        animateTextSwap(triggerLabel)
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

  const matchesFilter = (item: HTMLElement, filter: string, filterValues: string[]) => {
    const categories = (item.dataset.categories || '').split(',').filter(Boolean)
    return filter === 'all' || categories.some(category => filterValues.includes(category))
  }

  const clearExitState = () => {
    clearTransitionState(items)
    clearTransitionState(sections)
  }

  const collectExitTargets = (filter: string, filterValues: string[]) => {
    const nextVisibleItems = new Set(items.filter(item => matchesFilter(item, filter, filterValues)))
    const exitingItems = items.filter(item => !item.classList.contains('is-hidden') && !nextVisibleItems.has(item))
    const exitingSections = sections.filter((section) => {
      if (section.classList.contains('is-hidden')) {
        return false
      }

      const visibleItemsInSection = Array.from(section.querySelectorAll<HTMLElement>('.post-item:not(.is-hidden)'))
      if (visibleItemsInSection.length === 0) {
        return false
      }

      return visibleItemsInSection.every(item => !nextVisibleItems.has(item))
    })

    return [...exitingItems, ...exitingSections]
  }

  const reorderBySortKey = () => {
    const sectionOrderIndex = new Map(originalSectionOrder.map((section, index) => [section, index]))
    const sectionEntries = sortableSections.map((section) => {
      const list = section.querySelector<HTMLElement>('ul')
      const itemsInSection = originalItemsMap.get(section) ?? []
      const orderedItems = itemsInSection
        .slice()
        .sort((a, b) => getKeyTime(b, currentSortKey) - getKeyTime(a, currentSortKey))

      orderedItems.forEach(item => list?.appendChild(item))

      const visibleItems = orderedItems.filter(item => !item.classList.contains('is-hidden'))
      const maxTime = visibleItems.length > 0
        ? Math.max(...visibleItems.map(item => getKeyTime(item, currentSortKey)))
        : -1

      return {
        section,
        maxTime,
        index: sectionOrderIndex.get(section) ?? 0,
      }
    })

    sectionEntries
      .sort((a, b) => (b.maxTime - a.maxTime) || (a.index - b.index))
      .forEach(entry => root.appendChild(entry.section))
  }

  let activeFilterValues: string[] = []

  const updatePostState = (filter: string) => {
    updateButtons(filter)
    syncSortLabel()

    items.forEach((item) => {
      const match = matchesFilter(item, filter, activeFilterValues)
      item.classList.toggle('is-hidden', !match)
      item.setAttribute('aria-hidden', match ? 'false' : 'true')
    })

    sections.forEach((section) => {
      const visibleItems = section.querySelectorAll('.post-item:not(.is-hidden)')
      section.classList.toggle('is-hidden', visibleItems.length === 0)
    })

    reorderBySortKey()
  }

  const applyFilter = async (filter: string, filterValues: string[] = [], animate: boolean = true) => {
    const requestId = ++transitionRequestId
    const sync = () => updatePostState(filter)

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
      runFlipTransition(root, ['.post-item', '.post-year-section'], sync)
    }
    else {
      clearExitState()
      sync()
    }
  }

  const applySort = (key: PostSortKey, animate: boolean = true) => {
    transitionRequestId += 1
    clearExitState()
    const sync = () => {
      currentSortKey = key
      syncSortLabel()
      reorderBySortKey()
    }

    dropdown.close()

    if (animate) {
      runFlipTransition(root, ['.post-item', '.post-year-section'], sync)
    }
    else {
      sync()
    }
  }

  const handleClick = (event: Event) => {
    const target = event.target
    if (!(target instanceof Element))
      return

    const button = target.closest<HTMLElement>('.post-filter-option[data-filter]')
    if (button && root.contains(button)) {
      const filterValues = (button.dataset.filterValues || '')
        .split(',')
        .map(value => value.trim())
        .filter(Boolean)
      void applyFilter(button.dataset.filter || 'all', filterValues)
      return
    }

    if (target.closest('[data-sort-button]')) {
      const nextSortKey: PostSortKey = currentSortKey === 'created' ? 'updated' : 'created'
      applySort(nextSortKey)
    }
  }

  root.addEventListener('click', handleClick)
  root.dataset.filterBound = '1'
  root.__postFilterCleanup = () => {
    root.removeEventListener('click', handleClick)
    dropdown.destroy()
    delete root.dataset.filterBound
    delete root.__postFilterCleanup
  }

  const activeButton = root.querySelector<HTMLElement>('.post-filter-option.is-active[data-filter]')
  const initialFilterValues = (activeButton?.dataset.filterValues || '')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean)
  void applyFilter(activeButton?.dataset.filter || 'all', initialFilterValues, false)
}

function cleanupPostFilters() {
  document.querySelectorAll<PostFilterRoot>('[data-posts-root]').forEach(root => root.__postFilterCleanup?.())
}

document.addEventListener('astro:page-load', initPostFilters)
document.addEventListener('astro:before-swap', cleanupPostFilters)

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPostFilters, { once: true })
}
else {
  initPostFilters()
}
