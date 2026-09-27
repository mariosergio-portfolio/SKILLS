#!/usr/bin/env node
// Installs claude-setup/ (the CLAUDE.md index and the commands) into a .claude folder,
// replacing the {{SKILLS_HOME}} placeholder with the library path.
// Claude Code does not expand variables in CLAUDE.md or in command @-imports, so the
// installed copies must contain the real path.
//
//   node tools/install-as-claude-index-and-commands.js                          -> ~/.claude, library = this repository
//   node tools/install-as-claude-index-and-commands.js --skills-home D:/skills  -> ~/.claude, library = D:/skills
//   node tools/install-as-claude-index-and-commands.js --target C:/my/project/.claude
//   SKILLS_HOME=D:/skills node tools/install-as-claude-index-and-commands.js     (the flag wins over the variable)
const fs = require('fs'), os = require('os'), path = require('path');

const PLACEHOLDER = '{{SKILLS_HOME}}';
const root = path.resolve(__dirname, '..');
const setupDir = path.join(root, 'claude-setup');

/** Library path with forward slashes and no trailing slash, e.g. "C:/dev/source/portfolio/skills". */
function resolveSkillsHome(override) {
  const raw = override || process.env.SKILLS_HOME || root;
  return path.resolve(raw).replace(/\\/g, '/').replace(/\/+$/, '');
}

function render(text, skillsHome) {
  return text.split(PLACEHOLDER).join(skillsHome);
}

/** [source, relative target] pairs for every file claude-setup/ installs. */
function setupFiles() {
  const files = [[path.join(setupDir, 'CLAUDE.md'), 'CLAUDE.md']];
  const cmdDir = path.join(setupDir, 'commands');
  for (const c of fs.readdirSync(cmdDir).filter((f) => f.endsWith('.md'))) {
    files.push([path.join(cmdDir, c), path.join('commands', c)]);
  }
  return files;
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    if (flag !== '--skills-home' && flag !== '--target') throw new Error(`Unknown argument "${flag}"`);
    const value = argv[++i];
    if (!value) throw new Error(`${flag} needs a value`);
    args[flag.slice(2)] = value;
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const skillsHome = resolveSkillsHome(args['skills-home']);
  const target = path.resolve(args.target || path.join(os.homedir(), '.claude'));

  if (!fs.existsSync(path.join(skillsHome, 'claude-setup', 'CLAUDE.md'))) {
    throw new Error(`"${skillsHome}" is not the skills library (no claude-setup/CLAUDE.md there)`);
  }

  fs.mkdirSync(path.join(target, 'commands'), { recursive: true });
  const files = setupFiles();
  for (const [src, rel] of files) {
    fs.writeFileSync(path.join(target, rel), render(fs.readFileSync(src, 'utf8'), skillsHome));
  }
  console.log(`Installed CLAUDE.md and ${files.length - 1} commands into ${target} (library: ${skillsHome})`);
}

module.exports = { PLACEHOLDER, resolveSkillsHome, render, setupFiles };

if (require.main === module) {
  try {
    main();
  } catch (e) {
    console.error(`error: ${e.message}`);
    process.exit(1);
  }
}
