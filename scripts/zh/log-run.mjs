#!/usr/bin/env node
/**
 * Append a translation run to zh/translation-runs.csv.
 *
 * Usage:
 *   node scripts/zh/log-run.mjs --batch "PCB batch 3" --agent A --pages 10 \
 *     --tokens 90000 --duration 300
 *
 * All flags are optional except --batch. Missing tokens are allowed (the
 * status report will show "—" and exclude the row from the total).
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const FILE = path.join(ROOT, 'zh/translation-runs.csv');

function readArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    if (!key.startsWith('--')) continue;
    const name = key.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      args[name] = 'true';
    } else {
      args[name] = next;
      i++;
    }
  }
  return args;
}

function csvCell(value) {
  const text = value == null ? '' : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

const args = readArgs(process.argv.slice(2));
if (!args.batch) {
  console.error('Usage: node scripts/zh/log-run.mjs --batch "<name>" [--agent A] [--pages N] [--tokens N] [--duration S] [--notes "..."]');
  process.exit(1);
}

const date = args.date || new Date().toISOString().slice(0, 10);
const row = [
  date,
  args.batch,
  args.agent || '',
  args.pages || '',
  args.tokens || '',
  args.duration || '',
  args.notes || '',
].map(csvCell).join(',');

fs.mkdirSync(path.dirname(FILE), { recursive: true });
if (!fs.existsSync(FILE)) {
  fs.writeFileSync(FILE, 'date,batch,agent,pages,tokens,duration_s,notes\n');
}
fs.appendFileSync(FILE, `${row}\n`);
console.log(`logged: ${row}`);
