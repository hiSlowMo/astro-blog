import { siteProfile } from './friend-links'

export const shareCards = {
  home: { title: siteProfile.name, description: siteProfile.description },
  records: { title: 'THE SLOWMO RECORDS', description: '独立博客唱片目录 · 每张专辑是一位创作者，每首曲目是一篇文章。' },
  submit: { title: '推荐一张专辑', description: 'THE SLOWMO RECORDS · 提交你的博客，加入友链唱片目录。' },
}

export type ShareCard = keyof typeof shareCards
