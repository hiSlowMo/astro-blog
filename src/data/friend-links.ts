export interface FriendLink {
  name: string
  url: string
  description?: string
}

export interface SiteInfoField {
  name: string
  value: string
}

export const friendLinks: FriendLink[] = [
  {
    name: 'WEP',
    url: 'https://taoran.weppp.cyou/',
    description: 'How\'s your day been?',
  },
  {
    name: '記緒漂流',
    url: 'https://ttio.cc',
    description: '于记忆之川，泛思绪之舟。',
  },
]

export const websiteLinks: FriendLink[] = []

export const siteInfo: SiteInfoField[] = [
  { name: 'Name', value: 'SlowMo\'s 办事处' },
  { name: 'Desc', value: '我们的头脑比天空更辽阔。' },
  { name: 'Link', value: 'https://theslowmo.com' },
  { name: 'Avatar', value: 'https://theslowmo.com/icons/avatar.png' },
]

export const applyRules: string[] = [
  '无广告，无政治敏感及违法内容',
  '保证大部分内容原创，转载注明出处',
  'Love & Peace',
]
