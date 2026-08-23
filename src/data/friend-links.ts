export interface FriendLink {
  name: string
  url: string
  description?: string
}

export interface SiteInfoField {
  name: string
  value: string
}

export const friendLinks: FriendLink[] = []

export const websiteLinks: FriendLink[] = [
  {
    name: '开往',
    url: 'https://www.travellings.cn/go.html',
    description: '随机前往开往成员的博客',
  },
]

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
