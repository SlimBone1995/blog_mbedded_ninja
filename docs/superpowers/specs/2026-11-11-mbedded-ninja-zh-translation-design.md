# mbedded.ninja 简体中文翻译：设计与维护方案

- 日期：2026-11-11
- 状态：已批准（方案 v1）
- 上游：<https://github.com/gbmhunter/blog>（`master`，HEAD `4437c73a`）
- 用户 fork：<https://github.com/SlimBone1995/blog_mbedded_ninja>
- 原文许可：CC BY 4.0，作者 Geoffrey Hunter

## 1. 目标

把 <https://blog.mbedded.ninja> 的工程内容翻译为简体中文，并满足：

1. **术语准确且一致**：电子、PCB、固件、协议、数学术语使用统一译名。
2. **可持续同步**：上游持续更新时，能快速找出过期译文并只重译变更部分。
3. **不破坏原站渲染**：图片、KaTeX 公式、代码块、脚注、自定义 MDX 组件原样可用。
4. **合规**：满足 CC BY 4.0 的署名、许可证链接和“已修改”声明。
5. **低成本增量维护**：译文与原文同目录，新增页面只增加文本，不复制图片。

非目标（首期不做）：

- 不翻译图内英文（保留原图，翻译图注）。
- 不重制 Affinity 源文件。
- 不追求一次性全量翻译（全站 1,179 页、约 89 万英文单词）。
- 不建立独立 CMS 或数据库。

## 2. 关键决策

| 决策 | 选择 | 理由 |
|---|---|---|
| 载体 | Fork 上游 Astro/Starlight 仓库 | 直接复用渲染、图片和组件，避免 HTML 重洗 |
| 译文位置 | 与英文同目录的 `index.zh.mdx` | 相对图片路径天然可用；上游改动只影响英文文件 |
| 未译页 | 回退英文 + 顶部提示 | 侧边栏完整、无死链，翻译进度可见 |
| 术语排版 | 中文 + 首次括注英文 | 可读性与查证便利兼顾 |
| 部署 | 先本地构建，部署后置 | 先验证 20 页样板，避免大仓库 CI 成本 |
| 术语治理 | 项目级 skill + CSV 术语表 + 校验脚本 | 让每次翻译自动使用同一套规则 |

## 3. 仓库与文件结构

```text
upstream/                                  # 用户 fork 的本地克隆
├─ src/content/pages/**/index.mdx          # 英文原文（不改）
├─ src/content/pages/**/index.zh.mdx       # 中文译文（新增）
├─ src/content.config.ts                   # 排除 *.zh.mdx；新增 pagesZh collection
├─ astro.config.mjs                        # 增加 Starlight locales / Astro i18n
├─ src/pages/zh/[...slug].astro            # 新增 /zh/... 路由
├─ src/js/ZhCollections.ts                 # 新增：中文条目、回退、路由
├─ src/js/PageHierarchy.ts                 # 小改：可选 title/link 前缀参数
├─ src/components/ZhFallbackNotice.astro   # 新增：未翻译提示
├─ zh/
│  ├─ glossary/terms.csv                   # 正式术语表
│  ├─ glossary/terms.proposed.csv          # 待确认术语
│  ├─ style-guide.md                       # 翻译风格指南
│  ├─ status.json                          # 同步状态（生成物）
│  └─ ZH_TODO.md                           # 待办清单（生成物）
├─ scripts/zh/status.mjs                   # 上游变更检测
├─ scripts/zh/check.mjs                    # 术语与结构校验
├─ .claude/skills/mbedded-ninja-zh/SKILL.md# 项目级翻译 skill
└─ ATTRIBUTION.md                          # CC BY 4.0 归属说明
```

## 4. 数据模型

### 4.1 英文 collection

保持现有 `pages` / `updates` schema 不变，只修改 glob 排除规则：

```ts
pattern: ['**/*.{md,mdx}', '!**/*.zh.mdx', '!**/_*/**', '!**/_*.{md,mdx}']
```

### 4.2 中文 collection（`pagesZh`）

```ts
loader: glob({
  pattern: ['**/*.zh.mdx', '!**/_*/**', '!**/_*.mdx'],
  base: './src/content/pages',
})
```

id 规范化：去掉结尾 `.zh`，再按现有规则把结尾 `/index` 去掉，使其与英文条目的 id 完全一致。例如：

```text
electronics/communication-protocols/i2c-communication-protocol/index.zh.mdx
→ electronics/communication-protocols/i2c-communication-protocol
```

### 4.3 中文 frontmatter

