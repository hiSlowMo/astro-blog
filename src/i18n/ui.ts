import type { Language } from '@/i18n/config'

interface Translation {
  title: string
  subtitle: string
  description: string
  posts: string
  tags: string
  about: string
  search: string
  archive: string
  links: string
  moments: string
  momentsIntro: string
  momentsEmpty: string
  momentsCount: string
  more: string
  searchPlaceholder: string
  searchNoResults: string
  searchClear: string
  searchOneResult: string
  searchManyResults: string
  searchNotReady: string
  linksEmpty: string
  toc: string
  series: string
  updatedAt: string
  readingMinutes: string
}

export const ui: Record<Language, Translation> = {
  zh: {
    title: '重新编排',
    subtitle: '再现版式之美',
    description: 'Retypeset是一款基于Astro框架的静态博客主题，中文名为重新编排。本主题以活版印字为设计灵感，通过建立全新的视觉规范，对所有页面进行重新编排，打造纸质书页般的阅读体验，再现版式之美。所见皆为细节，方寸尽显优雅。',
    posts: '文章',
    tags: '标签',
    about: '关于',
    search: '搜索',
    archive: '归档',
    links: '友链',
    moments: '说说',
    momentsIntro: '没长成文章的碎片想法，也值得留档。',
    momentsEmpty: '还没有说说，去写第一条吧。',
    momentsCount: '{COUNT} 条记录',
    more: '更多',
    searchPlaceholder: '搜索文章、标签或内容',
    searchNoResults: '没有找到相关结果哦',
    searchClear: '清除',
    searchOneResult: '1 条结果',
    searchManyResults: '{COUNT} 条结果',
    searchNotReady: '搜索索引尚未生成，请先执行构建命令。',
    linksEmpty: '暂无友链',
    toc: '目录',
    series: '系列文章',
    updatedAt: '更新于 {DATE}',
    readingMinutes: '{COUNT} 分钟',
  },
}
