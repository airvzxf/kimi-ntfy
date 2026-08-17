// SPDX-License-Identifier: AGPL-3.0-or-later
// bin/notify.mjs
// Hook handler: lee el evento del stdin, decide tipo de notificación, POST a ntfy.sh.
// Idioma y toggle de sub-agentes se leen de ~/.kimi-code/kimi-ntfy-config.json.

import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { SUPPORTED_LANGS, resolvePriority, t } from './i18n.mjs';

const HOME = process.env.KIMI_CODE_HOME || join(homedir(), '.kimi-code');
const CONFIG_PATH = join(HOME, 'kimi-ntfy-config.json');
const DEFAULT_SERVER = 'https://ntfy.sh';

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

async function readConfig() {
  try {
    const raw = await readFile(CONFIG_PATH, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

// Lee un campo del config con default. Centraliza los defaults para no repetirlos.
function cfgField(config, key, fallback) {
  if (!config) return fallback;
  const value = config[key];
  return value === undefined || value === null ? fallback : value;
}

function buildNotification(event, payload, config) {
  const lang = SUPPORTED_LANGS.includes(cfgField(config, 'language', 'en'))
    ? config.language
    : 'en';
  const s = t(lang);

  const project = payload.cwd ? payload.cwd.split('/').filter(Boolean).pop() : 'kimi';
  const sessionId = payload.session_id || 'unknown';
  const sessionTitle = payload.session_title || '(no title)';
  const agentName = payload.agent_name || 'sub-agent';
  const resumeCmd = `kimi --session ${sessionId}`;
  const topic = cfgField(config, 'topic', '');
  const server = cfgField(config, 'server', DEFAULT_SERVER);
  const topicUrl = `${server}/${topic}`;

  switch (event) {
    case 'Stop':
      return {
        title: s.stopTitle(project),
        message: s.stopBody(payload.cwd || '?', sessionTitle, resumeCmd),
        tags: s.tags.stop,
        priority: s.priority.stop,
        click: topicUrl,
      };
    case 'StopFailure':
      return {
        title: s.stopFailureTitle(project),
        message: s.stopFailureBody(payload.cwd || '?', sessionTitle, resumeCmd),
        tags: s.tags.stopFailure,
        priority: s.priority.stopFailure,
        click: topicUrl,
      };
    case 'SessionEnd':
      return {
        title: s.sessionEndTitle(project),
        message: s.sessionEndBody(payload.cwd || '?', sessionTitle, resumeCmd),
        tags: s.tags.sessionEnd,
        priority: s.priority.sessionEnd,
        click: topicUrl,
      };
    case 'SubagentStop':
      return {
        title: s.subagentStopTitle(project, agentName),
        message: s.subagentStopBody(payload.cwd || '?', agentName, sessionTitle, resumeCmd),
        tags: s.tags.subagentStop,
        priority: s.priority.subagentStop,
        click: topicUrl,
      };
    default:
      return null;
  }
}

async function main() {
  let payload = {};
  try {
    const raw = await readStdin();
    if (raw.trim()) payload = JSON.parse(raw);
  } catch (err) {
    const lang = 'en';
    process.stderr.write(`${t(lang).badStdin(err.message)}\n`);
    process.exit(0);
  }

  const config = await readConfig();
  const candidateLang = config?.language;
  const lang = SUPPORTED_LANGS.includes(candidateLang) ? candidateLang : 'en';
  const s = t(lang);

  if (!config || !config.topic) {
    process.stderr.write(`${s.noConfigStderr}\n`);
    process.exit(0);
  }

  // Toggle de sub-agentes: si está apagado y el evento es SubagentStop, salir silencioso.
  const event = payload.hook_event_name;
  if (event === 'SubagentStop' && !cfgField(config, 'notifySubagent', false)) {
    process.exit(0);
  }

  const note = buildNotification(event, payload, config);
  if (!note) {
    process.exit(0);
  }

  // A user-set priority overrides the per-event default. Invalid strings in
  // the config are silently ignored so a typo never breaks the handler.
  const overridePriority = resolvePriority(config.priority);
  if (overridePriority !== null) {
    note.priority = overridePriority;
  }

  const url = `${config.server || DEFAULT_SERVER}/${encodeURIComponent(config.topic)}`;
  const headers = {
    Title: note.title,
    Priority: String(note.priority),
    Tags: note.tags.join(','),
    Click: note.click,
    Markdown: 'yes',
  };
  if (config.token) {
    headers.Authorization = `Bearer ${config.token}`;
  }

  try {
    const res = await fetch(url, { method: 'POST', headers, body: note.message });
    if (!res.ok) {
      process.stderr.write(`${s.ntfyError(res.status)}\n`);
    }
  } catch (err) {
    process.stderr.write(`${s.fetchError(err.message)}\n`);
  }
  process.exit(0);
}

main();