在英文 schema 字段之外增加：

```yaml
title: I²C 通信协议                  # 必填，中文标题
sourcePath: electronics/communication-protocols/i2c-communication-protocol/index.mdx
sourceCommit: 4437c73a               # 上次翻译时的上游 commit
sourceHash: sha256:...               # 上次翻译时英文文件的 SHA-256
sourceUrl: https://blog.mbedded.ninja/electronics/communication-protocols/i2c-communication-protocol/
translatedAt: 2026-11-11
translator: SlimBone1995
translationStatus: reviewed          # draft | reviewed | stale
```

`sourceHash` 是同步判断的唯一依据；`sourceCommit` 用于生成 diff 摘要。

## 5. 路由与渲染

### 5.1 生成规则

`src/pages/zh/[...slug].astro`：

1. 加载全部英文 `pages` 条目，生成中文路由集合。
2. 对每个 slug，查找 `pagesZh` 中同 id 的条目。
3. 有译文：渲染译文；侧边栏/面包屑标题用译文 `title`。
4. 无译文：渲染英文条目，并在正文前插入 `ZhFallbackNotice`。
5. `index` 映射为 `/zh/`（`params.slug` 为 `undefined`）。

不生成 `updates` 的中文路由；更新日志保留英文入口，后续再决定是否翻译。

### 5.2 侧边栏与面包屑

- 复用 `getPageHierarchy` / `convertNodesToSidebarData`。
- 增加两个可选参数：
  - `titleResolver(slug, fallbackTitle)`：有译文时返回中文标题。
  - `linkPrefix`：中文站固定为 `/zh`，并保证根链接为 `/zh/`。
- 未译叶节点标题追加 `（English · 未翻译）`；分支节点保持中文标题（若无译文则用英文）。
- 面包屑首项为“首页”，链接 `/zh/`。

### 5.3 语言与 UI

- `astro.config.mjs` 增加 Astro `i18n`（`defaultLocale: 'en'`，`locales: ['en', 'zh']`）和 Starlight `locales`（`en`、`zh`，`lang: 'zh-CN'`）。
- 验证 `<StarlightPage>` 是否自动应用 `zh-CN`；若不生效，在中文路由外层设置 `lang="zh-CN"`，并显式传入中文 UI 文案。
- 中文页的 `<html lang>`、搜索占位、目录标题、上一页/下一页等均由 locale 决定。

### 5.4 图片与组件

- 译文与英文同目录，`import('./_assets/foo.webp')` 路径不变。
- 不复制 `_assets`；试点阶段只对需要的页面执行 `git sparse-checkout add` 拉取图片。
- 图注翻译，图内英文保留。
- `Image` 的 `width` 必须带 `px`；不改组件行为。

## 6. 上游同步

### 6.1 状态脚本 `npm run zh:status`

对每个 `*.zh.mdx`：

1. 用 `sourcePath` 定位英文文件；不存在 → `orphan`。
2. 计算英文文件当前 SHA-256，与 `sourceHash` 比较：
   - 相同 → `current`
   - 不同 → `stale`
3. 无对应译文的英文页面 → `missing`。

输出：

- 终端表格：四类计数 + stale 页面的 diff 摘要。
- `zh/status.json`：机器可读。
- `zh/ZH_TODO.md`：按板块分组的待办清单。

### 6.2 更新流程

```text
git fetch origin
git merge origin/master
npm run zh:status
# 对每个 stale 页面：
#   git diff <sourceCommit>..HEAD -- <sourcePath>
#   只重译变更段落，更新 sourceCommit/sourceHash/translatedAt
npm run zh:check
git add ... && git commit
```

### 6.3 冲突控制

- 译文只新增文件，不修改英文原文。
- 对上游文件只做最小改动：`content.config.ts`、`astro.config.mjs`、`PageHierarchy.ts`、`package.json`。
- 新增逻辑尽量放在 `src/js/ZhCollections.ts`、`src/pages/zh/`、`src/components/ZhFallbackNotice.astro`。

## 7. 术语与质量系统

### 7.1 项目 skill

`.claude/skills/mbedded-ninja-zh/SKILL.md` 在翻译时自动加载，规定：

1. 先读英文原文、术语表和风格指南。
2. 按段落翻译，保留 MDX 结构、组件、公式、代码、链接。
3. 新术语先写入 `terms.proposed.csv`，等待确认。
4. 每页完成后运行 `npm run zh:check`，0 error 才能提交。
5. 更新 frontmatter 的 `sourceCommit`、`sourceHash`、`translatedAt`、`translationStatus`。

