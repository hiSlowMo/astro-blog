import type { APIRoute } from 'astro'
import comments from '@/styles/giscus/comments.css?raw'
import dark from '@/styles/giscus/theme-dark.css?raw'
import light from '@/styles/giscus/theme-light.css?raw'

export function getStaticPaths() {
  return [
    { params: { theme: 'theme-dark' }, props: { css: `${dark}\n${comments}` } },
    { params: { theme: 'theme-light' }, props: { css: `${light}\n${comments}` } },
  ]
}

export const GET: APIRoute = ({ props }) => new Response(props.css, {
  headers: {
    'Content-Type': 'text/css; charset=utf-8',
    'Access-Control-Allow-Origin': 'https://giscus.app',
  },
})
