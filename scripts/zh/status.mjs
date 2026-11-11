#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  ROOT,
  PAGES_DIR,
  walkFiles,
  parseFrontmatter,
  sha256,
  relativeToPages,
  isZhFile,
  isEnglishFile,
  sourcePathFor,
  parseCsv,
} from './shared.mjs';

/**
 * Compare English sources with Chinese translations.
 *
 * @param {string[]} enFiles absolute paths of English .md/.mdx files
 * @param {string[]} zhFiles absolute paths of .zh.md/.zh.mdx files
 */
export function buildReport(enFiles, zhFiles) {
  const enSet = new Set(enFiles.map(relativeToPages));
  const translatedSources = new Set();
  const current = [];
  const stale = [];
  const orphan = [];

  for (const zhFile of zhFiles) {
    const zhRel = relativeToPages(zhFile);
    const data = parseFrontmatter(fs.readFileSync(zhFile, 'utf8'));
    const sourceRel = data.sourcePath || relativeToPages(sourcePathFor(zhFile));
    const sourceAbs = path.join(PAGES_DIR, sourceRel);
    translatedSources.add(sourceRel);

    if (!fs.existsSync(sourceAbs)) {
      orphan.push({ zh: zhRel, source: sourceRel });
      continue;
    }

    const actual = sha256(sourceAbs);
    if (data.sourceHash === actual) {
      current.push({ zh: zhRel, source: sourceRel });
    } else {
      stale.push({
        zh: zhRel,
        source: sourceRel,
        expected: data.sourceHash ?? null,
        actual,
        sourceCommit: data.sourceCommit ?? null,
      });
    }
  }

  const missing = [...enSet]
    .filter((rel) => !translatedSources.has(rel))
    .sort();

  return { current, stale, missing, orphan };
}

function progressBar(done, total, width = 30) {
  const ratio = total > 0 ? Math.min(1, done / total) : 0;
  const filled = Math.round(ratio * width);
  return `${'█'.repeat(filled)}${'░'.repeat(width - filled)}`;
}

function loadRuns() {
  const file = path.join(ROOT, 'zh/translation-runs.csv');
  if (!fs.existsSync(file)) return [];
  return parseCsv(fs.readFileSync(file, 'utf8')).map((row) => ({
    date: row.date ?? '',
    batch: row.batch ?? '',
    agent: row.agent ?? '',
    pages: Number(row.pages) || 0,
    tokens: row.tokens ? Number(row.tokens) : null,
    duration: Number(row.duration_s) || 0,
    notes: row.notes ?? '',
  }));
}

function formatNumber(value) {
  return value == null ? '—' : value.toLocaleString('en-US');
}

function formatDuration(seconds) {
  if (!seconds) return '—';
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return minutes ? `${minutes}m ${rest}s` : `${rest}s`;
}

function renderRuns(runs) {
  const withTokens = runs.filter((run) => run.tokens != null);
  const totalPages = withTokens.reduce((sum, run) => sum + run.pages, 0);
  const totalTokens = withTokens.reduce((sum, run) => sum + run.tokens, 0);
  const totalDuration = withTokens.reduce((sum, run) => sum + run.duration, 0);
  const tokensPerPage = totalPages ? Math.round(totalTokens / totalPages) : null;

  let md = `## Token 消耗\n\n`;
  md += `| 日期 | 批次 | 执行者 | 页数 | Tokens | Tokens/页 | 耗时 | 备注 |\n`;
  md += `|---|---|---|---:|---:|---:|---:|---|\n`;
  for (const run of runs) {
    md +=
      `| ${run.date} | ${run.batch} | ${run.agent} | ${run.pages} | ` +
      `${formatNumber(run.tokens)} | ` +
      `${run.tokens != null && run.pages ? formatNumber(Math.round(run.tokens / run.pages)) : '—'} | ` +
      `${formatDuration(run.duration)} | ${run.notes} |\n`;
  }
  md +=
    `| **合计** | | | **${totalPages}** | **${formatNumber(totalTokens)}** | ` +
    `**${formatNumber(tokensPerPage)}** | **${formatDuration(totalDuration)}** | 仅统计有 token 记录的批次 |\n\n`;
  md +=
    `> Token 数为子代理会话的累计用量（含读取原文、校验和工具调用），不是纯翻译成本；` +
    `主会话直接翻译的页面未单独计量。每次翻译后可用 \`npm run zh:log\` 追加记录。\n\n`;
  return md;
}

function renderTodo(report, generatedAt, totalPages, runs) {
  const translated = report.current.length + report.stale.length;
  const percent = totalPages ? ((translated / totalPages) * 100).toFixed(1) : '0.0';
  const groups = new Map();
  for (const rel of report.missing) {
    const top = rel.split('/')[0];
    if (!groups.has(top)) groups.set(top, []);
    groups.get(top).push(rel);
  }

  let md = `# 中文翻译待办\n\n生成时间：${generatedAt}\n\n`;
  md += `## 翻译进度\n\n`;
  md += `\`${progressBar(translated, totalPages)}\` **${translated} / ${totalPages}（${percent}%）**\n\n`;
  md += `| 状态 | 数量 |\n|---|---:|\n`;
  md += `| current | ${report.current.length} |\n`;
  md += `| stale | ${report.stale.length} |\n`;
  md += `| missing | ${report.missing.length} |\n`;
  md += `| orphan | ${report.orphan.length} |\n\n`;
  md += renderRuns(runs);

  if (report.stale.length) {
    md += `## 待更新（stale）\n\n`;
    for (const item of report.stale) {
      md += `- [ ] \`${item.source}\` → \`${item.zh}\`\n`;
      if (item.sourceCommit) {
        md += `  - \`git diff ${item.sourceCommit}..HEAD -- ${item.source}\`\n`;
      }
    }
    md += '\n';
  }

  if (report.orphan.length) {
    md += `## 孤立译文（找不到英文源文件）\n\n`;
    for (const item of report.orphan) {
      md += `- [ ] \`${item.zh}\`（期望源文件：\`${item.source}\`）\n`;
    }
    md += '\n';
  }

  for (const [top, items] of [...groups.entries()].sort()) {
    md += `## 未翻译：${top}（${items.length}）\n\n`;
    for (const rel of items) md += `- [ ] ${rel}\n`;
    md += '\n';
  }

  return md;
}

function main() {
  const all = walkFiles(PAGES_DIR);
  const enFiles = all.filter(isEnglishFile);
  const zhFiles = all.filter(isZhFile);
  const report = buildReport(enFiles, zhFiles);
  const generatedAt = new Date().toISOString();
  const runs = loadRuns();

  fs.mkdirSync(path.join(ROOT, 'zh'), { recursive: true });
  fs.writeFileSync(
    path.join(ROOT, 'zh/status.json'),
    `${JSON.stringify({ generatedAt, counts: {
      current: report.current.length,
      stale: report.stale.length,
      missing: report.missing.length,
      orphan: report.orphan.length,
    }, ...report }, null, 2)}\n`,
  );
  fs.writeFileSync(path.join(ROOT, 'zh/ZH_TODO.md'), renderTodo(report, generatedAt, enFiles.length, runs));

  console.log(
    `zh:status current=${report.current.length} stale=${report.stale.length} ` +
      `missing=${report.missing.length} orphan=${report.orphan.length}`,
  );
  for (const item of report.stale) console.log(`  stale: ${item.source} -> ${item.zh}`);
  for (const item of report.orphan) console.log(`  orphan: ${item.zh} (missing ${item.source})`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