### 7.2 术语表

`zh/glossary/terms.csv` 列：

```csv
en,zh,domain,keep_en,forbidden_zh,notes
open-drain,开漏,electronics,true,,首次出现写“开漏（open-drain）”
pull-up resistor,上拉电阻,electronics,true,,禁止“拉起电阻”
decoupling capacitor,去耦电容,electronics,false,,禁止“解耦电容”
```

- `keep_en=true`：首次出现必须括注英文。
- `forbidden_zh`：校验脚本直接报错。
- 试点先建立 150–250 个高频术语，随翻译扩展。

### 7.3 风格指南

- 大陆工科习惯译名；同一概念全站唯一译法。
- 术语首次出现“中文（English）”，之后只用中文。
- 代码、寄存器名、协议名（I2C/SPI）、型号、单位、URL 不译。
- 标题用中文陈述式；不逐字直译。
- 图注翻译；图内文字保留英文。
- 表格表头翻译，数据/型号/单位不译。
- 脚注内容翻译，脚注 key 与 URL 不变。
- 数学公式不改；`\text{}` 内的自然语言可译，但试点阶段保持原样以避免渲染风险。

### 7.4 校验脚本 `npm run zh:check`

逐页检查：

1. frontmatter 必填字段、`sourceHash` 与当前英文一致。
2. 代码块数量/内容、行内代码与原文一致。
3. URL、图片 import、MDX 组件名与原文一致。
4. 数学公式片段与原文一致。
5. 术语表禁用变体不出现；`keep_en` 术语首次出现带英文括注。
6. 连续英文段落（超过阈值）告警，提示可能漏译。
7. 输出 `error` / `warning`，有 error 时退出码非 0。

## 8. License 合规

- 保留上游 `LICENSE.md`。
- 新增 `ATTRIBUTION.md`：
  - 原作品：blog.mbedded.ninja，作者 Geoffrey Hunter，CC BY 4.0。
  - 本仓库中文译文为非官方衍生作品，已进行翻译和格式调整。
  - 译文同样以 CC BY 4.0 发布。
- 中文页页脚展示上述信息与许可证链接。
- 每个中文页 frontmatter 记录 `sourceUrl`，便于逐页追溯。
- 第三方图片/数据手册截图保留原始出处，不声称版权。
- 不使用原作者 Logo 或名义暗示官方背书。

## 9. 试点范围（20 页）

| 板块 | 页面 |
|---|---|
| Electronics | I2C、SPI、UART、Capacitors、Op-Amps、Buck Converters、Resistors |
| PCB Design | Decoupling and Noise Suppression、Layer Stackup、QFN Package、SOT-23 Package |
| Programming | C Pointers、volatile、Bit Manipulation、STM32、FreeRTOS、Zephyr、GNU Linker Scripts、Smart Pointers、Function Pointers |

覆盖公式、图表、代码块、脚注、表格、跨页链接和自定义组件。

## 10. 验收标准

- `npm run build` 通过，生成 `/zh/` 路由。
- 未译页正确回退英文并显示提示。
- 20 页的公式、图片、代码块、脚注、侧边栏、目录、深色模式与原文一致。
- `npm run zh:check` 0 error。
- `npm run zh:status` 显示 20 个 current。
- 至少 3 页与原文并排人工校对。
- 仓库只增加文本，不复制图片。

## 11. 风险与缓解

| 风险 | 缓解 |
|---|---|
| `<StarlightPage>` 不自动识别中文 locale | 实现首日验证；备选显式设置 `lang` 与 UI 文案 |
| 上游改动路由文件导致 merge 冲突 | 只做最小 diff；新增逻辑放独立文件 |
| fork 1.26 GB，构建克隆慢 | 本地 sparse checkout；部署后置，后续用 CI 稀疏检出 |
| Pagefind 中文分词效果一般 | 首期接受；后续替换 Algolia 或本地索引 |
| 术语漂移 | CSV 单一真源 + 校验脚本 + 新术语审批 |
| 图内英文未翻译 | 明确列为非目标；后续可按优先级重制关键图 |

## 12. 实施顺序（概要）

1. 验证依赖安装与现有构建。
2. 增加 `pagesZh` collection、`/zh` 路由、回退提示。
3. 验证 Starlight locale、侧边栏、面包屑、深色模式。
4. 建立术语表、风格指南、`zh:status`、`zh:check`、项目 skill。
5. 拉取试点页图片，翻译 20 页。
6. 构建与人工校对，输出验收报告。
7. 再决定部署与后续板块优先级。
