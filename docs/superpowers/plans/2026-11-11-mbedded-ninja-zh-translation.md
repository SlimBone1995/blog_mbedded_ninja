# mbedded.ninja 简体中文翻译 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在用户 fork 的 Astro/Starlight 仓库中增加 `/zh/` 中文站：译文与英文同目录、未译页回退英文、术语表与校验脚本保证一致性，并完成 20 页试点翻译。

**Architecture:** 英文 `index.mdx` 保持上游原样；中文译文写作同目录 `index.zh.mdx`，由新增的 `pagesZh` collection 加载。新增 `src/pages/zh/[...slug].astro` 为每个英文页生成 `/zh/` 路由，有译文用译文，无译文渲染英文并插入提示。术语表、状态脚本、校验脚本和项目 skill 位于 `zh/`、`scripts/zh/`、`.claude/skills/`。

**Tech Stack:** Astro 7、Starlight 0.41、MDX、Node.js 24、`node:test`、Git。

## Global Constraints

- 上游内容文件 `index.mdx` 不得修改；中文只新增 `index.zh.mdx`。
- 图片不复制，沿用同目录 `_assets/` 相对路径。
- 术语风格：中文 + 首次括注英文，之后只用中文。
- 代码、寄存器名、协议名、型号、单位、URL 不翻译。
- 每个中文页 frontmatter 必须包含 `sourcePath`、`sourceCommit`、`sourceHash`、`translatedAt`、`translator`、`translationStatus`。
- CC BY 4.0：保留上游 `LICENSE.md`，新增 `ATTRIBUTION.md` 并在页脚展示归属。
- 不向远端推送，直到用户明确要求。
- 遵循仓库 `.gitattributes` 的 LF 行尾。
- 仓库 `CLAUDE.md` 要求提交信息不加 AI attribution trailer。

---

### Task 1: 本地基线构建

**Files:**
- Modify: sparse-checkout patterns (no tracked file)
- Verify: `dist/index.html`

**Interfaces:**
- Produces: 可运行的 `npm run dev` / `npm run build` 环境。

- [ ] **Step 1: 补齐 sparse checkout 的源码文件类型**

Run:
```bash
git sparse-checkout add '/src/**/*.mjs' '/src/assets/**' '/public/favicon.ico'
```

- [ ] **Step 2: 安装依赖**

Run:
```bash
npm install --no-audit --no-fund
```
Expected: `added ... packages`，无 `ERR!`。

- [ ] **Step 3: 跑 Astro 类型检查**

Run:
```bash
npx astro check
```
Expected: 0 errors（上游已有 warning 可忽略）。

- [ ] **Step 4: 构建基线**

Run:
```bash
npm run build
```
Expected: 生成 `dist/index.html`；构建结束无 error。

- [ ] **Step 5: 提交环境改动（若有）**

```bash
git add package-lock.json
git commit -m "chore: update lockfile after npm install"
```
若 lockfile 无变化则跳过。

---

### Task 2: 增加 `pagesZh` collection

**Files:**
- Modify: `src/content.config.ts`
- Test: `npx astro sync`

**Interfaces:**
- Produces: collection `pagesZh`，条目 id 与英文 `pages` 的 id 对齐；英文 collection 排除 `*.zh.mdx`。

- [ ] **Step 1: 修改英文 glob 排除中文文件**

在 `pagesCollection` 的 pattern 中加入 `'!**/*.zh.mdx'`：

```ts
loader: glob({
  pattern: ['**/*.{md,mdx}', '!**/*.zh.mdx', '!**/_*/**', '!**/_*.{md,mdx}'],
  base: './src/content/pages',
}),
```

- [ ] **Step 2: 新增 `pagesZhCollection`**

```ts
const pagesZhCollection = defineCollection({
  loader: glob({
    pattern: ['**/*.zh.mdx', '!**/_*/**'],
    base: './src/content/pages',
  }),
  schema: ({ image }) =>
    z.object({
      aliases: z.array(z.string()).optional(),
      authors: z.array(z.string()),
      date: z.date(),
      description: z.string().optional(),
      draft: z.boolean().default(false),
      image: image().optional(),
      lastUpdated: z.date(),
      tags: z.array(z.string()).optional(),
      title: z.string(),
      sourcePath: z.string(),
      sourceCommit: z.string(),
      sourceHash: z.string(),
      sourceUrl: z.string().url().optional(),
      translatedAt: z.coerce.date(),
      translator: z.string().default('SlimBone1995'),
      translationStatus: z.enum(['draft', 'reviewed', 'stale']).default('draft'),
    }),
});
```

- [ ] **Step 3: 注册 collection**

