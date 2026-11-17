import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import remarkParse from 'remark-parse'
import { unified } from 'unified'
import { EXIT, visit } from 'unist-util-visit'

// Parse with the same remark-math and GFM configuration as the build pipeline
// so detection matches what rehype-katex will actually render, including inline
// math that spans line endings.
const mathParser = unified().use(remarkParse).use(remarkGfm).use(remarkMath)

export function hasMathContent(body?: string | null, filePath?: string | null): boolean {
  if (!body) {
    return false
  }

  // MDX bodies are raw JSX. remark-parse sees JSX blocks as raw HTML, so it
  // cannot see math inside component children. Always load KaTeX for MDX to
  // avoid unstyled formulas; the stylesheet itself is deferred.
  if (filePath?.toLowerCase().endsWith('.mdx')) {
    return true
  }

  // Pre-rendered KaTeX or micromark math HTML has no dollar delimiters, but
  // still needs the stylesheet.
  if (body.includes('class="katex') || body.includes('class=\'katex')
    || body.includes('math-inline') || body.includes('math-display')) {
    return true
  }

  let hasMath = false
  visit(mathParser.parse(body), (node) => {
    if (node.type === 'inlineMath' || node.type === 'math') {
      hasMath = true
      return EXIT
    }
  })

  return hasMath
}
