import { visit } from 'unist-util-visit'

export function rehypeParagraphEndings() {
  return (tree, file) => {
    if (!/(?:^|[/\\])src[/\\]content[/\\]posts[/\\]/.test(file.path ?? ''))
      return

    visit(tree, 'element', (paragraph) => {
      if (paragraph.tagName !== 'p')
        return

      let parent = paragraph
      let last = parent.children.at(-1)
      while (last?.type === 'element' && ['a', 'em', 'strong', 'del'].includes(last.tagName)) {
        parent = last
        last = parent.children.at(-1)
      }
      if (last?.type !== 'text')
        return

      const ending = /\p{Script=Han}{2}[。！？…]*[”’」』】）]*$/u.exec(last.value)
      if (!ending)
        return

      last.value = last.value.slice(0, ending.index)
      parent.children.push({
        type: 'element',
        tagName: 'span',
        properties: { className: ['paragraph-ending'] },
        children: [{ type: 'text', value: ending[0] }],
      })
    })
  }
}