```ts
export const collections = {
  docs: docsCollection,
  pages: pagesCollection,
  pagesZh: pagesZhCollection,
  updates: updatesCollection,
  authors: authorsCollection,
  test: testCollection,
};
```

- [ ] **Step 4: 验证**

Run:
```bash
npx astro sync
```
Expected: 无 schema 错误；`.astro/` 生成新的 collection 数据。

- [ ] **Step 5: 提交**

```bash
git add src/content.config.ts
git commit -m "feat(zh): add pagesZh content collection"
```

---

### Task 3: 中文路由与英文回退

**Files:**
- Create: `src/js/ZhCollections.ts`
- Create: `src/components/ZhFallbackNotice.astro`
- Create: `src/pages/zh/[...slug].astro`
- Modify: `src/js/PageHierarchy.ts`
- Test: `npx astro check` + `npm run build`

**Interfaces:**
- Consumes: `pages`、`pagesZh` collections。
- Produces:
  - `getZhRoutes(): Promise<ZhRoute[]>`
  - `normalizeZhId(id: string): string`
  - `convertNodesToSidebarData(node, options)`，`options.linkPrefix`、`options.titleForSlug`、`options.suffixForSlug`。

- [ ] **Step 1: 写 `ZhCollections.ts`**

```ts
import { getCollection, type CollectionEntry } from 'astro:content';

export type PageEntry = CollectionEntry<'pages'>;
export type ZhPageEntry = CollectionEntry<'pagesZh'>;

export interface ZhRoute {
  slug: string;
  enEntry: PageEntry;
  zhEntry?: ZhPageEntry;
}

/** "a/b/index.zh" -> "a/b"; "index.zh" -> "index" */
export function normalizeZhId(id: string): string {
  return id.replace(/\.zh$/, '').replace(/\/index$/, '');
}

export async function getZhRoutes(): Promise<ZhRoute[]> {
  const [enPages, zhPages] = await Promise.all([
    getCollection('pages'),
    getCollection('pagesZh'),
  ]);
  const zhById = new Map(zhPages.map((entry) => [normalizeZhId(entry.id), entry]));

  return enPages.map((enEntry) => ({
    slug: enEntry.id,
    enEntry,
    zhEntry: zhById.get(enEntry.id),
  }));
}

export function zhTitle(route: ZhRoute): string {
  return route.zhEntry?.data.title ?? route.enEntry.data.title;
}
```

- [ ] **Step 2: 给 `PageHierarchy.ts` 增加可选参数**

在 `SidebarData` 之后加入：

```ts
export interface SidebarOptions {
  linkPrefix?: string;
  titleForSlug?: (slug: string, fallback: string) => string;
  suffixForSlug?: (slug: string) => string;
}

function stripSlashes(slug: string): string {
  return slug.replace(/^\/+|\/+$/g, '');
}
```

把函数签名改为：

```ts
export function convertNodesToSidebarData(
  node: PageNode,
  options: SidebarOptions = {},
): SidebarData {
```

在计算 `label` 后加入：

```ts
const normalizedSlug = node.slug ? stripSlashes(node.slug) : undefined;
if (normalizedSlug && options.titleForSlug) {
  label = options.titleForSlug(normalizedSlug, label);
}
const suffix =
  normalizedSlug && node.children.length === 0 && options.suffixForSlug
    ? options.suffixForSlug(normalizedSlug)
    : '';
const linkPrefix = options.linkPrefix ?? '';
```

叶子返回改为：

```ts
return { label: `${label}${suffix}`, link: `${linkPrefix}${node.slug}` };
```

分支标签改为：

```ts
if (node.label !== 'root' && node.slug) {
  finalLabel = `${label}${suffix}\x00${linkPrefix}${node.slug}`;
}
```

递归调用改为：

```ts
items.push(convertNodesToSidebarData(sortedChildren[i], options));
```

- [ ] **Step 3: 写 `ZhFallbackNotice.astro`**

```astro
---
interface Props {
  sourceUrl?: string;
}
const { sourceUrl } = Astro.props;
---
<div class="zh-fallback-notice" role="note">
  <strong>⚠ 本文尚未翻译</strong>，当前显示英文原文。
  {sourceUrl && (
    <a href={sourceUrl} target="_blank" rel="noopener noreferrer">查看原站页面 ↗</a>
  )}
</div>

<style>
  .zh-fallback-notice {
    margin: 0 0 1.5rem;
    padding: 0.75rem 1rem;
    border-left: 4px solid var(--sl-color-orange);
    background: var(--sl-color-bg-nav);
    border-radius: 0.25rem;
    font-size: var(--sl-text-sm);
  }
  .zh-fallback-notice a {
    margin-left: 0.5rem;
  }
</style>
```

- [ ] **Step 4: 写 `src/pages/zh/[...slug].astro`**

