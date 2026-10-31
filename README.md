# SlowMo's 办事处

这里是没长成文章的碎片想法，也有认真写下的东西。

基于 Astro 与 Retypeset，使用 pnpm 管理依赖，推送到 GitHub 后由 Vercel 自动部署。

## 写作速查

### 写普通文章

```bash
pnpm new-post "文章标题"
```

编辑 `src/content/posts/文章标题.md`，在 frontmatter 下面写正文。发布前至少确认：

```yaml
draft: false
visibility: public
```

### 写说说

```bash
# 创建空白说说，之后编辑正文
pnpm new-moment

# 直接创建一条说说
pnpm new-moment "今天发生了一件小事"

# 创建草稿说说
pnpm new-moment --draft "还没写完"
```

文件保存在 `src/content/moments/`，使用上海时区。说说只需要 `published` 与可选的 `draft` 字段，不需要标题、标签或分类。

### 预览与发布

```bash
# 写作时用这个：保存后自动更新，草稿也能看到
pnpm dev

# 发布前检查：构建成功再提交
pnpm build

# 预览构建后的静态站点；改文件后要重新构建才会更新
pnpm preview
```

开发预览通常是 `http://localhost:4321/`；静态预览占用 4321 时会使用 4322。

```bash
# 发布说说
git add src/content/moments/文件名.md
git commit -m "发布说说"
git push

# 发布文章
git add src/content/posts/文件名.md
git commit -m "发布文章：文章标题"
git push
```

先用 `git status --short` 检查提交范围。`git add src/content/posts` 不会包含说说。推送后 Vercel 会自动构建，通常需要几分钟。

## 常用字段

| 字段 | 含义 |
| --- | --- |
| `title` | 文章标题，必填 |
| `published` | 发布时间，决定排序与归档 |
| `description` | 摘要；留空时从正文提取 |
| `updated` | 更新时间；留空表示未更新 |
| `tags` | 自由填写的标签数组 |
| `categories` | 分类数组，现有：代码日常、随笔、碎碎念、杂谈、项目复盘 |
| `series` | 系列名，同名文章会显示系列导航 |
| `featured` | 是否加入首页精选 |
| `pin` | `0` 不置顶；`1–99` 置顶，越大越靠前 |
| `cover` | 文章头图，可填远程 URL 或 `/` 开头的 `public` 路径 |
| `status` | `idea`、`ongoing`、`paused`、`completed` |
| `draft` | `true` 为草稿，生产环境不显示；`dev` 仍可预览 |
| `visibility` | `public` 公开；`private` 在生产环境隐藏 |
| `toc` | 是否显示目录 |
| `lang` | 当前中文站点保持 `''` |
| `abbrlink` | 自定义 URL，只能用小写字母、数字和连字符；留空使用文件名 |

完整字段校验在 `src/content.config.ts`。

## 正文格式

支持标准 Markdown、表格、代码块、脚注、KaTeX 公式、Mermaid 图表与 MDX。

```md
![图片说明](https://img.theslowmo.com/2026/10/example.webp "width=78%")
```

图片宽度支持 `sm`、`md`、`lg`、`full`、百分比或像素值。`![_](图片地址)` 不显示图注。

```md
:::tip[提示]
支持 note、tip、important、warning、caution。
:::

:::fold[点击展开]
折叠内容。
:::
```

```md
::github{repo="hiSlowMo/astro-blog"}
::youtube{id="视频ID"}
::bilibili{id="BV号"}
```

## 维护

- `src/config.ts`：站点信息、颜色、评论、顶部轮换状态。
- `src/content.config.ts`：文章、关于页与说说的字段。
- `scripts/new-post.ts`：普通文章模板。
- `scripts/new-moment.ts`：说说模板。
- `src/generated/stats.json`：构建时自动更新，不用手动改。
- `pnpm format-posts`：整理所有内容的 Markdown 空格与标点。
- `pnpm check`：Astro 类型检查。
- `pnpm lint`：ESLint 检查。

本地图片可放在文章旁的 `_images/` 目录。字体维护资料位于 `assets/fonts/font-subset-list/`，不会随站点部署。

## 致谢

- [Retypeset](https://github.com/radishzzz/astro-theme-retypeset)
- [Astro](https://astro.build/)
- [Typography](https://github.com/moeyua/astro-theme-typography)
- [Fuwari](https://github.com/saicaca/fuwari)
- [Redefine](https://github.com/EvanNotFound/hexo-theme-redefine)
- [AstroPaper](https://github.com/satnaing/astro-paper)
- [heti](https://github.com/sivan/heti)
- [EarlySummerSerif](https://github.com/GuiWonder/EarlySummerSerif)
