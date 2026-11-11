# 中文翻译工作区

本目录保存翻译基础设施。译文本身与英文原文放在同一目录，文件名为
`index.zh.mdx`。

## 目录

| 路径 | 用途 |
|---|---|
| `glossary/terms.csv` | 正式术语表，翻译与校验的唯一真源 |
| `glossary/terms.proposed.csv` | 待确认的新术语 |
| `style-guide.md` | 翻译风格与排版规则 |
| `status.json` | 同步状态（生成物） |
| `ZH_TODO.md` | 进度条、Token 消耗、待翻译/待更新清单（生成物） |
| `translation-runs.csv` | 每次翻译的页数、Token、耗时记录 |

## 常用命令

```bash
# 本地开发（只构建已有译文的页面）
ZH_PILOT_ONLY=1 npm run dev

# 检查所有译文的结构与术语
npm run zh:check

# 检查指定文件
npm run zh:check -- src/content/pages/electronics/.../index.zh.mdx

# 统计 current / stale / missing / orphan，并重新生成 ZH_TODO.md 的进度条
npm run zh:status

# 追加一次翻译的 Token 消耗记录
npm run zh:log -- --batch "PCB batch 3" --agent A --pages 10 --tokens 90000 --duration 300

# 从上游 GitHub 下载缺失的内容图片（sparse checkout 不包含图片）
npm run zh:assets
```

## 上游更新流程

```bash
git fetch origin
git merge origin/master

npm run zh:status
# 查看 zh/ZH_TODO.md 中的 stale 页面
git diff <sourceCommit>..HEAD -- <英文源文件>
# 只重译变更段落，更新 frontmatter 的 sourceCommit/sourceHash/translatedAt

npm run zh:check
```

## 翻译约定

- 中文 + 术语首次括注英文，之后只用中文。
- 代码块、行内代码、URL、图片 import、数学公式、组件名保持原样。
- 图注翻译，图内英文保留。
- 每个 `index.zh.mdx` 的 frontmatter 必须记录来源与哈希。

## 许可

原文与译文均以 [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)
发布。归属与修改说明见仓库根目录 `ATTRIBUTION.md`。