```astro
---
// @ts-nocheck
import StarlightPage from '@astrojs/starlight/components/StarlightPage.astro';
import { render } from 'astro:content';

import {
  getPageHierarchy,
  convertNodesToSidebarData,
  findPageNodeBySlug,
} from 'src/js/PageHierarchy';
import { getPagesRoutes } from 'src/js/Collections';
import { getZhRoutes } from 'src/js/ZhCollections';
import { getGlobalMdxComponents } from 'src/js/GlobalMdxComponents';
import ZhFallbackNotice from 'src/components/ZhFallbackNotice.astro';

export async function getStaticPaths() {
  const [routes, enRoutes] = await Promise.all([getZhRoutes(), getPagesRoutes()]);
  const pageHierarchy = getPageHierarchy(enRoutes);

  const zhBySlug = new Map(
    routes.filter((route) => route.zhEntry).map((route) => [route.slug, route.zhEntry]),
  );

  const sidebarData = convertNodesToSidebarData(pageHierarchy, {
    linkPrefix: '/zh',
    titleForSlug: (slug, fallback) => zhBySlug.get(slug)?.data.title ?? fallback,
    suffixForSlug: (slug) =>
      zhBySlug.has(slug) ? '' : '（English · 未翻译）',
  });

  return routes.map((route) => {
    const slug = route.slug === 'index' ? undefined : route.slug;
    const entry = route.zhEntry ?? route.enEntry;

    const breadcrumbs = [{ label: '首页', slug: '/zh/' }];
    if (route.slug !== 'index') {
      const parts = route.slug.split('/');
      let pathSoFar = '';
      for (let i = 0; i < parts.length; i++) {
        pathSoFar += (i === 0 ? '' : '/') + parts[i];
        const node = findPageNodeBySlug(pathSoFar, pageHierarchy);
        breadcrumbs.push({
          label:
            zhBySlug.get(pathSoFar)?.data.title ??
            node?.fileData?.title ??
            parts[i],
          slug: `/zh/${pathSoFar}/`,
        });
      }
    }

    return {
      params: { slug },
      props: {
        entry,
        translated: Boolean(route.zhEntry),
        sourceUrl:
          route.zhEntry?.data.sourceUrl ??
          `https://blog.mbedded.ninja/${route.slug === 'index' ? '' : route.slug + '/'}`,
        sidebarData,
        breadcrumbs,
      },
    };
  });
}

const { entry, translated, sourceUrl, sidebarData, breadcrumbs } = Astro.props;

Astro.locals.breadcrumbs = breadcrumbs;

const { Content, headings } = await render(entry);
const globalMdxComponents = getGlobalMdxComponents();
---
<StarlightPage
  frontmatter={{ ...entry.data }}
  headings={headings}
  sidebar={sidebarData.items as any}
  customFrontmatter={entry.data}
>
  {!translated && <ZhFallbackNotice sourceUrl={sourceUrl} />}
  <Content components={globalMdxComponents} />
