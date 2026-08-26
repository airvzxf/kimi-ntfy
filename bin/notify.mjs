// SPDX-License-Identifier: AGPL-3.0-or-later
// bin/notify.mjs
// Hook handler: lee el evento del stdin, decide tipo de notificación, POST a ntfy.sh.
// Idioma y toggle de sub-agentes se leen de ~/.kimi-code/kimi-ntfy-config.json.

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { SUPPORTED_LANGS, resolvePriority, t } from './i18n.mjs';

const HOME = process.env.KIMI_CODE_HOME || join(homedir(), '.kimi-code');
const CONFIG_PATH = join(HOME, 'kimi-ntfy-config.json');
const DEFAULT_SERVER = 'https://ntfy.sh';

function normalizeServer(url) {
  return url ? url.replace(/\/+$/, '') : url;
}

// Cap superior del título que se inyecta en los cuerpos de notificación,
// en code points (no code units) para que emoji/surrogate pairs cuenten como
// un solo carácter visible.
export const TITLE_MAX = 78;
export const TITLE_KEEP = 36;
export const TITLE_SEPARATOR = ' ⟶ ';

/**
 * Recorta `title` a `TITLE_MAX` code points. Si excede el límite, devuelve
 * `primeros TITLE_KEEP ⟶ últimos TITLE_KEEP` (75 chars totales con el
 * separador actual). Si no excede, lo devuelve intacto. Entradas vacías o
 * nulas se devuelven tal cual para no duplicar la lógica de fallback en
 * `buildNotification`.
 */
export function truncateTitle(title) {
  if (!title || title.length <= 0) return title;
  const codePoints = Array.from(title);
  if (codePoints.length <= TITLE_MAX) return title;
  const head = codePoints.slice(0, TITLE_KEEP).join('');
  const tail = codePoints.slice(-TITLE_KEEP).join('');
  return `${head}${TITLE_SEPARATOR}${tail}`;
}

function findSessionDir(sessionId) {
  if (!sessionId) return null;
  const sessionsRoot = join(HOME, 'sessions');
  if (!existsSync(sessionsRoot)) return null;
  try {
    const entries = readdirSync(sessionsRoot, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const candidate = join(sessionsRoot, entry.name, sessionId);
        if (existsSync(candidate)) return candidate;
      }
    }
  } catch {}
  return null;
}

function checkMainAgentIdle(sessionDir) {
  const mainWire = join(sessionDir, 'agents', 'main', 'wire.jsonl');
  if (!existsSync(mainWire)) return true;

  try {
    const content = readFileSync(mainWire, 'utf-8');
    const lines = content.trim().split('\n').filter(Boolean);
    if (lines.length === 0) return true;

    let pendingToolCalls = 0;
    let lastFinishReason = null;

    for (let i = Math.max(0, lines.length - 40); i < lines.length; i++) {
      try {
        const entry = JSON.parse(lines[i]);
        const ev = entry.event;
        if (ev) {
          if (ev.type === 'tool.call') pendingToolCalls++;
          if (ev.type === 'tool.result') pendingToolCalls = Math.max(0, pendingToolCalls - 1);
          if (ev.type === 'step.end') {
            lastFinishReason = ev.finishReason || ev.rawFinishReason;
          }
        }
      } catch {}
    }

    if (pendingToolCalls > 0) return false;
    if (lastFinishReason === 'tool_use' || lastFinishReason === 'tool_calls') return false;
    return true;
  } catch {
    return true;
  }
}

async function verifySettledStop(sessionId, config) {
  // En ambiente de tests o si no es un sessionId con formato real, no retrasar
  if (process.env.NODE_ENV === 'test' || !sessionId || !sessionId.startsWith('session_')) {
    return true;
  }

  const sessionDir = findSessionDir(sessionId);
  if (!sessionDir) return true;

  // Verificación 1: ¿main está ocupado ahora mismo con herramientas o subagentes?
  if (!checkMainAgentIdle(sessionDir)) {
    return false;
  }

  // Loop de verificación y reposo (2 intentos de 2.5s = ~5s total de asentamiento)
  const attempts = cfgField(config, 'settleAttempts', 2);
  const intervalMs = cfgField(config, 'settleIntervalMs', 2500);

  for (let i = 0; i < attempts; i++) {
    await sleep(intervalMs);
    // Si durante la espera main lanzó otra herramienta o subagente, descartar Stop
    if (!checkMainAgentIdle(sessionDir)) {
      return false;
    }
  }

  return true;
}

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
    return null;
  }
}

// Lee un campo del config con default. Centraliza los defaults para no repetirlos.
function cfgField(config, key, fallback) {
  if (!config) return fallback;
  const value = config[key];
  return value === undefined || value === null ? fallback : value;
}

function getLastAssistantText(sessionDir) {
  if (!sessionDir) return null;
  const mainWire = join(sessionDir, 'agents', 'main', 'wire.jsonl');
  if (!existsSync(mainWire)) return null;

  try {
    const content = readFileSync(mainWire, 'utf-8');
    const lines = content.trim().split('\n').filter(Boolean);
    if (lines.length === 0) return null;

    const textParts = [];
    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        const entry = JSON.parse(lines[i]);
        const ev = entry.event;
        if (ev) {
          if (ev.type === 'content.part' && ev.part && ev.part.text) {
            textParts.unshift(ev.part.text);
          } else if (ev.type === 'step.begin' && textParts.length > 0) {
            break;
          }
        }
      } catch {}
    }

    const fullText = textParts.join('').trim();
    if (!fullText) return null;

    // Truncate to a safe size for ntfy (~3000 chars)
    if (fullText.length > 3000) {
      return `${fullText.slice(0, 3000)}...\n\n*(Truncated)*`;
    }
    return fullText;
  } catch {
    return null;
  }
}

