[English](README.md) | [简体中文](README.zh.md)

# mbedded.ninja 博客

本文件是 README.md 的中文翻译；英文原文更新时以 README.md 为准。

本仓库包含用于构建 https://blog.mbedded.ninja 嵌入式工程博客的源代码。

网站使用静态站点生成器 Astro.js 根据本仓库中的文件构建。Netlify 用于部署和托管网站。

[![Netlify Status](https://api.netlify.com/api/v1/badges/3983d7b2-7481-4caa-9874-1ce1a3e82369/deploy-status)](https://app.netlify.com/sites/blog-mbedded-ninja/deploys)

## 开发

1. 推荐的代码编辑器是 [Visual Studio Code](https://code.visualstudio.com/)。

1. 确保已安装 node.js。

1. 将本仓库克隆到本地。

1. 在仓库根目录下从命令行运行 `npm install`。

1. 运行 `npm run dev` 启动开发服务器，可通过 `localhost:4321` 访问。

### pagefind

[pagefind](https://pagefind.app/) 用于为博客创建静态搜索。它会在构建过程中自动运行。

### Python 环境

Python 用于运行 `scripts/` 目录中的脚本。这些脚本主要用于对内容进行批量编辑，手动操作这些内容会耗时过长。

```shell
python -m venv .venv
./.venv/scripts/activate # Windows
pip install -r scripts/requirements.txt
```

如果在 Visual Studio Code 中运行 Python 脚本，`.vscode/settings.json` 会自动将 `scripts/util` 添加到 `PYTHONPATH`。

## 构建

要构建站点并将文件放入 `dist` 目录：

```sh
npm run build
```

通常不在开发机器上运行，而仅在 Netlify 上的部署过程中运行。

## 目录结构

下面是本站点所使用的目录结构说明：

```text
|-- .vscode/
|  |--settings.json -> Contains the word dictionary for VS Code (under "cSpell.words")
|-- src/ -> Contains page content, page structure and reusable Astro components.
|  |-- content/ -> Contains content collections, which includes pages and updates.
|  |  |-- pages/ -> Contains page data (all "normal" pages, except for updates about this blog).
|     |  |-- example-page-1/
|     |  |-- _assets/ -> All images, Python scripts used to generate images, Affinity Designer/Photo files 
|     |  |               used to generate images and any other files used to create content for the page go in this `_assets/`
|     |  |               directory.
|     |  |-- example-nested-page-1/ -> Content pages can be nested to arbitrary depths depending on the
|     |  |                             desired hierarchy. This folder contains the same info as `example-page-1/`. 
|     |  |-- _index.md -> The markdown file containing the textual content for the page.
|     |-- updates/ -> Contains update pages
|-- old/ -> Deprecated content which is kept around just in case I need it again.
|-- scripts/ -> Useful Python scripts to automate some laborious tasks.
|-- templates/ -> Contains Affinity Designer diagram template, various Python script templates and a Markdown page template.
```

## 推荐的 VS Code 插件

参见 `.vscode/extensions.json`。

VS Code 的 MDX 扩展需要先运行 `npm install`，因为它使用 `remark-math` 为 `.mdx` 文件提供语法高亮（在 `tsconfig.json` 中配置）。如果 VS Code 中报错提示 MDX 服务器崩溃，很可能就是这个原因。

## 页面

所有页面（文档和博客文章）的首选文件格式是 `.mdx`（带 JSX 的 markdown）。这样可以方便地将 React 组件嵌入 Markdown 文件。

## 图片

所有图片（图表和照片）的首选文件格式是 `.webp`。它是一种现代格式，能兼顾良好的压缩率和画质。

页面封面图建议使用 1280x720px 的图片。

宽高比：

* 1:1 (1.0) - 正方形
* 4:3 - 传统比例
* 3:2 (1.5) - 常见
* 16:9 (1.78) - 常见横屏比例。常见像素尺寸为 1280x720 (HD)。
* 1.91:1 (1.91) - 例如 1200x630。Facebook 推荐。

### 图表

图表使用 Affinity Designer 绘制。

图表过去使用 _LibreOffice Draw_ 绘制，然后导出为 `.svg` 在页面上显示。Draw 文件（`.odg`）通常与显示该图表的页面位于同一内容目录中。

### 照片

照片使用 Affinity Photo 编辑。

### 视频

视频最好转换为 `.webm` 格式。

```shell
ffmpeg -y -i "input-video.mp4" -c:v libvpx-vp9 -crf 35 -b:v 0 -b:a 64k -c:a libopus -vf "scale=450:-1" -row-mt 1 -threads 4 "output-video.webm"
```

关键参数：

* -y：覆盖输出文件而不询问
* -c:v libvpx-vp9：使用 VP9 视频编解码器

下面这条命令会给视频添加水印。但我无法修复一个旋转问题：视频在 VLC 中看起来正常，在浏览器中却旋转了 90 度。

```shell
ffmpeg -y -i "input-video.mp4" -i
  "watermark.png" -filter_complex
  "[0:v]scale=480:854,setsar=1[v];[1:v]scale=80:-1[wm];[v][wm]overlay=W-w-10:H-h-10:
  enable='gte(t,0)'" -c:v libvpx-vp9 -crf 35 -b:v 0 -b:a 64k -c:a libopus
  -metadata:s:v rotate=0 -row-mt 1 -threads 4
  "output-video.webm"
```

关键参数：

* -y：覆盖输出文件而不询问
* -filter_complex：组合视频缩放和水印叠加
* scale=480:854：将视频缩放为竖屏 480x854
* scale=80:-1：将水印缩放到 80px 宽（高度自动）
* overlay=W-w-10:H-h-10：将水印放置在距右下角 10px 处
* -crf 35：提高压缩率以获得更小的文件
* -b:a 64k：降低音频比特率以节省空间

## 统计

生成博客统计信息（例如访客数量、相比去年的增长）的代码全部位于独立仓库 <https://github.com/gbmhunter/blog-stats> 中（必须独立，因为它在运行时会检出本仓库的特定提交）。

## 死链检查

`scripts/link-checker.js` 是一个自定义 Javascript 脚本，用于查找失效的内部链接。该脚本利用了 broken-link-checker 库。先构建站点、提供服务后再运行扫描，比在开发服务器上运行扫描要快得多。

首先构建站点（即使算上构建时间，这样也更快）：

```shell
npm run build
```

启动一个简单的服务器来提供站点文件，应使用 `3000` 端口：

```shell
npx serve dist/
```

然后在另一个终端中运行链接检查脚本：

```shell
node scripts/link-checker.js
```

链接检查脚本通常需要运行约 10-20 分钟。我通常每年在本地机器上手动运行几次，以清理失效链接。

## 页面大小

下图是 2024 年 2 月使用 Chrome 开发者工具分析 Resistors 页面大小的截图。

<img src="static/images/readme/resistors-page-size-feb-2024-filtered-by-domain.png" width="900"/>

如高亮所示，`3.9MB` 的数据从 `blog.mbedded.ninja` 域传输（已设置过滤器排除第三方下载）。Netlify 报告称，blog.mbedded.ninja 每月使用约 50GB，其上限为 100GB。

## 分析

Google Analytics 使用了多年（现在是 GA4），但广告拦截器也会拦截 GA 跟踪脚本。

2024-03-22，我创建了一个运行 Umami 的 AWS Lightsail 实例。Umami 是一个基础的、开源的、可免费使用（自托管时）的分析引擎。

我主要参考了 https://www.digitalocean.com/community/tutorials/how-to-install-umami-web-analytics-software-on-ubuntu-20-04 上的教程。

可通过以下命令启动 Umami：

```shell
cd /opt/umami
docker-compose up -d
```

这将启动 Umami，它监听 127.0.0.1:3000（仅本地）。Umami 服务器前面放置了一个 nginx 服务器，以提供 SSL/https 功能。SSL 证书通过 certbot 和 Let's Encrypt 提供。nginx 对外暴露，并将流量反向代理到 Umami。

有一条 `umami.mbedded.ninja` 的 DNS A 记录指向该 AWS Lightsail 实例。未来可能需要将其转换为 AAAA 和 IPv6 记录（以降低运行成本？）。

必须将 Cloudflare 中的“SSL/TLS encryption mode”从默认的“Flexible”改为“Full (strict)”，Umami 的 https 才能正常工作：

<img src="static/images/readme/cloudfare-changing-ssl-from-flexible-to-full-strict.png" width="900"/>

## 计算器小部件

`src/components/tools/` 下的每个子文件夹都是一个自包含的交互式工具（计算器、设计器、解码器、可视化器……），嵌入在博客的某处。`/tools/` 索引页（`src/content/pages/tools/index.mdx`）通过 `src/components/tools-index/` 将它们汇总到一个可搜索的卡片网格中。（`calculators`/`tools-index` 文件夹名称是历史遗留——面向用户的集合名为 “Tools”。）

有关**小部件代码结构以及 Astro / Preact 约定**，参见 `.claude/skills/tool/SKILL.md`。

### 文件夹布局（每个计算器）

```
src/components/tools/<calculator-name>/
├── <CalculatorName>.jsx     # main Preact component
├── calc.js                  # pure logic / parsers
├── catalog.js               # metadata for the calculator index
├── styles.css               # scoped CSS for the widget
└── tile.svg                 # icon shown on the calculator index card
                             # (or tile.png / tile.webp / tile.jpg — see below)
```

### 磁贴图标指南

#### 格式

支持两种格式。**首选栅格（PNG / WebP）**——大多数磁贴复用现有图稿或截图，尺寸合适的栅格在卡片中显示清晰。对于确实是矢量的图标（原理图符号、简单几何标记），SVG 是备选方案，此时清晰度和较小的文件体积更有优势。

**栅格（PNG、JPG、WebP）（首选）：**

- **推荐格式：** **WebP** —— 压缩率与画质之比最佳，并支持透明度。PNG 和 JPG 也可用，但新磁贴优先使用 WebP。
- **文件名：** 小部件文件夹内的 `tile.webp`（或 `.png`、`.jpg`）。
- **推荐尺寸：** **900 × 600 px（3:2 横向）。** 在典型屏幕上，卡片以约 144 px 宽显示磁贴，因此 900 px 宽足以超过 2×，实现清晰的高 DPI 渲染。600 × 400 是实际最小值。
- **宽高比：** **首选 3:2 横向**——它看起来像一张整洁的横向图片，也是其余磁贴正在趋向的比例。其他比例仍然可用（见下方卡片槽位说明）；它们只是被加黑边而不是裁剪，因此不会有内容被截断。
- **背景：** 首选透明（PNG / WebP），以便图片在明暗两种主题下都能与卡片背景融合。JPG 始终有背景；这种情况下请使用在两种主题下都合适的中性色（通常是中灰色或纯白色）。
- **文件大小：** 目标 < 50 KB。如有需要，可使用 [Squoosh](https://squoosh.app/) 或类似工具优化。

**SVG（备选）：**

- **文件名：** 小部件文件夹内的 `tile.svg`。
- **`viewBox`：** `0 0 150 100`——**3:2 横向画布**，与上述推荐的栅格比例一致，在卡片中比正方形显示效果更好。（较早的磁贴使用正方形 `0 0 96 96` viewBox，仍然可用——只是会加黑边；见下方卡片槽位说明。）
- **务必在根 `<svg>` 上包含显式的 `width` 和 `height` 属性**（例如 `width="150" height="100"`）——浏览器通过 `<img src="...">` 加载 SVG 时需要固有尺寸，否则 `naturalWidth` 会报告 0，且必须启用 `aspect-ratio` 回退。
- **避免使用包含 `<radialGradient>` 或其他内部引用的 `<defs>`**——当 SVG 通过 `<img>` 渲染时（索引卡片正是这样渲染磁贴），浏览器出于安全原因限制内部引用，图标可能无法渲染。请使用纯色填充 + 描边。如果确实需要，`<linearGradient>` 是可以的；出问题的是径向渐变。

**目录导入：** 在 `catalog.js` 中，无论格式如何，始终使用 `?url` 后缀导入：

```js
import tile from './tile.svg?url';  // or './tile.png?url', './tile.webp?url', etc.
```

没有 `?url` 时，Astro 对 SVG 返回组件工厂，对栅格返回元数据对象——两者都不能作为普通的 `<img src>` 值使用。

#### 卡片槽位（为什么是 3:2，以及为什么非该比例仍然可用）

在 `/tools/` 索引中，每个磁贴都渲染在一个**固定高度的槽位**内（`.tools-index__card-tile`，当前为 `height: 10rem`），并设置 `object-fit: contain`。固定高度是有意为之：它保证每张卡片的标题和描述都从相同的垂直位置开始，与图片无关。槽位高度**不**与图片宽高比绑定（早先尝试在槽位上使用 `aspect-ratio: 3 / 2` 时破坏了对齐，因为槽位高度会随卡片宽度变化）。

由于槽位高度固定且 `contain` 从不裁剪，3:2 的图片会渲染为居中的横向图片，上下带有细黑边——这仍然看起来像一张整洁的横向磁贴。按 3:2 制作可让所有磁贴视觉一致；非该比例的图片可以容忍，但黑边会更多。

#### 颜色（仅 SVG）

请一致使用以下配色：

| Hex         | 作用                             | 说明                                                              |
|-------------|----------------------------------|--------------------------------------------------------------------|
| **`#c60e00`** | 主强调色（品牌红）     | 与 `--sl-color-accent` 匹配（深色模式 `#c60e00` / 浅色模式 `#c90e00`）。用于焦点描边/填充——使图标可被识别为“我们的”元素。 |
| `#6b7280`   | 次要灰色                   | 用于上下文元素（轨道、网格线、次要标签）的中间调灰色。Tailwind 的 `gray-500`。 |
| `#5b6472` / `#4b5563` | 三级灰色                | 略微更深/更冷的灰色，用于细微结构（纬线、边框轮廓）。 |
| `#1f2937` / `#27313f` | 填充圆盘 / 面板背景 | 用于 EIRP 地图磁贴上的地球圆盘等元素的深石板色填充。在明暗两种主题下都适用，因为周围卡片背景在两种主题下本身都是深色。 |
| `#cbd5e1` / `#9ca3af` | 深色填充上的浅色文字    | 用于 BLE 磁贴上 `#1f2937` 数据包单元格内的等宽字节。 |
| `#2d9d4f`   | “合规”绿色                | 仅用于表示“正常 / 未超限”的状态指示。对应 EIRP 小部件的 `--eirp-fill-compliant`。 |
| `#c93030`   | “超限”红色                    | 仅用于表示“超出限制”的状态指示。比品牌红稍亮/偏橙，以便在两者同时出现的 EIRP 磁贴上区分。 |

**经验法则：** 如果某个元素传达计算器的身份或其主要操作，将其绘制为 `#c60e00`。如果它提供上下文（标签、边框、网格），请使用灰色。只有当计算器本身使用状态色（`#2d9d4f` / `#c93030`）时才使用它们。