</StarlightPage>
```

- [ ] **Step 5: 类型检查**

Run:
```bash
npx astro check
```
Expected: 新增文件无 error。

- [ ] **Step 6: 构建并验证路由存在**

Run:
```bash
npm run build
test -f dist/zh/index.html && test -f dist/zh/electronics/communication-protocols/i2c-communication-protocol/index.html
```
Expected: 两条命令均成功；`dist/zh/index.html` 含 `lang="zh"` 或中文 UI 文案。

- [ ] **Step 7: 提交**

```bash
git add src/js/ZhCollections.ts src/js/PageHierarchy.ts src/pages/zh src/components/ZhFallbackNotice.astro
git commit -m "feat(zh): add /zh routes with English fallback"
```

---

### Task 4: Starlight / Astro locale

**Files:**
- Modify: `astro.config.mjs`
- Test: `dist/zh/index.html`

**Interfaces:**
- Produces: `/zh/` 页面使用 `zh-CN` locale；中文 UI 字符串。

- [ ] **Step 1: 增加 Astro i18n**

在 `defineConfig` 顶层加入：

```js
i18n: {
  defaultLocale: 'en',
  locales: ['en', 'zh'],
  routing: { prefixDefaultLocale: false },
},
```

- [ ] **Step 2: 增加 Starlight locales**

在 `starlight({ ... })` 中加入：

```js
defaultLocale: 'en',
locales: {
  en: { label: 'English', lang: 'en' },
  zh: { label: '简体中文', lang: 'zh-CN' },
},
```

- [ ] **Step 3: 验证 locale**

Run:
```bash
npm run build
grep -o 'lang="[^"]*"' dist/zh/index.html | head -1
```
Expected: `lang="zh-CN"` 或 `lang="zh"`；若仍是 `en`，检查 `node_modules/@astrojs/starlight/components/StarlightPage.astro` 是否接受 `locale` prop，并在中文路由中显式传入 `locale="zh"`。

- [ ] **Step 4: 提交**

```bash
git add astro.config.mjs
git commit -m "feat(zh): configure zh-CN locale"
```

---

### Task 5: 术语表、风格指南与项目 skill

**Files:**
- Create: `zh/glossary/terms.csv`
- Create: `zh/glossary/terms.proposed.csv`
- Create: `zh/style-guide.md`
- Create: `.claude/skills/mbedded-ninja-zh/SKILL.md`
- Test: `node -e` CSV parse

**Interfaces:**
- Produces: 术语 CSV 列 `en,zh,domain,keep_en,forbidden_zh,notes`；skill 在翻译时加载。

- [ ] **Step 1: 建术语表（先 80–120 条高频词）**

`zh/glossary/terms.csv` 表头与示例：

```csv
en,zh,domain,keep_en,forbidden_zh,notes
open-drain,开漏,electronics,true,,首次出现写“开漏（open-drain）”
open-collector,开集,electronics,true,,
pull-up resistor,上拉电阻,electronics,true,拉起电阻,
pull-down resistor,下拉电阻,electronics,true,拉低电阻,
decoupling capacitor,去耦电容,electronics,false,解耦电容,
bypass capacitor,旁路电容,electronics,false,,
board bring-up,板级调试,electronics,false,板子上电,
buck converter,降压变换器,electronics,true,降压转换器,
boost converter,升压变换器,electronics,true,升压转换器,
voltage regulator,电压调节器,electronics,true,稳压器,
op-amp,运算放大器,electronics,true,运放,
common-mode rejection ratio,共模抑制比,electronics,true,CMRR,
slew rate,压摆率,electronics,true,,
duty cycle,占空比,electronics,false,,
switching frequency,开关频率,electronics,false,,
ripple,纹波,electronics,false,,
ground plane,地平面,pcb,false,,
power plane,电源平面,pcb,false,,
layer stackup,层叠结构,pcb,true,叠层,
solder mask,阻焊层,pcb,false,,
thermal via,散热过孔,pcb,false,,
silkscreen,丝印,pcb,false,,
footprint,封装,pcb,false,,
component package,元件封装,pcb,false,,
through-hole,通孔,pcb,false,,
surface-mount,表面贴装,pcb,true,SMT,
interrupt,中断,firmware,false,,
interrupt service routine,中断服务程序,firmware,true,ISR,
real-time operating system,实时操作系统,firmware,true,RTOS,
scheduler,调度器,firmware,false,,
context switch,上下文切换,firmware,false,,
semaphore,信号量,firmware,false,,
mutex,互斥锁,firmware,false,,
stack overflow,栈溢出,firmware,false,,
heap,堆,firmware,false,,
linker script,链接脚本,firmware,false,链接器脚本,
memory-mapped I/O,内存映射 I/O,firmware,true,MMIO,
volatile,volatile,firmware,false,易失,
pointer,指针,c,false,,
dereference,解引用,c,false,,
bit field,位域,c,false,,
bit mask,位掩码,c,false,,
endianness,字节序,c,false,,
call stack,调用栈,c,false,,
undefined behavior,未定义行为,c,false,,
translation unit,翻译单元,c,false,,
one definition rule,单一定义规则,c,true,ODR,
half-duplex,半双工,protocol,false,,
full-duplex,全双工,protocol,false,,
arbitration,仲裁,protocol,false,,
clock stretching,时钟拉伸,protocol,false,,
controller,控制器,protocol,false,主机,
target,目标设备,protocol,false,从机,
open-drain output,开漏输出,protocol,true,,
bus capacitance,总线电容,protocol,false,,
rise time,上升时间,protocol,false,,
fall time,下降时间,protocol,false,,
transfer rate,传输速率,protocol,false,,
```

- [ ] **Step 2: 写风格指南**

`zh/style-guide.md` 至少包含：术语风格、首次括注规则、代码/URL/公式不译、标题译法、图注译法、表格译法、脚注 rule、单位与数字、常见禁用变体。

- [ ] **Step 3: 写项目 skill**

`.claude/skills/mbedded-ninja-zh/SKILL.md`：

```markdown
---
name: mbedded-ninja-zh
description: Translate blog.mbedded.ninja MDX pages into Simplified Chinese using the project glossary and checker. Use when translating or updating files under src/content/pages ending in .zh.mdx.
---

# mbedded.ninja 中文翻译

## 每次翻译前
1. 读英文原文 `index.mdx`、`zh/glossary/terms.csv`、`zh/style-guide.md`。
2. 确认目标文件为同目录 `index.zh.mdx`，不修改英文文件。

