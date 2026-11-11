#!/usr/bin/env node
/**
 * Publish the Chinese translation changes to the user's fork using the GitHub
 * Git Data API, without cloning the 1.26 GB repository.
 *
 * Requirements:
 *   gh auth login          # once, with repo scope
 *
 * Usage:
 *   node scripts/zh/publish-github.mjs --dry-run
 *   node scripts/zh/publish-github.mjs
 *
 * Creates three commits on a new branch `zh`:
 *   1. routing / glossary / tooling
 *   2. 20 pilot translations
 *   3. 20 PCB translations + generated progress reports
 *
 * Only text files are sent. Images already exist in the fork and are not
 * duplicated. The script refuses to run if the `zh` branch already exists.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = process.cwd();
const REPO = 'SlimBone1995/blog_mbedded_ninja';
const BRANCH = 'zh';
const dryRun = process.argv.includes('--dry-run');
const batch3 = process.argv.includes('--batch3');
const update = process.argv.includes('--update') || batch3;

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const rel = path.posix.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(rel));
    else out.push(rel);
  }
  return out;
}

const INFRA = [
  'astro.config.mjs',
  'src/content.config.ts',
  'src/js/PageHierarchy.ts',
  'src/js/ZhCollections.ts',
  'src/components/ZhFallbackNotice.astro',
  'src/components/starlight/Footer.astro',
  'package.json',
  'ATTRIBUTION.md',
  'zh/style-guide.md',
  'zh/README.md',
  ...walk('zh/glossary'),
  ...walk('scripts/zh'),
  ...walk('.claude/skills/mbedded-ninja-zh'),
  ...walk('docs/superpowers'),
  ...walk('src/pages/zh'),
];

const PILOT = [
  'electronics/communication-protocols/i2c-communication-protocol',
  'electronics/communication-protocols/spi-communication-protocol',
  'electronics/communication-protocols/uart-communication-protocol',
  'electronics/components/capacitors',
  'electronics/components/op-amps',
  'electronics/components/resistors',
  'electronics/components/power-regulators/switch-mode-power-supplies-smps/buck-converters',
  'pcb-design/decoupling-and-noise-suppression',
  'pcb-design/layer-stackup',
  'pcb-design/component-packages/qfn-component-package',
  'pcb-design/component-packages/sot-23-component-package',
  'programming/languages/c/pointers',
  'programming/languages/c/embedded-systems-and-the-volatile-keyword',
  'programming/languages/c/bit-fields-and-bit-manipulation-masking',
  'programming/microcontrollers/stm32',
  'programming/operating-systems/freertos',
  'programming/operating-systems/zephyr',
  'programming/compilers/gcc/gnu-linker-scripts',
  'programming/languages/c-plus-plus/smart-pointers',
  'programming/design-patterns/state-machines/function-pointers',
].map((dir) => `src/content/pages/${dir}/index.zh.mdx`);

const PCB_BATCH_2 = [
  'pcb-design/castellation',
  'pcb-design/designators',
  'pcb-design/desmear-and-etchback',
  'pcb-design/general-routing-tips',
  'pcb-design/how-to-calculate-maximum-track-current',
  'pcb-design/ims-insulated-metal-substrate-pcbs',
  'pcb-design/mid-chip-solder-balls',
  'pcb-design/mouse-bites',
  'pcb-design/pads-vias-holes',
  'pcb-design/pcb-data-formats',
  'pcb-design/pcb-design-checklist',
  'pcb-design/pcb-design-tools',
  'pcb-design/pcb-layers',
  'pcb-design/pcb-surface-finishes',
  'pcb-design/prototyping',
  'pcb-design/schematic-tips-and-tricks',
  'pcb-design/soldering',
  'pcb-design/soldermask-stencils',
  'pcb-design/test-jigs',
  'pcb-design/testpoints',
].map((dir) => `src/content/pages/${dir}/index.zh.mdx`);

const GROUPS = [
  {
    message: 'feat(zh): add routing, glossary and translation tooling',
    files: INFRA,
  },
  {
    message: 'feat(zh): translate 20 pilot pages',
    files: PILOT,
  },
  {
    message: 'feat(zh): translate 20 PCB pages and add progress tracking',
    files: [...PCB_BATCH_2, 'zh/status.json', 'zh/ZH_TODO.md', 'zh/translation-runs.csv'],
  },
];

const UPDATE_FILES = [
  'README.md',
  'README.zh.md',
  'src/components/starlight/SocialIcons.astro',
  'zh/README.md',
];

const BATCH3_FILES = [
  'bga-component-package',
  'chip-carrier-packages',
  'chip-eia-component-packages',
  'crystal-packages',
  'dfn-component-package',
  'dip-component-package',
  'dsop-advance-component-package',
  'lga-component-package',
  'mini-dip-spm-component-package',
  'msop-component-package',
  'pdip-component-package',
  'plcc-component-package',
  'qfp-component-package',
  'sma-do-214ac-component-package',
  'smb-do-214aa-component-package',
  'smc-do-214ab-component-package',
  'smd-220-component-package',
  'smd-electrolytic-capacitor-packages',
  'smd-inductor-packages',
  'smd-tantalum-capacitor-packages',
  'smd35-component-package',
  'sod-123-component-package',
  'sod-123f-component-package',
  'soic-component-package',
  'sop-component-package',
  'sot-23f-component-package',
  'ssop-component-package',
  'to-220-component-package',
  'to-247-component-package',
  'to-252-component-package',
].map((dir) => `src/content/pages/pcb-design/component-packages/${dir}/index.zh.mdx`);

BATCH3_FILES.push(
  'zh/glossary/terms.csv',
  'zh/translation-runs.csv',
  'zh/status.json',
  'zh/ZH_TODO.md',
  'start-zh-preview.bat',
  'scripts/zh/publish-github.mjs',
);

const groupsToPublish = batch3
  ? [{ message: 'feat(zh): translate 30 PCB component-package pages', files: BATCH3_FILES }]
  : update
    ? [{ message: 'feat(zh): add language switcher and Chinese README', files: UPDATE_FILES }]
    : GROUPS;

function gh(args, input) {
  return execFileSync('gh', args, {
    cwd: ROOT,
    input,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  }).trim();
}

function api(endpoint, method = 'GET', body) {
  if (body === undefined) {
    return JSON.parse(gh(['api', endpoint, '--method', method]));
  }
  return JSON.parse(
    gh(['api', endpoint, '--method', method, '--input', '-'], JSON.stringify(body)),
  );
}

function checkFiles() {
  const seen = new Set();
  let bytes = 0;
  for (const group of groupsToPublish) {
    group.files = [...new Set(group.files)];
    for (const file of group.files) {
      if (seen.has(file)) throw new Error(`file listed twice: ${file}`);
      seen.add(file);
      if (/\.(png|jpe?g|webp|gif|svg|avif|mp4|webm|pdf|afdesign|afphoto|odg|zip)$/i.test(file)) {
        throw new Error(`refusing binary file: ${file}`);
      }
      const abs = path.join(ROOT, file);
      if (!fs.existsSync(abs)) throw new Error(`missing file: ${file}`);
      bytes += fs.statSync(abs).size;
    }
  }
  return { count: seen.size, bytes };
}

const { count, bytes } = checkFiles();
console.log(`files: ${count}, text bytes: ${bytes}`);
for (const group of groupsToPublish) {
  console.log(`- ${group.message}: ${group.files.length} files`);
}

if (dryRun) {
  console.log('dry-run: no API calls made.');
  process.exit(0);
}

try {
  gh(['auth', 'status']);
} catch {
  console.error('Not logged in. Run: gh auth login');
  process.exit(1);
}

let parent;
if (update) {
  parent = api(`repos/${REPO}/git/ref/heads/${BRANCH}`).object.sha;
} else {
  const masterRef = api(`repos/${REPO}/git/ref/heads/master`);
  parent = masterRef.object.sha;

  try {
    api(`repos/${REPO}/git/ref/heads/${BRANCH}`);
    console.error(`Branch ${BRANCH} already exists. Use --update to add commits.`);
    process.exit(1);
  } catch (error) {
    if (!String(error.message).includes('Not Found')) throw error;
  }
}

for (const group of groupsToPublish) {
  const parentCommit = api(`repos/${REPO}/git/commits/${parent}`);
  const entries = [];
  for (const file of group.files) {
    const body = {
      content: fs.readFileSync(path.join(ROOT, file)).toString('base64'),
      encoding: 'base64',
    };
    const blob = api(`repos/${REPO}/git/blobs`, 'POST', body);
    entries.push({ path: file, mode: '100644', type: 'blob', sha: blob.sha });
  }
  const tree = api(`repos/${REPO}/git/trees`, 'POST', {
    base_tree: parentCommit.tree.sha,
    tree: entries,
  });
  const commit = api(`repos/${REPO}/git/commits`, 'POST', {
    message: group.message,
    tree: tree.sha,
    parents: [parent],
  });
  parent = commit.sha;
  console.log(`commit ${parent.slice(0, 7)}: ${group.message}`);
}

if (update) {
  api(`repos/${REPO}/git/refs/heads/${BRANCH}`, 'PATCH', { sha: parent, force: false });
  console.log(`updated branch ${BRANCH} to ${parent}`);
} else {
  api(`repos/${REPO}/git/refs`, 'POST', {
    ref: `refs/heads/${BRANCH}`,
    sha: parent,
  });
  console.log(`created branch ${BRANCH} at ${parent}`);
}
