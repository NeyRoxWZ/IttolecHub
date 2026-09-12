#!/usr/bin/env node
/**
 * Patch notes, kept in the repo.
 *
 *   npm run note -- <scope> <type> "Titre" ["Détails"]   add a pending entry
 *   npm run notes:status                                  list what is pending
 *   npm run release -- [1.2.0] ["Titre de la version"]    publish the pending entries
 *
 * Entries pile up in patch-notes/unreleased.json while work happens. Nothing
 * reaches players until a release moves them into patch-notes/releases.json,
 * which is what the site reads — so the owner decides when a version ships,
 * and every past version stays in that file.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const file = (name) => resolve(root, 'patch-notes', name);
const read = (path) => JSON.parse(readFileSync(path, 'utf8'));
const write = (path, data) => writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`);
const today = () => new Date().toISOString().slice(0, 10);

const TYPES = ['nouveau', 'amelioration', 'equilibrage', 'correctif', 'retrait'];
const SEMVER = /^\d+\.\d+\.\d+$/;

function fail(message) {
  console.error(`✖ ${message}`);
  process.exit(1);
}

const [command, ...args] = process.argv.slice(2);
const scopeIds = read(file('scopes.json')).scopes.map((s) => s.id);

if (command === 'add') {
  const [scope, type, title, details] = args;
  if (!scope || !type || !title) {
    fail(`Usage : npm run note -- <scope> <type> "Titre" ["Détails"]\n  Scopes : ${scopeIds.join(', ')}\n  Types : ${TYPES.join(', ')}`);
  }
  if (!scopeIds.includes(scope)) fail(`Scope inconnu « ${scope} ». Scopes : ${scopeIds.join(', ')}`);
  if (!TYPES.includes(type)) fail(`Type inconnu « ${type} ». Types : ${TYPES.join(', ')}`);

  const pending = read(file('unreleased.json'));
  const date = today();
  // Ids only need to be unique; date-prefixed so the file reads in order.
  const sameDay = pending.entries.filter((e) => e.id.startsWith(date)).length;
  const entry = {
    id: `${date}-${String(sameDay + 1).padStart(2, '0')}`,
    date,
    scope,
    type,
    title: title.trim(),
    ...(details && details.trim() ? { details: details.trim() } : {}),
  };
  pending.entries.push(entry);
  write(file('unreleased.json'), pending);
  console.log(`✔ [${type}] ${scope} — ${entry.title}  (${pending.entries.length} en attente)`);
} else if (command === 'status') {
  const { entries } = read(file('unreleased.json'));
  const { releases } = read(file('releases.json'));
  console.log(`Dernière version publiée : ${releases[0] ? `${releases[0].version} (${releases[0].date})` : 'aucune'}`);
  if (!entries.length) {
    console.log('Aucune entrée en attente.');
  } else {
    console.log(`${entries.length} entrée(s) en attente :`);
    for (const e of entries) console.log(`  - [${e.type}] ${e.scope} — ${e.title}`);
  }
} else if (command === 'release') {
  const pending = read(file('unreleased.json'));
  if (!pending.entries.length) fail('Aucune entrée en attente : rien à publier.');

  const pkgPath = resolve(root, 'package.json');
  const pkg = read(pkgPath);

  // The version is optional: `npm run release -- "Grosse mise à jour"` bumps
  // it automatically and takes the words as the title.
  let [first, ...rest] = args;
  let version;
  if (first && SEMVER.test(first)) {
    version = first;
  } else {
    if (first) rest = [first, ...rest];
    const [major, minor] = String(pkg.version || '0.0.0').split('.').map(Number);
    version = major === 0 ? '1.0.0' : `${major}.${minor + 1}.0`;
  }

  const history = read(file('releases.json'));
  if (history.releases.some((r) => r.version === version)) fail(`La version ${version} existe déjà.`);

  const title = rest.join(' ').trim() || `Version ${version}`;
  history.releases.unshift({ version, date: today(), title, entries: pending.entries });
  write(file('releases.json'), history);
  write(file('unreleased.json'), { entries: [] });

  pkg.version = version;
  write(pkgPath, pkg);

  console.log(`✔ Version ${version} « ${title} » publiée avec ${pending.entries.length} entrée(s).`);
  console.log('  Il reste à commiter et pousser pour qu’elle apparaisse sur le site.');
} else {
  fail('Commandes : add, status, release.');
}
