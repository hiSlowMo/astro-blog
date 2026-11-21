import { fileURLToPath } from 'node:url'
import mdx from '@astrojs/mdx'
import partytown from '@astrojs/partytown'
import sitemap from '@astrojs/sitemap'
import { defineConfig } from 'astro/config'
import rehypeKatex from 'rehype-katex'
import rehypeSlug from 'rehype-slug'
import remarkDirective from 'remark-directive'
import remarkMath from 'remark-math'
import UnoCSS from 'unocss/astro'
import { base, defaultLocale, themeConfig } from './src/config'
import { langMap } from './src/i18n/config'
import { rehypeCodeCopyButton } from './src/plugins/rehype-code-copy-button.mjs'
import { rehypeExternalLinks } from './src/plugins/rehype-external-links.mjs'
import { rehypeHeadingAnchor } from './src/plugins/rehype-heading-anchor.mjs'
import { rehypeImageProcessor } from './src/plugins/rehype-image-processor.mjs'
import { rehypeMermaidSource } from './src/plugins/rehype-mermaid-source.mjs'
import { rehypePagefindOptimize } from './src/plugins/rehype-pagefind-optimize.mjs'
import { rehypeParagraphEndings } from './src/plugins/rehype-paragraph-endings.mjs'
import { remarkContainerDirectives } from './src/plugins/remark-container-directives.mjs'
import { remarkLeafDirectives } from './src/plugins/remark-leaf-directives.mjs'
import { remarkReadingTime } from './src/plugins/remark-reading-time.mjs'

const site = themeConfig.seo?.canonicalOrigin || themeConfig.site.url
const { imageHostURL } = themeConfig.preload ?? {}
const imageConfig = imageHostURL
  ? {
      image: {
        domains: [imageHostURL],
        remotePatterns: [{ protocol: 'https' }],
        layout: 'constrained' as const,
        breakpoints: [640, 960, 1280, 1600],
        responsiveStyles: true,
      },
    }
  : {}

// Exclude inactive providers before Astro/Vite collect their client scripts and assets.
// Changing src/config.ts enables the original component again on the next build.
const commentProviders = {
  Giscus: themeConfig.comment.giscus?.repo,
  Twikoo: themeConfig.comment.twikoo?.envId,
  Waline: themeConfig.comment.waline?.serverURL,
}
const inactiveCommentAliases = Object.entries(commentProviders)
  .filter(([, setting]) => !themeConfig.comment.enabled || !setting?.trim())
  .map(([name]) => ({
    find: `@/components/Comment/${name}.astro`,
    replacement: fileURLToPath(new URL('./src/components/Comment/Disabled.astro', import.meta.url)),
  }))

export default defineConfig({
  site,
  base,
  trailingSlash: 'always', // Not recommended to change
  prefetch: {
    // Fetch same-origin destinations on hover/focus, before the click.
    // Astro falls back to tap on slow connections or when Save-Data is enabled.
    prefetchAll: true,
    defaultStrategy: 'hover',
  },
  ...imageConfig,
  i18n: {
    locales: Object.entries(langMap).map(([path, codes]) => ({
      path,
      codes: [...codes] as [string, ...string[]],
    })),
    defaultLocale,
  },
  integrations: [
    UnoCSS({
      injectReset: true,
    }),
    mdx(),
    partytown({
      config: {
        forward: ['dataLayer.push', 'gtag'],
      },
    }),
    sitemap(),
  ],
  markdown: {
    remarkPlugins: [
      remarkDirective,
      remarkMath,
      remarkContainerDirectives,
      remarkLeafDirectives,
      remarkReadingTime,
    ],
    rehypePlugins: [
      rehypeKatex,
      rehypeMermaidSource,
      rehypeSlug,
      rehypeHeadingAnchor,
      rehypeImageProcessor,
      rehypePagefindOptimize,
      rehypeParagraphEndings,
      rehypeExternalLinks,
      rehypeCodeCopyButton,
    ],
    syntaxHighlight: {
      type: 'shiki',
      excludeLangs: ['mermaid'],
    },
    shikiConfig: {
      // Available themes: https://shiki.style/themes
      themes: {
        light: 'github-light',
        dark: 'github-dark',
      },
    },
  },
  vite: {
    resolve: { alias: inactiveCommentAliases },
    server: {
      proxy: {
        '/__records-preview/site-metadata': {
          target: 'http://127.0.0.1:18735',
          rewrite: () => '/records/v1/site-metadata',
          headers: { Origin: 'https://www.theslowmo.com' },
        },
      },
    },
  },
  // Astro uses server.headers for both dev and preview; Vite preview hooks
  // from the user config are not loaded by `astro preview`.
  server: {
    headers: { 'Access-Control-Allow-Origin': 'https://giscus.app' },
  },
  devToolbar: {
    enabled: false,
  },
})
