#!/usr/bin/env node
/**
 * Download content images from the upstream GitHub repository.
 *
 * The repository is cloned with a blobless partial clone and a sparse
 * checkout (text only), so images referenced by MDX are not present locally.
 * Astro's content layer resolves every image import at dev/build start, so the
 * files must exist even when previewing a single page.
 *
 * Usage:
 *   node scripts/zh/fetch-assets.mjs            # all images under src/content/pages
 *   node scripts/zh/fetch-assets.mjs --dry-run  # list what would be downloaded
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = process.cwd();
const RAW_BASE = 'https://raw.githubusercontent.com/gbmhunter/blog/master/';
const IMAGE_EXT = /\.(png|jpe?g|webp|gif|svg|avif|mp4|webm|csv|json|txt|js|mjs|ts|py|html|xml|ya?ml)$/i;
const CONCURRENCY = 8;
const dryRun = process.argv.includes('--dry-run');

const files = execFileSync('git', ['ls-tree', '-r', '--name-only', 'HEAD'], {
  cwd: ROOT,
  encoding: 'utf8',
})
  .split(/\r?\n/)
  .filter((file) => file.startsWith('src/') && IMAGE_EXT.test(file));

const missing = files.filter((file) => !fs.existsSync(path.join(ROOT, file)));

console.log(`tracked content assets: ${files.length}, missing: ${missing.length}`);
if (dryRun) {
  for (const file of missing) console.log(file);
  process.exit(0);
}

let index = 0;
let done = 0;
let failed = 0;

async function download(file) {
  const target = path.join(ROOT, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const url = RAW_BASE + file.split('/').map(encodeURIComponent).join('/');

  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const buffer = Buffer.from(await response.arrayBuffer());
      fs.writeFileSync(target, buffer);
      return;
    } catch (error) {
      if (attempt === 3) throw error;
      await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
    }
  }
}

async function worker() {
  while (index < missing.length) {
    const file = missing[index++];
    try {
      await download(file);
      done++;
    } catch (error) {
      failed++;
      console.error(`FAILED ${file}: ${error.message}`);
    }
    if ((done + failed) % 100 === 0) {
      console.log(`progress ${done + failed}/${missing.length}`);
    }
  }
}

await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
console.log(`downloaded: ${done}, failed: ${failed}`);
process.exit(failed ? 1 : 0);
