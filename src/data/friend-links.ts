export interface FriendLink {
  name: string
  url: string
  description?: string
}

/** A post from a friend's blog: one track on its album. */
export interface FriendTrack {
  title: string
  url: string
  /** Publish date as YYYY-MM-DD, in the author's own timezone. */
  date?: string
  /** Shown when the track comes up in NOW SPINNING. The author's own words only. */
  excerpt?: string
}

/** A friend's blog, presented as an album in THE SLOWMO RECORDS. */
export interface FriendAlbum extends FriendLink {
  /** Stable catalog number. Never reuse or renumber an existing one. */
  catalogNo: string
  artist?: string
  /**
   * The album cover: the favicon the site declares in its own <head>. Never draw one by hand,
   * use an og:image, or guess the address. A path relative to the site's url is allowed.
   */
  icon?: string
  /** The site's apple-touch-icon, tried when the favicon fails to load. Same rules as icon. */
  appleTouchIcon?: string
  /** Natural pixel size of a raster favicon; the cover never enlarges it past this. Leave out for SVG. */
  iconSize?: number
  /** The colour the icon is drawn on, so a small icon sits on a seamless square. */
  iconBackground?: string
  /** Optional explicit RSS or Atom feed for the sync job. */
  rss?: string
  genres?: string[]
  /** Date the blog joined the collection, as YYYY-MM-DD. Drives NEW ARRIVALS. */
  addedAt?: string
  /**
   * Real posts picked by hand, newest first. The album card shows only the newest one as its
   * LATEST TRACK; NOW SPINNING draws from all of them. Never invent one.
   */
  tracks?: FriendTrack[]
}

/** This site's own card: what friends copy into their link pages. */
export interface SiteProfile {
  name: string
  description: string
  url: string
  /** Real site icon */
  icon: string
  /** Leave out to hide the feed button */
  rss?: string
}

// Icons and feeds checked against each site's own <head> on 2026-11-18.
export const friendLinks: FriendAlbum[] = [
  {
    catalogNo: '001',
    name: 'WEP',
    url: 'https://taoran.weppp.cyou/',
    description: 'How\'s your day been?',
    artist: 'WEP',
    // <link rel="icon" type="image/svg+xml">, a white W on a #161616 rounded square
    icon: 'https://taoran.weppp.cyou/icon.svg',
    iconBackground: '#161616',
    rss: 'https://taoran.weppp.cyou/rss.xml',
    genres: ['AI', 'Agent', 'LLM'],
    addedAt: '2026-11-17',
    tracks: [
      {
        title: '莫名爆火的项目，这流量我是真吃不下，流程记录',
        url: 'https://taoran.weppp.cyou/posts/github-hghub',
        date: '2026-11-10',
        excerpt: '开源后不到三天，stars 莫名涨到了 1k+ ，很诧异，但这个repo太新，traffic 都没数据。',
      },
      {
        title: '基于deepseek的一些行为的感悟——《当没有人给 AI 下命令时，它会做什么？》',
        url: 'https://taoran.weppp.cyou/posts/deepseek',
        date: '2026-09-08',
        excerpt: '我很喜欢跟 AI 日常聊天，聊各种有的没的，但是又比较注重隐私，于是自己搞了个跨端的日常聊天软件。',
      },
      {
        title: 'Mechanically Strong, Cognitively Weak：我对 Agent Harness 的一次认知修正',
        url: 'https://taoran.weppp.cyou/posts/agent',
        date: '2026-08-09',
        excerpt: '但在继续学习和实践 Agent 的过程中，我发现，自己过去对“弱 Harness”的理解存在一个很大的偏差。',
      },
    ],
  },
  {
    catalogNo: '002',
    name: '記緒漂流',
    url: 'https://ttio.cc',
    description: '于记忆之川，泛思绪之舟。',
    artist: 'TuyuriTio',
    // <link rel="icon" sizes="96x96">, black line art on white
    icon: 'https://ttio.cc/favicon-96x96.png',
    iconSize: 96,
    iconBackground: '#ffffff',
    rss: 'https://ttio.cc/feed.xml',
    genres: ['Network', 'Anime', 'Mindset'],
    addedAt: '2026-11-18',
    tracks: [
      {
        title: 'Tailscale 内网 HTTPS 统一路由方案',
        url: 'https://ttio.cc/jotting/tailscale-https',
        date: '2026-09-30',
        excerpt: '带有端口的 Docker 访问方式并非长久之计，通过子域名访问相对更具备语义，同时还能解决 HTTPS 的支持问题。',
      },
      {
        title: 'Cloudflare One 集成 OAuth 访问控制',
        url: 'https://ttio.cc/jotting/cloudflare-one-oauth',
        date: '2026-05-01',
        excerpt: '本文介绍笔者使用 Cloudflare One 集成 GitHub OAuth 访问控制，为无认证的记账 Web 端添加简洁身份验证，保障个人应用安全。',
      },
      {
        title: '打造专属记账助手',
        url: 'https://ttio.cc/note/accounting-bot',
        date: '2026-04-27',
        excerpt: '本文记述笔者从快捷记账转向beancount，并利用Telegram Bot与AI自行开发自动化记账工具的历程与反思。',
      },
    ],
  },
  {
    catalogNo: '003',
    name: 'Frederick\'s Blog',
    url: 'https://www.ooowl.net/',
    description: 'Sky is the limit/',
    artist: 'Frederick Chen',
    icon: 'https://www.ooowl.net/favicon.svg',
    rss: 'https://www.ooowl.net/atom.xml',
    genres: ['Life', 'Notes', 'Thoughts'],
    addedAt: '2026-11-22',
    tracks: [
      {
        title: '我在用什么：2026',
        url: 'https://www.ooowl.net/posts/what-im-using-2026/',
        date: '2026-11-01',
      },
    ],
  },
]

export const websiteLinks: FriendLink[] = []

export const siteProfile: SiteProfile = {
  name: 'SlowMo\'s 办事处',
  description: '我们的头脑比天空更辽阔。',
  url: 'https://theslowmo.com',
  icon: 'https://theslowmo.com/icons/avatar.png',
  rss: 'https://theslowmo.com/rss.xml',
}

export const applyRules: string[] = [
  '无广告，无政治敏感及违法内容',
  '保证大部分内容原创，转载注明出处',
  'Love & Peace',
]
