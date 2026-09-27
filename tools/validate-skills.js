#!/usr/bin/env node
// Validates every SKILL.md in this library against the Claude Agent Skills rules.
// Usage: node tools/validate-skills.js   (exit code 1 on any error)
const fs = require('fs'), path = require('path');
const setup = require('./install-as-claude-index-and-commands.js');

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

// The CLAUDE.md index (claude-setup/) must list every skill, with the right name, and only existing paths.
const setupDir = path.join(root, 'claude-setup');
const indexFile = path.join(setupDir, 'CLAUDE.md');
if (fs.existsSync(indexFile)) {
  const index = fs.readFileSync(indexFile, 'utf8');
  const base = (index.match(/\*\*`([^`]+)`\*\*/) || [])[1]; // library base path declared in CLAUDE.md
  if (base !== `${setup.PLACEHOLDER}/`) err(indexFile, `library path must be the placeholder "${setup.PLACEHOLDER}/", not "${base}"; the installer fills it in`);
  const toLocal = p => path.resolve(root, base && p.startsWith(base) ? p.slice(base.length) : p);
  const indexed = new Map(); // path -> name
  for (const [, name, p] of index.matchAll(/^\|[^|]*\|\s*`([a-z0-9-]+)`\s*\|\s*`([^`]+)`\s*\|\s*$/gm)) {
    indexed.set(path.resolve(root, p), name);
    if (!fs.existsSync(path.resolve(root, p))) err(indexFile, `index row "${name}" points to missing file "${p}"`);
    else if (path.basename(path.dirname(path.resolve(root, p))) !== name) err(indexFile, `index row "${name}" points to "${p}", which is a different skill`);
  }
  for (const { file } of skills.filter(s => s.file)) {
    if (!indexed.has(path.resolve(file))) err(indexFile, `skill "${path.basename(path.dirname(file))}" is missing from the index`);
  }
  const cmdDir = path.join(setupDir, 'commands');
  const cmds = fs.existsSync(cmdDir) ? fs.readdirSync(cmdDir).filter(f => f.endsWith('.md')) : [];
  for (const c of cmds) {
    const t = fs.readFileSync(path.join(cmdDir, c), 'utf8');
    for (const [, p] of t.matchAll(/(?:^@|`)((?:\{\{SKILLS_HOME\}\}|(?:[A-Za-z]:)?)\/[^`\s]+\.(?:md|sh))/gm)) {
      if (!fs.existsSync(toLocal(p))) err(path.join(cmdDir, c), `references missing file "${p}"`);
    }
  }
  // Installed copies that drifted from claude-setup/
  const home = path.join(require('os').homedir(), '.claude');
  // Compared after filling in the placeholder, with the same library path the installer would use.
  const skillsHome = setup.resolveSkillsHome();
  const same = (a, b) => fs.existsSync(b) && setup.render(fs.readFileSync(a, 'utf8'), skillsHome) === fs.readFileSync(b, 'utf8');
  if (fs.existsSync(path.join(home, 'CLAUDE.md')) && !same(indexFile, path.join(home, 'CLAUDE.md'))) warn(indexFile, `installed copy ${path.join(home, 'CLAUDE.md')} differs; run node tools/install-as-claude-index-and-commands.js`);
  for (const c of cmds) {
    const installed = path.join(home, 'commands', c);
    if (fs.existsSync(path.join(home, 'commands')) && !same(path.join(cmdDir, c), installed)) warn(path.join(cmdDir, c), `installed copy ${installed} is missing or differs; run node tools/install-as-claude-index-and-commands.js`);
  }
}

for (const w of [...new Set(warnings)]) console.log(`warning  ${w}`);
for (const e of errors) console.log(`error    ${e}`);
console.log(`\n${names.size} skills checked: ${errors.length} error(s), ${new Set(warnings).size} warning(s)`);
process.exit(errors.length ? 1 : 0);
