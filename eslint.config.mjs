import antfu from '@antfu/eslint-config'

export default antfu(
  {
    typescript: true,
    astro: true,
    unocss: true,
  },
  {
    // Markdown 行尾两个空格是硬换行，不能被 lint --fix 删掉
    files: ['**/*.md'],
    rules: {
      'style/no-trailing-spaces': 'off',
    },
  },
)
