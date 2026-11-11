#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  PAGES_DIR,
  walkFiles,
  isZhFile,
  sourcePathFor,
  parseFrontmatter,
  stripFrontmatter,
  sha256,
  parseCsv,
} from './shared.mjs';

export function extract(text, regex) {
  return [...text.matchAll(regex)].map((match) => match[0]);
}

export function sameMultiset(a, b) {
  const count = (items) => {
    const map = new Map();
    for (const item of items) map.set(item, (map.get(item) ?? 0) + 1);
    return map;
  };
  const left = count(a);
  const right = count(b);
  if (left.size !== right.size) return false;
  for (const [key, value] of left) {
    if (right.get(key) !== value) return false;
  }
  return true;
}

const CODE_FENCE = /```[\s\S]*?```/g;
const INLINE_CODE = /`[^`\n]+`/g;
const IMPORT = /import\s*\(\s*(['"])([^'"]+)\1\s*\)/g;
const LINK = /\]\(([^)\s]+)\)/g;
const MATH_BLOCK = /\$\$[\s\S]*?\$\$/g;
const COMPONENT = /<([A-Z][A-Za-z0-9]*)/g;
const FOOTNOTE = /\[\^([^\]]+)\]/g;
const HEADING = /^#{1,6}\s+/gm;

function stripCode(body) {
  return body.replace(CODE_FENCE, '').replace(INLINE_CODE, '');
}

export function compareStructure(enBody, zhBody) {
  const errors = [];

  const checks = [
    ['代码块', extract(enBody, CODE_FENCE), extract(zhBody, CODE_FENCE)],
    ['行内代码', extract(stripFrontmatter(enBody).replace(CODE_FENCE, ''), INLINE_CODE), extract(stripFrontmatter(zhBody).replace(CODE_FENCE, ''), INLINE_CODE)],
    ['图片 import', [...enBody.matchAll(IMPORT)].map((m) => m[2]), [...zhBody.matchAll(IMPORT)].map((m) => m[2])],
    ['链接 URL', [...enBody.matchAll(LINK)].map((m) => m[1]), [...zhBody.matchAll(LINK)].map((m) => m[1])],
    ['公式块', extract(enBody, MATH_BLOCK), extract(zhBody, MATH_BLOCK)],
    ['组件名', [...new Set(extract(enBody, COMPONENT))], [...new Set(extract(zhBody, COMPONENT))]],
    ['脚注 key', [...enBody.matchAll(FOOTNOTE)].map((m) => m[1]), [...zhBody.matchAll(FOOTNOTE)].map((m) => m[1])],
  ];

  for (const [label, en, zh] of checks) {
    if (!sameMultiset(en, zh)) {
      errors.push(`${label}与英文原文不一致（en=${en.length}, zh=${zh.length}）`);
    }
  }

  const enHeadings = (enBody.match(HEADING) ?? []).length;
  const zhHeadings = (zhBody.match(HEADING) ?? []).length;
  if (enHeadings !== zhHeadings) {
    errors.push(`标题数量与英文原文不一致（en=${enHeadings}, zh=${zhHeadings}）`);
  }

  return errors;
}

export function checkGlossary(body, terms) {
  const errors = [];
  const warnings = [];
  const plain = stripCode(body);

  for (const term of terms) {
    if (!term.en || !term.zh) continue;

    const forbidden = (term.forbidden_zh || '')
      .split(/[;|]/)
      .map((value) => value.trim())
      .filter(Boolean);
    for (const bad of forbidden) {
      if (plain.includes(bad)) {
        errors.push(`禁用译法“${bad}”，应使用“${term.zh}”`);
      }
    }

    if (term.keep_en === 'true' && term.en !== term.zh) {
      const at = plain.indexOf(term.zh);
      if (at !== -1) {
        const window = plain.slice(at, at + term.zh.length + 40);
        const escaped = term.en.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        if (!new RegExp(`[（(]\\s*${escaped}[^）)]*[）)]`, 'i').test(window)) {
          warnings.push(`术语“${term.zh}”首次出现未括注英文“${term.en}”`);
        }
      }
    }
  }

  return { errors, warnings };
}

export function findUntranslatedParagraphs(body) {
  const cleaned = stripCode(stripFrontmatter(body))
    .replace(MATH_BLOCK, '')
    .replace(/<[^>]+>/g, '');
  const warnings = [];
  for (const paragraph of cleaned.split(/\n\s*\n/)) {
    const text = paragraph.trim();
    if (!text) continue;
    if (/^[#|>]|^\s*[-*]\s|^\s*\d+\.\s/.test(text)) continue;
    const latin = (text.match(/[A-Za-z][A-Za-z0-9'’\-]*/g) ?? []).length;
    const cjk = (text.match(/[一-鿿]/g) ?? []).length;
    if (latin > 40 && cjk < 5) {
      warnings.push(`疑似未翻译段落：${text.slice(0, 60)}…`);
    }
  }
  return warnings;
}

export function loadTerms(file = path.join(process.cwd(), 'zh/glossary/terms.csv')) {
  return parseCsv(fs.readFileSync(file, 'utf8'));
}

export function checkFile(zhFile, terms) {
  const errors = [];
  const warnings = [];
  const text = fs.readFileSync(zhFile, 'utf8');
  const data = parseFrontmatter(text);
  const enFile = path.join(PAGES_DIR, data.sourcePath || sourcePathFor(zhFile));

  for (const field of [
    'title',
    'authors',
    'date',
    'lastUpdated',
    'sourcePath',
    'sourceCommit',
    'sourceHash',
    'translatedAt',
    'translator',
    'translationStatus',
  ]) {
    if (!data[field]) errors.push(`frontmatter 缺少字段 ${field}`);
  }

  if (!fs.existsSync(enFile)) {
    errors.push(`找不到英文源文件：${path.relative(process.cwd(), enFile)}`);
    return { errors, warnings };
  }

  const actualHash = sha256(enFile);
  if (data.sourceHash !== actualHash) {
    errors.push(`sourceHash 已过期（应为 ${actualHash}）`);
  }

  const enBody = stripFrontmatter(fs.readFileSync(enFile, 'utf8'));
  const zhBody = stripFrontmatter(text);
  errors.push(...compareStructure(enBody, zhBody));

  const glossary = checkGlossary(zhBody, terms);
  errors.push(...glossary.errors);
  warnings.push(...glossary.warnings);
  warnings.push(...findUntranslatedParagraphs(text));

  return { errors, warnings };
}

function main() {
  const terms = loadTerms();
  const targets = process.argv.slice(2).length
    ? process.argv.slice(2)
    : walkFiles(PAGES_DIR).filter(isZhFile);

  let errorCount = 0;
  let warningCount = 0;

  for (const file of targets) {
    const { errors, warnings } = checkFile(file, terms);
    for (const message of errors) {
      errorCount++;
      console.error(`ERROR ${path.relative(process.cwd(), file)}: ${message}`);
    }
    for (const message of warnings) {
      warningCount++;
      console.warn(`WARN  ${path.relative(process.cwd(), file)}: ${message}`);
    }
  }

  console.log(`zh:check files=${targets.length} errors=${errorCount} warnings=${warningCount}`);
  process.exit(errorCount ? 1 : 0);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
