// SPDX-License-Identifier: AGPL-3.0-or-later
// bin/kimi-ntfy-cli.mjs
// Sub-comandos: setup, lang, server, subagents, session, approval, turnend, priority, test, status, path, version, -v, --version.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PRIORITY_LEVELS, SUPPORTED_LANGS, resolvePriority, t } from './i18n.mjs';

const HOME = process.env.KIMI_CODE_HOME || join(homedir(), '.kimi-code');
const CONFIG_PATH = join(HOME, 'kimi-ntfy-config.json');
const DEFAULT_SERVER = 'https://ntfy.sh';
// Read version from the plugin's package.json next to this script.
const PLUGIN_DIR = dirname(fileURLToPath(import.meta.url));
const PLUGIN_VERSION = await readFile(join(PLUGIN_DIR, '..', 'package.json'), 'utf8')
  .then((s) => JSON.parse(s).version)
  .catch(() => 'unknown');

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
  kimi-ntfy-cli session <on|off>
  kimi-ntfy-cli approval <on|off>
  kimi-ntfy-cli turnend <on|off>
  kimi-ntfy-cli priority <min|low|default|high|urgent|reset>
  kimi-ntfy-cli test [message]
  kimi-ntfy-cli status
  kimi-ntfy-cli path
  kimi-ntfy-cli version
`);
}

function normalizeServer(url) {
  return url ? url.replace(/\/+$/, '') : url;
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
  if (server && !/^https?:\/\//.test(server)) {
    console.error(`Error: ${s.serverInvalid}`);
    process.exit(2);
  }
  const cfg = await loadConfig();
  const normalizedServer = server
    ? normalizeServer(server)
    : cfg.server
      ? normalizeServer(cfg.server)
      : DEFAULT_SERVER;
  const next = {
    ...cfg,
    topic,
    server: normalizedServer,
    language: cfg.language || 'en',
    notifySubagent: cfg.notifySubagent ?? false,
    notifySessionEnd: cfg.notifySessionEnd ?? true,
    notifyApproval: cfg.notifyApproval ?? true,
    notifyTurnEnd: cfg.notifyTurnEnd ?? true,
  };
  if (token !== undefined) next.token = token;
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
  const lang = await currentLang();
  const s = t(lang);
  if (!url || !/^https?:\/\//.test(url)) {
    console.error(`Error: ${s.serverInvalid}`);
    process.exit(2);
  }
  const cfg = await loadConfig();
  cfg.server = normalizeServer(url);
  if (token !== undefined) cfg.token = token; // empty string clears
  await saveConfig(cfg);
  console.log(`${s.serverChanged} ${cfg.server}`);
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
  console.log(cfg.notifySubagent ? s.subagentsOn : s.subagentsOff);
  console.log(JSON.stringify({ ...cfg }, null, 2));
}

async function cmdSession([onoff]) {
  if (!['on', 'off'].includes(onoff)) {
    console.error('Error: use "on" or "off"');
    process.exit(2);
  }
  const cfg = await loadConfig();
  cfg.notifySessionEnd = onoff === 'on';
  await saveConfig(cfg);
  const lang = await currentLang();
  const s = t(lang);
  console.log(cfg.notifySessionEnd ? s.sessionOn : s.sessionOff);
  console.log(JSON.stringify({ ...cfg }, null, 2));
}

async function cmdApproval([onoff]) {
  if (!['on', 'off'].includes(onoff)) {
    console.error('Error: use "on" or "off"');
    process.exit(2);
  }
  const cfg = await loadConfig();
  cfg.notifyApproval = onoff === 'on';
  await saveConfig(cfg);
  const lang = await currentLang();
  const s = t(lang);
  console.log(cfg.notifyApproval ? s.approvalOn : s.approvalOff);
  console.log(JSON.stringify({ ...cfg }, null, 2));
}

async function cmdTurnEnd([onoff]) {
  if (!['on', 'off'].includes(onoff)) {
    console.error('Error: use "on" or "off"');
    process.exit(2);
  }
  const cfg = await loadConfig();
  cfg.notifyTurnEnd = onoff === 'on';
  await saveConfig(cfg);
  const lang = await currentLang();
  const s = t(lang);
  console.log(cfg.notifyTurnEnd ? s.turnEndOn : s.turnEndOff);
  console.log(JSON.stringify({ ...cfg }, null, 2));
}

async function cmdPriority([level]) {
  const lang = await currentLang();
  const s = t(lang);
  if (!level) {
    console.error(`Error: ${s.priorityInvalid}`);
    process.exit(2);
  }
  const normalized = level.toLowerCase();
  const cfg = await loadConfig();
  if (['reset', 'clear', 'none', 'unset'].includes(normalized)) {
    cfg.priority = undefined;
    await saveConfig(cfg);
    console.log(s.priorityReset);
    console.log(JSON.stringify({ ...cfg }, null, 2));
    return;
  }
  if (resolvePriority(level) === null) {
    console.error(`Error: ${s.priorityInvalid}`);
    process.exit(2);
  }
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
  const server = normalizeServer(cfg.server || DEFAULT_SERVER);
  const url = `${server}/${encodeURIComponent(cfg.topic)}`;
  const body = message || (lang === 'es' ? 'Test desde kimi-ntfy' : 'Test from kimi-ntfy');
  const priority = cfg.priority ? String(resolvePriority(cfg.priority) ?? 3) : '3';
  const headers = { Title: 'kimi-ntfy test', Priority: priority, Tags: 'bell' };
  if (cfg.token) {
    headers.Authorization = `Bearer ${cfg.token}`;
  }
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body,
    });
    await res.text();
    console.log(`${s.ntfyResponded} ${res.status} ${res.statusText}`);
  } catch (err) {
    console.error(s.fetchError(err.message));
    process.exit(1);
  }
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
  const server = normalizeServer(cfg.server || DEFAULT_SERVER);
  console.log(s.configCurrent);
  console.log(JSON.stringify(cfg, null, 2));
  console.log(`\n${s.topicUrl} ${server}/${cfg.topic}`);
}

function cmdPath() {
  console.log(CONFIG_PATH);
}

function cmdVersion() {
  console.log(`kimi-ntfy ${PLUGIN_VERSION}`);
}

const subcommand = process.argv[2];
const args = process.argv.slice(3);

const handlers = {
  setup: cmdSetup,
  lang: cmdLang,
  server: cmdServer,
  subagents: cmdSubagents,
  session: cmdSession,
  'session-end': cmdSession,
  sessions: cmdSession,
  approval: cmdApproval,
  permissions: cmdApproval,
  turnend: cmdTurnEnd,
  'turn-end': cmdTurnEnd,
  turns: cmdTurnEnd,
  priority: cmdPriority,
  test: cmdTest,
  status: cmdStatus,
  path: cmdPath,
  version: cmdVersion,
  '-v': cmdVersion,
  '--version': cmdVersion,
};

if (!subcommand || subcommand === '--help' || subcommand === '-h' || subcommand === 'help') {
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