## 翻译规则
- 中文 + 术语首次括注英文，之后只用中文。
- 代码块、行内代码、URL、图片 import、数学公式、JSX 组件名保持原样。
- 图注翻译，图内英文保留。
- 标题用中文陈述式，不逐字直译。
- 新术语写入 `zh/glossary/terms.proposed.csv`，不要擅自定稿。

## 完成后
1. 更新 frontmatter：`sourcePath`、`sourceCommit`、`sourceHash`、`translatedAt`、`translationStatus`。
2. 运行 `npm run zh:check -- <file>`，0 error 才能提交。
3. 运行 `npm run zh:status`，确认状态为 current。
```

- [ ] **Step 4: 验证 CSV 可解析**

Run:
```bash
node -e "const fs=require('fs');const t=fs.readFileSync('zh/glossary/terms.csv','utf8');console.log(t.split('\n').length-1,'lines')"
```
Expected: 输出术语行数，无异常。

- [ ] **Step 5: 提交**

```bash
git add zh .claude/skills/mbedded-ninja-zh
git commit -m "docs(zh): add glossary, style guide and translation skill"
```

---

### Task 6: 状态脚本 `zh:status`

**Files:**
- Create: `scripts/zh/status.mjs`
- Create: `scripts/zh/shared.mjs`
- Create: `scripts/zh/status.test.mjs`
- Modify: `package.json`
- Test: `node --test scripts/zh/status.test.mjs`

**Interfaces:**
- Produces: `npm run zh:status`，读取 `src/content/pages/**/*.zh.mdx`，输出 `zh/status.json`、`zh/ZH_TODO.md`。
- `shared.mjs` 导出 `walkFiles`、`parseFrontmatter`、`sha256`、`relativeToPages`。

- [ ] **Step 1: 写共享工具 `shared.mjs`**

```js
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const ROOT = process.cwd();
export const PAGES_DIR = path.join(ROOT, 'src/content/pages');

export function walkFiles(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '_assets' || entry.name.startsWith('_')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(full, out);
    else out.push(full);
  }
  return out;
}

