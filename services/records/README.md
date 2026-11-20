# THE SLOWMO RECORDS 运维

正式 API 位于 `https://api.theslowmo.com/records/v1`。东京 Caddy 根据 `/records/v1/*` 转发，通过专用 SSH 隧道访问华为云的 `127.0.0.1:18735`。华为云使用 Ubuntu 仓库中的 `gunicorn`、`python3-flask` 和 `python3-feedparser`。Caddy 的路由片段见 `caddy-route.txt`。

| 请求 | 返回 |
| --- | --- |
| `GET /health` | API 和数据库就绪时返回 `200` |
| `POST /site-metadata` | 传入 `{ "url": "https://example.org/" }`，返回首页声明的 `name`、`description`、`icon`、`rss`，缺失字段省略。仅预填资料。读取失败返回 `422`，服务忙或超过频率限制返回 `429` |
| `GET /tracks` | `albums[]` 含 `catalogNo`、`source`、`updatedAt` 和最多三条 `tracks`。时间戳 `updatedAt` 使用 Unix 秒。曲目含标题、网址、摘要及 Feed 提供的日期 |
| `POST /applications` | JSON 请求。保存成功返回 `201` 和 `{ "id": "SR-…", "status": "pending" }`。重复申请返回 `409`，字段错误返回 `422`，超过限制返回 `429` |

表单必填 `name`、`url`、`artist`、`email`、`description`、`icon` 和布尔值 `rules: true`。选填 `cover`、`rss`、`article` 和 `genres`。站长通知邮件附完整申请资料和编号，可直接在收件箱审阅，再用编号办理收录。

`astro dev` 将表单的抓取请求转发至 `127.0.0.1:18735`。在 `services/records` 中使用安装了 Flask 和 feedparser 的 Python 环境，设置 `RECORDS_STATE` 指向本地测试目录，运行 `python jobs.py init`，然后运行 `flask --app app run --port 18735` 即可联调。静态构建使用正式 Records API。

## 按邮件编号审核

用 `ssh huawei-flexus` 登录华为云，将下列编号换成邮件里的完整编号。

```sh
cd /srv/apps/slowmo-records
sudo -u slowmo-records python3 review.py show SR-实际编号
sudo -u slowmo-records python3 review.py entry SR-实际编号
```

`show` 显示完整申请，供站长核对网站、友链回链及代表文章。决定收录后，用 `entry` 生成可复制到本地 `src/data/friend-links.ts` 的公开条目。建议编号取自服务器目录，添加时核对本地 `catalogNo` 唯一。若要收录代表文章，打开原文核对标题，在 `tracks` 中填入标题与链接。

将条目加入 `friendLinks`，按照下文导出并同步目录到华为云，再发布更新后的 Astro 友链页。打开 `/links/` 核对新专辑后，回到华为云服务目录执行 `sudo -u slowmo-records python3 review.py approve SR-实际编号` 登记 `approved`。重复执行返回同一收录编号。`approve` 会核对服务器目录中的站点。

## 曲目和定时任务

在博客的 `src/data/friend-links.ts` 中编辑专辑、RSS 和手工文章。用 Node 22.18+ 在仓库根目录执行 `node services/records/export-catalog.mjs`，再将生成的 `catalog.json` 安装到华为云 `/srv/apps/slowmo-records/catalog.json`。更新曲目时先验证新文件，再原子替换线上文件。只有经过人工审核加入目录的站点才会定期同步 RSS。已保存的申请不会自动进入目录。

以下命令在华为云执行。站长可用第一条命令按编号查看完整记录。

```sh
cd /srv/apps/slowmo-records
sudo -u slowmo-records python3 -c 'import sqlite3,sys; db=sqlite3.connect("file:/var/lib/slowmo-records/records.sqlite?mode=ro",uri=True); row=db.execute("SELECT payload,status,mail FROM applications WHERE id=?",(sys.argv[1],)).fetchone(); print(row if row else "没有此编号")' SR-实际编号
systemctl list-timers 'slowmo-records*'
systemctl start slowmo-records@sync
systemctl start slowmo-records@notify
systemctl start slowmo-records@backup
journalctl -u slowmo-records@sync -n 25
sudo -u slowmo-records /usr/bin/python3 check.py
```

Feed 每半小时更新。每五分钟处理到期的通知，失败后延迟重试。`slowmo-records-notify` Worker 使用受限的 `send-email` 绑定，目标为 `me@theslowmo.com` 转发规则中已验证的实际收件人。华为云只持有此通知接口的密钥。配置位于 root 专用的 `/etc/slowmo-records/mail.env`。`mail=accepted` 表示 Worker 接受了通知。如果进程在发送后、记录结果前中止，重试可能产生相同编号的通知。

## 备份和恢复

SQLite 文件位于 `/var/lib/slowmo-records/records.sqlite`。每日备份通过 SQLite 在线快照生成，校验成功后才替换目标文件。在同机 `backups` 子目录保留最近 14 份。异机保存时只复制完整的备份文件，按包含私人邮箱的数据管理。

先将选定的备份复制到临时目录，用 SQLite 执行 `PRAGMA integrity_check` 并核对申请数量。实际恢复时暂停 API、定时器及正在运行的作业，留存当前数据库及 `-wal`、`-shm` 文件，将验证过的快照以 `slowmo-records` 所有者和 `0600` 权限安装到原位，然后重新启动。恢复会回到快照时刻，之后提交的申请需要单独迁移。

## 页面发布

正式博客的 `/links/`、`/links/submit/` 和 `/links/_records-assets/*` 使用 `slowmo-records-pages` Worker。它分发本次 Astro 构建生成的两个页面，复用原博客的导航和资源。它在后台检查 Vercel 上的页面，检测到包含对应功能的新页面后，将该入口的请求交回源站。检查结果在每个边缘节点缓存五分钟。

重新发布这两个页面时，在仓库根目录完成 `pnpm build`，然后在空的临时目录生成并校验发布包。

```sh
release=$(mktemp -d)
node services/records/web-release/prepare.mjs "$release"
(cd "$release" && cf deploy --prebuilt --dry-run && cf deploy --prebuilt)
```

待 GitHub/Vercel 正式发布同一版页面后，可以通过两条 HTML 路由的 `X-Records-Release` 响应头确认交接。该头部值为 `astro-static` 时，当前访问使用 Cloudflare 保存的 Astro 页面。
