// SPDX-License-Identifier: AGPL-3.0-or-later
// bin/kimi-ntfy-cli.mjs
// Sub-comandos: setup, lang, server, subagents, test, status, path.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { PRIORITY_LEVELS, SUPPORTED_LANGS, resolvePriority, t } from './i18n.mjs';

const HOME = process.env.KIMI_CODE_HOME || join(homedir(), '.kimi-code');
const CONFIG_PATH = join(HOME, 'kimi-ntfy-config.json');
const DEFAULT_SERVER = 'https://ntfy.sh';

// Devuelve los strings del idioma guardado en el config, o 'en' si no hay config.
async function currentLang() {
  const cfg = await loadConfig();
  const lang = cfg?.language;
  return SUPPORTED_LANGS.includes(lang) ? lang : 'en';
}

async function loadConfig() {
  try {
    return JSON.parse(await readFile(CONFIG_PATH, 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') return {};
    throw err;
  }
}

async function saveConfig(cfg) {
  await mkdir(HOME, { recursive: true });
  await writeFile(CONFIG_PATH, JSON.stringify(cfg, null, 2), { mode: 0o600 });
}

async function help() {
  const lang = await currentLang();
  const s = t(lang);
  console.log(`kimi-ntfy-cli — kimi-ntfy plugin config manager

${s.helpUsage || 'Usage:'}
  kimi-ntfy-cli setup <topic> [server] [token]
  kimi-ntfy-cli lang <en|es>
  kimi-ntfy-cli server <url> [token]
  kimi-ntfy-cli subagents <on|off>
  kimi-ntfy-cli priority <min|low|default|high|urgent>
  kimi-ntfy-cli test [message]
  kimi-ntfy-cli status
  kimi-ntfy-cli path
`);
}

function validateTopic(topic, s) {
  if (!topic) return s.topicEmpty;
  if (topic.length > 64) return s.topicTooLong;
  if (!/^[-_A-Za-z0-9]+$/.test(topic)) return s.topicInvalid;
  return null;
}

async function cmdSetup([topic, server, token]) {
  const lang = await currentLang();
  const s = t(lang);
  const err = validateTopic(topic, s);
  if (err) {
    console.error(`Error: ${err}`);
    process.exit(2);
  }
  const cfg = await loadConfig();
  const next = {
    ...cfg,
    topic,
    server: server || cfg.server || DEFAULT_SERVER,
    language: cfg.language || 'en',
    notifySubagent: cfg.notifySubagent ?? false,
  };
  if (token) next.token = token;
  await saveConfig(next);
  console.log(`${s.configSaved} ${CONFIG_PATH}`);
  console.log(JSON.stringify(next, null, 2));
}

async function cmdLang([lang]) {
  if (!SUPPORTED_LANGS.includes(lang)) {
    console.error(`Error: ${t('en').languageInvalid}`);
    process.exit(2);
  }
  const cfg = await loadConfig();
  cfg.language = lang;
  await saveConfig(cfg);
  // Aviso en el idioma que el usuario acaba de elegir, para confirmar.
  const s = t(lang);
  console.log(`${s.languageChanged} ${lang}`);
  console.log(JSON.stringify({ ...cfg }, null, 2));
}

async function cmdServer([url, token]) {
  if (!url || !/^https?:\/\//.test(url)) {
    console.error('Error: server must start with http:// or https://');
    process.exit(2);
  }
  const cfg = await loadConfig();
  cfg.server = url;
  if (token !== undefined) cfg.token = token; // empty string clears
  await saveConfig(cfg);
  const lang = await currentLang();
  const s = t(lang);
  console.log(`${s.serverChanged} ${url}`);
  console.log(JSON.stringify({ ...cfg }, null, 2));
}

async function cmdSubagents([onoff]) {
  if (!['on', 'off'].includes(onoff)) {
    console.error('Error: use "on" or "off"');
    process.exit(2);
  }
  const cfg = await loadConfig();
  cfg.notifySubagent = onoff === 'on';
  await saveConfig(cfg);
  const lang = await currentLang();
  const s = t(lang);
  console.log(s.notifySubagent ? s.subagentsOn : s.subagentsOff);
  console.log(JSON.stringify({ ...cfg }, null, 2));
}

async function cmdPriority([level]) {
  const lang = await currentLang();
  const s = t(lang);
  if (resolvePriority(level) === null) {
    console.error(`Error: ${s.priorityInvalid}`);
    process.exit(2);
  }
  const normalized = level.toLowerCase();
  const cfg = await loadConfig();
  cfg.priority = normalized;
  await saveConfig(cfg);
  console.log(`${s.priorityChanged} ${normalized} (=${PRIORITY_LEVELS[normalized]})`);
  console.log(JSON.stringify({ ...cfg }, null, 2));
}

async function cmdTest([message]) {
  const cfg = await loadConfig();
  const lang = SUPPORTED_LANGS.includes(cfg.language) ? cfg.language : 'en';
  const s = t(lang);
  if (!cfg.topic) {
    console.error(s.noConfigForTest);
    process.exit(2);
  }
  const url = `${cfg.server || DEFAULT_SERVER}/${encodeURIComponent(cfg.topic)}`;
  const body = message || (lang === 'es' ? 'Test desde kimi-ntfy' : 'Test from kimi-ntfy');
  const res = await fetch(url, {
    method: 'POST',
    headers: { Title: 'kimi-ntfy test', Priority: '3', Tags: 'bell' },
    body,
  });
  await res.text();
  console.log(`${s.ntfyResponded} ${res.status} ${res.statusText}`);
  process.exit(0);
}

async function cmdStatus() {
  const cfg = await loadConfig();
  const lang = SUPPORTED_LANGS.includes(cfg.language) ? cfg.language : 'en';
  const s = t(lang);
  if (!cfg.topic) {
    console.log(s.noConfig);
    return;
  }
  console.log(s.configCurrent);
  console.log(JSON.stringify(cfg, null, 2));
  console.log(`\n${s.topicUrl} ${cfg.server}/${cfg.topic}`);
}

function cmdPath() {
  console.log(CONFIG_PATH);
}

const subcommand = process.argv[2];
const args = process.argv.slice(3);

const handlers = {
  setup: cmdSetup,
  lang: cmdLang,
  server: cmdServer,
  subagents: cmdSubagents,
  priority: cmdPriority,
  test: cmdTest,
  status: cmdStatus,
  path: cmdPath,
};

if (!subcommand || subcommand === '--help' || subcommand === '-h') {
  help();
} else if (handlers[subcommand]) {
  Promise.resolve(handlers[subcommand](args)).catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
} else {
  console.error(`Error: ${t('en').unknownSubcommand} ${subcommand}`);
  help();
  process.exit(2);
}