export function parseFrontmatter(text) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};
  const data = {};
  for (const line of match[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    if (!kv) continue;
    let value = kv[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    data[kv[1]] = value;
  }
  return data;
}

export function sha256(file) {
  return `sha256:${crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}`;
}

export function relativeToPages(file) {
  return path.relative(PAGES_DIR, file).split(path.sep).join('/');
}

export function isZhFile(file) {
  return /\.zh\.(md|mdx)$/.test(file);
}

export function sourcePathFor(zhFile) {
  return zhFile.replace(/\.zh\.(md|mdx)$/, '.$1');
}
```

- [ ] **Step 2: 写 `status.mjs`**

```js
#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, PAGES_DIR, walkFiles, parseFrontmatter, sha256, relativeToPages, isZhFile, sourcePathFor } from './shared.mjs';

const all = walkFiles(PAGES_DIR);
const enFiles = all.filter((f) => /\.(md|mdx)$/.test(f) && !isZhFile(f));
const zhFiles = all.filter(isZhFile);
const enSet = new Set(enFiles.map(relativeToPages));
const zhSourceSet = new Set();

const current = [];
const stale = [];
const orphan = [];

for (const zhFile of zhFiles) {
  const rel = relativeToPages(zhFile);
  const data = parseFrontmatter(fs.readFileSync(zhFile, 'utf8'));
  const sourceRel = data.sourcePath ?? relativeToPages(sourcePathFor(zhFile));
  const sourceAbs = path.join(PAGES_DIR, sourceRel);
  zhSourceSet.add(sourceRel);

  if (!fs.existsSync(sourceAbs)) {
    orphan.push({ zh: rel, source: sourceRel });
    continue;
  }
  const actual = sha256(sourceAbs);
  if (data.sourceHash === actual) current.push({ zh: rel, source: sourceRel });
  else stale.push({ zh: rel, source: sourceRel, expected: data.sourceHash ?? null, actual, sourceCommit: data.sourceCommit ?? null });
}

const missing = [...enSet].filter((rel) => !zhSourceSet.has(rel)).sort();
const report = {
  generatedAt: new Date().toISOString(),
  counts: { current: current.length, stale: stale.length, missing: missing.length, orphan: orphan.length },
  current, stale, missing, orphan,
};

fs.mkdirSync(path.join(ROOT, 'zh'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'zh/status.json'), JSON.stringify(report, null, 2) + '\n');

const groups = new Map();
for (const rel of missing) {
  const top = rel.split('/')[0];
  if (!groups.has(top)) groups.set(top, []);
  groups.get(top).push(rel);
}

let md = `# 中文翻译待办\n\n生成时间：${report.generatedAt}\n\n`;
md += `- current: ${report.counts.current}\n- stale: ${report.counts.stale}\n- missing: ${report.counts.missing}\n- orphan: ${report.counts.orphan}\n\n`;
if (stale.length) {
  md += `## 待更新（stale）\n\n`;
  for (const item of stale) {
    md += `- [ ] \`${item.source}\` → \`${item.zh}\`\n`;
    if (item.sourceCommit) md += `  - \`git diff ${item.sourceCommit}..HEAD -- ${item.source}\`\n`;
  }
  md += '\n';
}
for (const [top, items] of [...groups.entries()].sort()) {
  md += `## 未翻译：${top}（${items.length}）\n\n`;
  for (const rel of items) md += `- [ ] ${rel}\n`;
  md += '\n';
}
fs.writeFileSync(path.join(ROOT, 'zh/ZH_TODO.md'), md);

console.log(`zh:status current=${current.length} stale=${stale.length} missing=${missing.length} orphan=${orphan.length}`);
for (const item of stale) console.log(`  stale: ${item.source}`);
for (const item of orphan) console.log(`  orphan: ${item.zh} (source missing: ${item.source})`);
```

- [ ] **Step 3: 写测试**

`status.test.mjs` 用临时目录构造英文/中文文件，调用导出的函数。至少测试：相同 hash → current；改英文 → stale；缺英文 → orphan；缺译文 → missing。

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseFrontmatter, sha256 } from './shared.mjs';

test('parseFrontmatter reads simple fields', () => {
  const data = parseFrontmatter('---\ntitle: 测试\nsourceHash: sha256:abc\n---\n正文');
  assert.equal(data.title, '测试');
  assert.equal(data.sourceHash, 'sha256:abc');
});
```

（Hash 与分类逻辑建议抽成 `buildReport(enFiles, zhFiles)` 纯函数后测试；实现时完成。）

- [ ] **Step 4: 加 npm script**

`package.json`：

```json
"zh:status": "node scripts/zh/status.mjs",
"zh:check": "node scripts/zh/check.mjs"
```

- [ ] **Step 5: 运行**

Run:
```bash
npm run zh:status
node --test scripts/zh/status.test.mjs
```
Expected: 输出计数；测试 PASS。

- [ ] **Step 6: 提交**

```bash
git add scripts/zh package.json
git commit -m "feat(zh): add translation status script"
```

---

### Task 7: 校验脚本 `zh:check`

**Files:**
- Create: `scripts/zh/check.mjs`
- Create: `scripts/zh/check.test.mjs`
- Test: `node --test scripts/zh/check.test.mjs` + 试点页

**Interfaces:**
- Produces: `npm run zh:check -- <file...>`，输出 error/warning，error 时退出码 1。

- [ ] **Step 1: 实现结构对比**

对每个中文文件与英文源文件：

```js
import { parseFrontmatter, sha256, sourcePathFor, relativeToPages, PAGES_DIR } from './shared.mjs';

export function stripFrontmatter(text) {
  return text.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '');
}

export function extract(text, regex) {
  return [...text.matchAll(regex)].map((m) => m[1] ?? m[0]);
}

export function sameMultiset(a, b) {
  const count = (arr) => arr.reduce((m, x) => m.set(x, (m.get(x) ?? 0) + 1), new Map());
  const ca = count(a);
  const cb = count(b);
  if (ca.size !== cb.size) return false;
  for (const [key, value] of ca) if (cb.get(key) !== value) return false;
  return true;
}
```

比较项：
- 代码块：`/```[\s\S]*?```/g`
- 行内代码：去掉代码块后 `/`[^`\n]+`/g`
- 链接：`/\]\(([^)\s]+)\)/g`
- 图片/导入：`/import\s*\(\s*['"]([^'"]+)['"]\s*\)/g`
- 公式块：`/\$\$[\s\S]*?\$\$/g`
- 组件名：`/<([A-Z][A-Za-z0-9]*)/g`

- [ ] **Step 2: 术语检查**

```js
export function parseCsv(text) { /* 处理引号、逗号、换行 */ }

