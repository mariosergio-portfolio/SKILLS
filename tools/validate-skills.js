#!/usr/bin/env node
// Validates every SKILL.md in this library against the Claude Agent Skills rules.
// Usage: node tools/validate-skills.js   (exit code 1 on any error)
const fs = require('fs'), path = require('path');

const root = path.resolve(__dirname, '..');
const MAX_BODY_LINES = 500;
const KNOWN_KEYS = new Set([
  'name', 'description', 'license', 'allowed-tools', 'metadata', 'compatibility',
  'argument-hint', 'disable-model-invocation', 'user-invocable', 'model', 'context', 'agent', 'hooks', 'when_to_use',
]);
// Skills mentioned as future work; referencing them is allowed.
const PLANNED = new Set(['infra-terraform-aws', 'infra-terraform-azure']);
// Build artifact names that look like skill names but are not.
const NOT_SKILLS = new Set(['webstore-java-api', 'webstore-kotlin-api', 'webstore-frontend']);
const SKILL_REF = /`((?:tech|infra|webstore)-[a-z0-9-]+)`/g;

const skills = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.') || e.name === 'node_modules' || e.name === 'references') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name === 'SKILL.md') skills.push(p);
  }
})(root);

const errors = [], warnings = [];
const err = (f, m) => errors.push(`${path.relative(root, f)}: ${m}`);
const warn = (f, m) => warnings.push(`${path.relative(root, f)}: ${m}`);
const names = new Map();

for (const file of skills) {
  const dir = path.dirname(file);
  const dirName = path.basename(dir);
  const text = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  const m = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) { err(file, 'missing YAML frontmatter delimited by --- lines at the top'); continue; }
  const [, fm, body] = m;

  const meta = {};
  for (const line of fm.split('\n')) {
    const kv = line.match(/^([A-Za-z_-]+):\s*(.*)$/);
    if (kv) meta[kv[1]] = kv[2].trim().replace(/^(["'])(.*)\1$/, '$2');
  }
  for (const k of Object.keys(meta)) if (!KNOWN_KEYS.has(k)) warn(file, `unknown frontmatter key "${k}"`);

  const name = meta.name;
  if (!name) err(file, 'frontmatter "name" is required');
  else {
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name)) err(file, `name "${name}" must be lowercase letters, digits and single hyphens`);
    if (name.length > 64) err(file, `name "${name}" is longer than 64 characters`);
    if (/anthropic|claude/.test(name)) err(file, `name "${name}" must not contain "anthropic" or "claude"`);
    if (name !== dirName) err(file, `name "${name}" must match its folder name "${dirName}"`);
    if (names.has(name)) err(file, `duplicate skill name "${name}" (also in ${path.relative(root, names.get(name))})`);
    names.set(name, file);
  }

  const desc = meta.description;
  if (!desc) err(file, 'frontmatter "description" is required');
  else {
    if (desc.length > 1024) err(file, `description is ${desc.length} characters (max 1024)`);
    if (/[<>]/.test(desc)) err(file, 'description must not contain XML tags or angle brackets');
    if (!/\buse when\b/i.test(desc)) warn(file, 'description should say when to use the skill ("Use when ...")');
  }

  const bodyLines = body.split('\n').length;
  if (bodyLines > MAX_BODY_LINES) err(file, `body is ${bodyLines} lines (keep under ${MAX_BODY_LINES}; move detail into references/)`);

  if (/(^|[\s`(])%(tech|infra|webstore)-/m.test(text)) err(file, 'uses the legacy "%skill-name" syntax; reference skills by plain name or /skill-name');

  // Nested SKILL.md files are not discovered by Claude.
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory() && fs.existsSync(path.join(dir, e.name, 'SKILL.md'))) err(file, `contains nested skill "${e.name}"; skills must be siblings`);
  }

  // Relative links (SKILL.md and its reference files) must resolve.
  const docs = [file];
  const refDir = path.join(dir, 'references');
  if (fs.existsSync(refDir)) for (const r of fs.readdirSync(refDir)) docs.push(path.join(refDir, r));
  for (const doc of docs) {
    const t = fs.readFileSync(doc, 'utf8');
    for (const [, target] of t.matchAll(/\]\(([^)#\s]+)(?:#[^)]*)?\)/g)) {
      if (/^[a-z]+:/i.test(target)) continue;
      if (!fs.existsSync(path.resolve(path.dirname(doc), target))) err(doc, `broken link "${target}"`);
    }
  }
  skills[skills.indexOf(file)] = { file, text };
}

// Cross-skill references must point at skills that exist.
for (const { file, text } of skills.filter(s => s.file)) {
  const refDir = path.join(path.dirname(file), 'references');
  let all = text;
  if (fs.existsSync(refDir)) for (const r of fs.readdirSync(refDir)) all += fs.readFileSync(path.join(refDir, r), 'utf8');
  for (const [, ref] of all.matchAll(SKILL_REF)) {
    if (!names.has(ref) && !PLANNED.has(ref) && !NOT_SKILLS.has(ref) && /^[a-z0-9-]+$/.test(ref)) warn(file, `references "${ref}", which is not a skill in this library`);
  }
}

for (const w of [...new Set(warnings)]) console.log(`warning  ${w}`);
for (const e of errors) console.log(`error    ${e}`);
console.log(`\n${names.size} skills checked: ${errors.length} error(s), ${new Set(warnings).size} warning(s)`);
process.exit(errors.length ? 1 : 0);