function buildNotification(event, payload, config) {
  const lang = SUPPORTED_LANGS.includes(cfgField(config, 'language', 'en'))
    ? config.language
    : 'en';
  const s = t(lang);

  const project = payload.cwd ? payload.cwd.split('/').filter(Boolean).pop() : 'Unknown';
  const sessionId = payload.session_id || 'Unknown';
  const rawTitle = payload.session_title || 'Unknown';
  const sessionTitle = truncateTitle(rawTitle);
  const agentName = payload.agent_name || 'sub-agent';
  const resumeCmd = `kimi --session ${sessionId}`;
  const topic = cfgField(config, 'topic', '');
  const server = normalizeServer(cfgField(config, 'server', DEFAULT_SERVER));
  const topicUrl = `${server}/${encodeURIComponent(topic)}`;

  const sessionDir = findSessionDir(sessionId);
  const assistantText = getLastAssistantText(sessionDir);
  const copyLabel = s.copyCommand || 'Copy command';
  const actions =
    sessionId && sessionId !== 'Unknown' && sessionId !== 'unknown'
      ? `copy, ${copyLabel}, ${resumeCmd}`
      : undefined;

  switch (event) {
    case 'Stop':
      return {
        title: s.stopTitle(project),
        message: s.stopBody(payload.cwd || '?', sessionTitle, resumeCmd, assistantText),
        tags: s.tags.stop,
        priority: s.priority.stop,
        actions,
      };
    case 'StopFailure': {
      const errorMsg = payload.error_message || payload.error_type || '';
      return {
        title: s.stopFailureTitle(project),
        message: s.stopFailureBody(payload.cwd || '?', sessionTitle, resumeCmd, errorMsg),
        tags: s.tags.stopFailure,
        priority: s.priority.stopFailure,
        actions,
      };
    }
    case 'PermissionRequest': {
      let action = payload.action || payload.tool_name || 'Action requires approval';
      if (payload.tool_input) {
        if (typeof payload.tool_input === 'string') {
          action = payload.tool_input;
        } else if (payload.tool_input.question) {
          action = payload.tool_input.question;
        } else if (payload.tool_input.CommandLine) {
          action = `\`${payload.tool_input.CommandLine}\``;
        } else if (payload.tool_input.command) {
          action = `\`${payload.tool_input.command}\``;
        }
      }
      return {
        title: s.permissionTitle(project),
        message: s.permissionBody(payload.cwd || '?', action, sessionTitle, resumeCmd),
        tags: s.tags.permission,
        priority: s.priority.permission,
        actions,
      };
    }
    case 'SessionEnd':
      return {
        title: s.sessionEndTitle(project),
        message: s.sessionEndBody(payload.cwd || '?', sessionTitle, resumeCmd),
        tags: s.tags.sessionEnd,
        priority: s.priority.sessionEnd,
        actions,
      };
    case 'SubagentStop': {
      const subagentResponse = payload.response ? String(payload.response).trim() : '';
      return {
        title: s.subagentStopTitle(project, agentName),
        message: s.subagentStopBody(
          payload.cwd || '?',
          agentName,
          sessionTitle,
          resumeCmd,
          subagentResponse,
        ),
        tags: s.tags.subagentStop,
        priority: s.priority.subagentStop,
        actions,
      };
    }
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

  // Toggle de fin de turno: si está apagado y el evento es Stop, salir silencioso.
  const event = payload.hook_event_name;
  if (event === 'Stop' && !cfgField(config, 'notifyTurnEnd', true)) {
    process.exit(0);
  }

  // Toggle de sub-agentes: si está apagado y el evento es SubagentStop, salir silencioso.
  if (event === 'SubagentStop' && !cfgField(config, 'notifySubagent', false)) {
    process.exit(0);
  }

  // Si un subagente emite un Stop interno y notifySubagent está desactivado, silenciarlo.
  if (
    event === 'Stop' &&
    payload.agent_name &&
    payload.agent_name !== 'main' &&
    !cfgField(config, 'notifySubagent', false)
  ) {
    process.exit(0);
  }

  // Toggle de fin de sesión: si está apagado y el evento es SessionEnd, salir silencioso.
  if (event === 'SessionEnd' && !cfgField(config, 'notifySessionEnd', true)) {
    process.exit(0);
  }

  // Toggle de aprobación/permiso: si está apagado y el evento es PermissionRequest, salir silencioso.
  if (event === 'PermissionRequest' && !cfgField(config, 'notifyApproval', true)) {
    process.exit(0);
  }

  // Para eventos Stop: verificar que el agente principal no tenga herramientas activas y esté asentado
  if (event === 'Stop') {
    const isSettled = await verifySettledStop(payload.session_id, config);
    if (!isSettled) {
      process.exit(0);
    }
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

  const server = normalizeServer(config.server || DEFAULT_SERVER);
  const url = `${server}/${encodeURIComponent(config.topic)}`;
  const headers = {
    Title: note.title,
    Priority: String(note.priority),
    Tags: note.tags.join(','),
    Markdown: 'yes',
  };
  if (note.actions) {
    headers.Actions = note.actions;
  }
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

// Run `main()` only when invoked directly (e.g. `node bin/notify.mjs`),
// not when the module is imported by tests or other consumers. Without this
// guard, `import { truncateTitle } from './bin/notify.mjs'` would also fire
// the hook handler.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