export function checkGlossary(body, terms) {
  const errors = [];
  const warnings = [];
  for (const term of terms) {
    for (const bad of (term.forbidden_zh || '').split(/[;|]/).map((s) => s.trim()).filter(Boolean)) {
      if (body.includes(bad)) errors.push(`禁用译法“${bad}”（应为“${term.zh}”）`);
    }
    if (term.keep_en === 'true') {
      const at = body.indexOf(term.zh);
      if (at !== -1) {
        const window = body.slice(at, at + term.zh.length + 40);
        const en = term.en.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        if (!new RegExp(`[（(]${en}[）)]`, 'i').test(window)) {
          warnings.push(`术语“${term.zh}”首次出现未括注英文“${term.en}”`);
        }
      }
    }
  }
  return { errors, warnings };
}
```

- [ ] **Step 3: 未翻译段落告警**

按空行切段，跳过 frontmatter、代码块、公式、HTML、表格；若拉丁词 > 40 且 CJK 字符 < 5，warning。

- [ ] **Step 4: CLI 与退出码**

```js
const files = process.argv.slice(2);
const targets = files.length ? files : walkFiles(PAGES_DIR).filter(isZhFile);
let errors = 0, warnings = 0;
for (const file of targets) { /* 逐项检查，打印 file: message */ }
console.log(`zh:check errors=${errors} warnings=${warnings}`);
process.exit(errors ? 1 : 0);
```

- [ ] **Step 5: 测试**

Run:
```bash
node --test scripts/zh/check.test.mjs
```
Expected: PASS（覆盖 frontmatter、hash、代码块、链接、公式、禁用术语）。

- [ ] **Step 6: 提交**

```bash
git add scripts/zh/check.mjs scripts/zh/check.test.mjs
git commit -m "feat(zh): add translation checker"
```

---

### Task 8: 翻译 Electronics 试点 7 页

**Files (create in each source directory):**
- `src/content/pages/electronics/communication-protocols/i2c-communication-protocol/index.zh.mdx`
- `src/content/pages/electronics/communication-protocols/spi-communication-protocol/index.zh.mdx`
- `src/content/pages/electronics/communication-protocols/uart-communication-protocol/index.zh.mdx`
- `src/content/pages/electronics/components/capacitors/index.zh.mdx`
- `src/content/pages/electronics/components/op-amps/index.zh.mdx`
- `src/content/pages/electronics/components/power-regulators/switch-mode-power-supplies-smps/buck-converters/index.zh.mdx`
- `src/content/pages/electronics/components/resistors/index.zh.mdx`

**Interfaces:**
- Consumes: 术语表、风格指南、checker。
- Produces: 7 个 `index.zh.mdx`，`translationStatus: reviewed`。

- [ ] **Step 1: 拉取这些页面的 `_assets`**

Run:
```bash
git sparse-checkout add \
 '/src/content/pages/electronics/communication-protocols/i2c-communication-protocol/_assets/**' \
 '/src/content/pages/electronics/communication-protocols/spi-communication-protocol/_assets/**' \
 '/src/content/pages/electronics/communication-protocols/uart-communication-protocol/_assets/**' \
 '/src/content/pages/electronics/components/capacitors/_assets/**' \
 '/src/content/pages/electronics/components/op-amps/_assets/**' \
 '/src/content/pages/electronics/components/power-regulators/switch-mode-power-supplies-smps/buck-converters/_assets/**' \
 '/src/content/pages/electronics/components/resistors/_assets/**'
```

- [ ] **Step 2: 逐页翻译**

每页：
1. 读英文 `index.mdx`。
2. 复制 frontmatter，翻译 `title`/`description`，保留 `authors/date/lastUpdated/tags`。
3. 新增 `sourcePath/sourceCommit/sourceHash/sourceUrl/translatedAt/translator/translationStatus`。
4. 正文按段翻译，保留代码块、URL、图片 import、公式、组件。
5. 图注翻译；图内英文保留。

- [ ] **Step 3: 校验**

Run:
```bash
npm run zh:check -- src/content/pages/electronics/**/index.zh.mdx
npm run zh:status
```
Expected: 7 页 current；check 0 error。

- [ ] **Step 4: 构建**

Run:
```bash
npm run build
```
Expected: `/zh/electronics/...` 页面生成，公式/图片正常。

- [ ] **Step 5: 提交**

```bash
git add src/content/pages/electronics zh
git commit -m "feat(zh): translate electronics pilot pages"
```

---

### Task 9: 翻译 PCB 试点 4 页

**Files:**
- `src/content/pages/pcb-design/decoupling-and-noise-suppression/index.zh.mdx`
- `src/content/pages/pcb-design/layer-stackup/index.zh.mdx`
- `src/content/pages/pcb-design/component-packages/qfn-component-package/index.zh.mdx`
- `src/content/pages/pcb-design/component-packages/sot-23-component-package/index.zh.mdx`

- [ ] **Step 1: 拉取 `_assets`**

```bash
git sparse-checkout add \
 '/src/content/pages/pcb-design/decoupling-and-noise-suppression/_assets/**' \
 '/src/content/pages/pcb-design/layer-stackup/_assets/**' \
 '/src/content/pages/pcb-design/component-packages/qfn-component-package/_assets/**' \
 '/src/content/pages/pcb-design/component-packages/sot-23-component-package/_assets/**'
