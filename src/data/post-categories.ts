export interface PostCategoryOption {
  label: string
  value: string
  icon: string
  order: number
  matches?: string[]
}

const categories: PostCategoryOption[] = [
  {
    label: '代码日常',
    value: '代码日常',
    order: 10,
    icon: '<svg viewBox="0 0 20 20" width="1em" height="1em" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.5" d="m7.5 6-4 4 4 4M12.5 6l4 4-4 4M9 15.5l2-11"/></svg>',
  },
  {
    label: '随笔',
    value: '随笔',
    order: 20,
    matches: ['随笔', '生活随笔'],
    icon: '<svg viewBox="0 0 20 20" width="1em" height="1em" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.5" d="M10 3.5c3.5 2.2 4.5 6.2 2.8 9.1C11 15.5 7.5 16.5 5.5 14c2.7 0 4.8-1.2 5.7-3.1 1-2.2.3-4.8-1.2-6.3Z"/></svg>',
  },
  {
    label: '碎碎念',
    value: '碎碎念',
    order: 30,
    icon: '<svg viewBox="0 0 20 20" width="1em" height="1em" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.5" d="M3.5 6.5h13M3.5 10h13M3.5 13.5h9"/></svg>',
  },
  {
    label: '杂谈',
    value: '杂谈',
    order: 40,
    icon: '<svg viewBox="0 0 20 20" width="1em" height="1em" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.5" d="M4 5.5h12a2 2 0 0 1 2 2v6.5a2 2 0 0 1-2 2H8l-4 3v-3H4a2 2 0 0 1-2-2V7.5a2 2 0 0 1 2-2Z"/></svg>',
  },
  {
    label: '项目复盘',
    value: '项目复盘',
    order: 50,
    icon: '<svg viewBox="0 0 20 20" width="1em" height="1em" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.5" d="M6 3.5h8l2 2V16a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 4 16V5a2 2 0 0 1 2-1.5Z"/><path fill="none" stroke="currentColor" stroke-width="1.5" d="M7.5 8.5h5M7.5 12h5"/></svg>',
  },
]

export const postCategoryFilters = categories
  .slice()
  .sort((a, b) => a.order - b.order)

// 只保留至少有一篇文章的分类，避免筛选出空列表
export function getUsedCategoryFilters(posts: { data: { categories?: string[] } }[]) {
  const used = new Set(posts.flatMap(post => post.data.categories ?? []))
  return postCategoryFilters.filter(category =>
    (category.matches ?? [category.value]).some(value => used.has(value)),
  )
}
