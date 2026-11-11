---
name: mbedded-ninja-zh
description: Translate blog.mbedded.ninja MDX pages into Simplified Chinese using the project glossary and checker. Use when translating or updating files under src/content/pages ending in .zh.mdx.
---

# mbedded.ninja 中文翻译

## 每次翻译前

1. 读英文原文 `index.mdx`、`zh/glossary/terms.csv`、`zh/style-guide.md`。
2. 确认目标文件为同目录 `index.zh.mdx`，不修改英文文件。
3. 检查该页是否已有译文；有则读取现有译文，只更新变更段落。

## 翻译规则

- 中文 + 术语首次括注英文，之后只用中文。
- 代码块、行内代码、URL、图片 import、数学公式、JSX 组件名保持原样。
- 图注翻译，图内英文保留。
- 标题用中文陈述式，不逐字直译。
- 新术语写入 `zh/glossary/terms.proposed.csv`，不要擅自定稿。

## Frontmatter

每个 `index.zh.mdx` 必须包含：

```yaml
title: 中文标题
description: 中文摘要
sourcePath: 相对 src/content/pages 的英文路径
sourceCommit: 当前上游 commit 短哈希
sourceHash: sha256:<英文文件哈希>
sourceUrl: https://blog.mbedded.ninja/<slug>/
translatedAt: YYYY-MM-DD
translator: SlimBone1995
translationStatus: draft | reviewed | stale
```

`sourceHash` 由 `npm run zh:status` 校验；不要手工猜。

## 完成后

1. 运行 `npm run zh:check -- <file>`，0 error 才能提交。
2. 运行 `npm run zh:status`，确认状态为 current。
3. 提交信息使用 `feat(zh): ...`。