```

- [ ] **Step 2: 按 Task 8 的规则翻译 4 页**

- [ ] **Step 3: 校验与构建**

```bash
npm run zh:check -- src/content/pages/pcb-design/**/index.zh.mdx
npm run zh:status
npm run build
```

- [ ] **Step 4: 提交**

```bash
git add src/content/pages/pcb-design zh
git commit -m "feat(zh): translate PCB pilot pages"
```

---

### Task 10: 翻译 Programming 试点 9 页

**Files:**
- `src/content/pages/programming/languages/c/pointers/index.zh.mdx`
- `src/content/pages/programming/languages/c/embedded-systems-and-the-volatile-keyword/index.zh.mdx`
- `src/content/pages/programming/languages/c/bit-fields-and-bit-manipulation-masking/index.zh.mdx`
- `src/content/pages/programming/microcontrollers/stm32/index.zh.mdx`
- `src/content/pages/programming/operating-systems/freertos/index.zh.mdx`
- `src/content/pages/programming/operating-systems/zephyr/index.zh.mdx`
- `src/content/pages/programming/compilers/gcc/gnu-linker-scripts/index.zh.mdx`
- `src/content/pages/programming/languages/c-plus-plus/smart-pointers/index.zh.mdx`
- `src/content/pages/programming/design-patterns/state-machines/function-pointers/index.zh.mdx`

- [ ] **Step 1: 拉取 `_assets`**

```bash
git sparse-checkout add \
 '/src/content/pages/programming/languages/c/pointers/_assets/**' \
 '/src/content/pages/programming/languages/c/embedded-systems-and-the-volatile-keyword/_assets/**' \
 '/src/content/pages/programming/languages/c/bit-fields-and-bit-manipulation-masking/_assets/**' \
 '/src/content/pages/programming/microcontrollers/stm32/_assets/**' \
 '/src/content/pages/programming/operating-systems/freertos/_assets/**' \
 '/src/content/pages/programming/operating-systems/zephyr/_assets/**' \
 '/src/content/pages/programming/compilers/gcc/gnu-linker-scripts/_assets/**' \
 '/src/content/pages/programming/languages/c-plus-plus/smart-pointers/_assets/**' \
 '/src/content/pages/programming/design-patterns/state-machines/function-pointers/_assets/**'
```

- [ ] **Step 2: 按 Task 8 的规则翻译 9 页**

- [ ] **Step 3: 校验与构建**

```bash
npm run zh:check -- src/content/pages/programming/**/index.zh.mdx
npm run zh:status
npm run build
```

- [ ] **Step 4: 提交**

```bash
git add src/content/pages/programming zh
git commit -m "feat(zh): translate programming pilot pages"
```

---

### Task 11: 验收与归属文件

**Files:**
- Create: `ATTRIBUTION.md`
- Modify: `src/components/starlight/Footer.astro`
- Test: build + manual review

- [ ] **Step 1: 写 `ATTRIBUTION.md`**

内容至少包含：原作品名称、作者 Geoffrey Hunter、原站 URL、CC BY 4.0 链接、译文为非官方衍生作品、已进行翻译和格式调整、译文同样以 CC BY 4.0 发布、第三方图片/数据手册截图不在本项目版权范围内。

- [ ] **Step 2: 页脚加归属**

在 `Footer.astro` 增加指向 `ATTRIBUTION.md` 的链接与“CC BY 4.0”文案；中文页显示中文版本。

- [ ] **Step 3: 验收**

```bash
npm run zh:check
npm run zh:status
npm run build
```
Expected:
- `zh:check errors=0`；
- `zh:status current=20`（其余 missing）；
- `dist/zh/` 下 20 页存在；
- 未译页显示回退提示；
- 公式、图片、代码块、脚注、深色模式正常。

- [ ] **Step 4: 人工校对**

至少并排校对 I2C、C Pointers、QFN Package 三页，记录术语调整到 `terms.csv`。

- [ ] **Step 5: 提交**

```bash
git add ATTRIBUTION.md src/components/starlight/Footer.astro zh
git commit -m "docs(zh): add CC BY 4.0 attribution and finalize pilot"
```

---

## Self-Review

- **Spec coverage:** 设计文档第 4–10 节均有对应任务（collection、路由、locale、同步、术语、License、试点、验收）。
- **Placeholder scan:** 状态/校验脚本给出了核心实现；CSV 解析和 `buildReport` 纯函数需在实现时补全，测试步骤已明确。
- **Type consistency:** `normalizeZhId`、`getZhRoutes`、`SidebarOptions`、`ZhRoute` 在 Task 3 定义，后续任务引用一致。
