// SPDX-License-Identifier: AGPL-3.0-or-later
// bin/notify.mjs
// Hook handler: lee el evento del stdin, decide tipo de notificación, POST a ntfy.sh.
// Idioma y toggle de sub-agentes se leen de ~/.kimi-code/kimi-ntfy-config.json.

import {
  appendFileSync,
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  readSync,
  readdirSync,
  renameSync,
  statSync,
} from 'node:fs';
import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { SUPPORTED_LANGS, resolvePriority, t } from './i18n.mjs';

const HOME = process.env.KIMI_CODE_HOME || join(homedir(), '.kimi-code');
const CONFIG_PATH = join(HOME, 'kimi-ntfy-config.json');
const DEFAULT_SERVER = 'https://ntfy.sh';

// Persistent diagnostic log. Conforms to Kimi Code's data-locations
// convention: all logs live under $KIMI_CODE_HOME/logs/. JSONL format
// (one self-contained JSON object per line), aligned with the POSIX
// pattern <app> 1> <app>.stdout.jsonl 2> <app>.stderr.jsonl:
//   - INFO events go to stdout + (optionally) the persisted file.
//   - ERROR / FATAL events go to stderr + the persisted file.
//
// Override the file path with `KIMI_NTFY_LOG=<path>`. Disable the file
// with `=disable`. Silence everything (useful for `node --test`) with
// `=silent`. The shell-redirection pattern is left to the caller — Kimi
// Code already captures each hook's output to per-task `output.log`.
const LOG_ROTATE_BYTES = 10 * 1024 * 1024;
export const DEFAULT_LOG_PATH = join(HOME, 'logs', 'kimi-ntfy.jsonl');

// Cap of body text passed to ntfy. Stays well below the 4 KB request
// limit of most ntfy servers (ntfy.sh default). Marker `*(Truncated)*`
// renders italic in ntfy's Markdown viewer.
export const RESPONSE_MAX = 3000;

function truncateForNtfy(text) {
  const safe = typeof text === 'string' ? text : String(text ?? '');
  if (safe.length <= RESPONSE_MAX) return safe;
  return `${safe.slice(0, RESPONSE_MAX)}...\n\n*(Truncated)*`;
}

function normalizeServer(url) {
  return url ? url.replace(/\/+$/, '') : url;
}

function resolveLogPath() {
  const v = process.env.KIMI_NTFY_LOG;
  if (v === undefined || v === '') return { enabled: true, path: DEFAULT_LOG_PATH, silent: false };
  if (v === 'silent') return { enabled: false, path: null, silent: true };
  if (v === 'disable') return { enabled: false, path: null, silent: false };
  return { enabled: true, path: v, silent: false };
}

/**
 * Append one JSON line to the diagnostic log. Emits to either
 * `process.stdout` (level='info') or `process.stderr`
 * (level='error'/'fatal') and additionally to a persisted aggregate file
 * at `DEFAULT_LOG_PATH` (or `KIMI_NTFY_LOG`).
 *
 * Format: one JSON object per line, terminated by `\n`. Fields given
 * via `fields` are spread into the top-level JSON object, so callers
 * cannot accidentally collide with reserved keys (`ts`, `level`,
 * `event`) at the JSON layer. Caller's `event` key (e.g. `hook_event`)
 * is fine.
 *
 * Fail-open: any error from disk or stream I/O is swallowed (a single
 * one-shot warning is emitted on a *separate* marker line, not via the
 * log path, to avoid recursion).
 *
 * @param {'info'|'error'|'fatal'} level
 * @param {string} event   short log-event name (e.g. 'invoke', 'filter')
 * @param {Record<string, *>=} fields   additional structured fields
 */
export function logEvent(level, event, fields = {}) {
  // 1. Build the line.
  let line;
  try {
    line = `${JSON.stringify({ ts: new Date().toISOString(), level, event, ...fields })}\n`;
  } catch (err) {
    process.stderr.write(`[kimi-ntfy log] serialise failed: ${err.message}\n`);
    return;
  }

  // 2. Honour KIMI_NTFY_LOG=silent (suppress everything).
  const cfg = resolveLogPath();
  if (cfg.silent) return;

  // 3. Stream emission. INFO → stdout, ERROR/FATAL → stderr.
  const stream = level === 'info' ? process.stdout : process.stderr;
  try {
    stream.write(line);
  } catch {
    // Stream errors are non-actionable here — node closes on exit.
  }

  // 4. Persisted file.
  if (!cfg.enabled || !cfg.path) return;
  try {
    mkdirSync(dirname(cfg.path), { recursive: true });
    rotateLogIfNeeded(cfg.path);
    appendFileSync(cfg.path, line, { mode: 0o600 });
  } catch (err) {
    if (!logEvent._warned) {
      process.stderr.write(`[kimi-ntfy log] persistent write failed: ${err.message}\n`);
      logEvent._warned = true;
    }
  }
}

function rotateLogIfNeeded(path) {
  let st;
  try {
    st = statSync(path);
  } catch {
    return; // first write will create it
  }
  if (st.size < LOG_ROTATE_BYTES) return;
  const hist = `${path}.1`;
  try {
    renameSync(hist, `${hist}.old`);
  } catch {}
  try {
    renameSync(path, hist);
  } catch {}
}

/**
 * Read only the last `maxBytes` of a text file. Avoids loading multi-MB
 * wire.jsonl just to look at the most recent 40 events.
 */
function readTail(path, maxBytes = 8192) {
  const st = statSync(path);
  const start = Math.max(0, st.size - maxBytes);
  const len = st.size - start;
  const fd = openSync(path, 'r');
  try {
    const buf = Buffer.alloc(len);
    readSync(fd, buf, 0, len, start);
    return buf.toString('utf8');
  } finally {
    try {
      closeSync(fd);
    } catch {}
  }
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
  if (!existsSync(mainWire)) return { settled: true, pendingToolCalls: 0, lastFinishReason: null };

  try {
    const content = readTail(mainWire, 16384); // ~enough for many recent events
    const lines = content.trim().split('\n').filter(Boolean);
    if (lines.length === 0) return { settled: true, pendingToolCalls: 0, lastFinishReason: null };

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

    const settled =
      pendingToolCalls === 0 &&
      lastFinishReason !== 'tool_use' &&
      lastFinishReason !== 'tool_calls';
    return { settled, pendingToolCalls, lastFinishReason };
  } catch {
    return { settled: true, pendingToolCalls: 0, lastFinishReason: null };
  }
}

export async function verifySettledStop(sessionDir, config) {
  // En ambiente de tests o si no es un sessionId con formato real, no retrasar
  if (process.env.NODE_ENV === 'test' || !sessionDir) {
    return { settled: true, pendingToolCalls: 0, lastFinishReason: null, attempts: 0 };
  }

  // Verificación 1: ¿main está ocupado ahora mismo con herramientas o subagentes?
  const idle = checkMainAgentIdle(sessionDir);
  if (!idle.settled) {
    return {
      settled: false,
      pendingToolCalls: idle.pendingToolCalls,
      lastFinishReason: idle.lastFinishReason,
      attempts: 0,
    };
  }

  // Loop de verificación y reposo (2 intentos de 2.5s = ~5s total de asentamiento)
  const attempts = cfgField(config, 'settleAttempts', 2);
  const intervalMs = cfgField(config, 'settleIntervalMs', 2500);

  for (let i = 0; i < attempts; i++) {
    await sleep(intervalMs);
    const after = checkMainAgentIdle(sessionDir);
    if (!after.settled) {
      return {
        settled: false,
        pendingToolCalls: after.pendingToolCalls,
        lastFinishReason: after.lastFinishReason,
        attempts: i + 1,
      };
    }
  }

  return { settled: true, pendingToolCalls: 0, lastFinishReason: idle.lastFinishReason, attempts };
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
    logEvent('error', 'config', {
      hook_event: 'main',
      status: 'invalid_parse',
      error_message: err.message,
      line: err.line ?? null,
      column: err.column ?? null,
    });
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
    const content = readTail(mainWire, 32768); // assistant text can be longer
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
    return truncateForNtfy(fullText);
  } catch {
    return null;
  }
}

function buildNotification(event, payload, config, sessionDir) {
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
          truncateForNtfy(subagentResponse),
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
    logEvent('info', 'exit', { code: 0, path: 'bad_stdin', error: err.message });
    process.exit(0);
  }

  const event = payload.hook_event_name;
  logEvent('info', 'invoke', {
    event,
    sid: payload.session_id,
    agent: payload.agent_name,
  });

  const config = await readConfig();
  const candidateLang = config?.language;
  const lang = SUPPORTED_LANGS.includes(candidateLang) ? candidateLang : 'en';
  const s = t(lang);

  if (!config || !config.topic) {
    logEvent('info', 'config', { status: !config ? 'missing' : 'no_topic' });
    logEvent('info', 'exit', { code: 0, path: 'no_config' });
    process.stderr.write(`${s.noConfigStderr}\n`);
    process.exit(0);
  }

  logEvent('info', 'config', { status: 'loaded', topic: config.topic });

  // Toggle de fin de turno: si está apagado y el evento es Stop, salir silencioso.
  if (event === 'Stop' && !cfgField(config, 'notifyTurnEnd', true)) {
    logEvent('info', 'filter', { reason: 'notifyTurnEnd', event });
    logEvent('info', 'exit', { code: 0, path: 'filter_silenced' });
    process.exit(0);
  }

  // Toggle de sub-agentes: si está apagado y el evento es SubagentStop, salir silencioso.
  if (event === 'SubagentStop' && !cfgField(config, 'notifySubagent', false)) {
    logEvent('info', 'filter', { reason: 'notifySubagent', event });
    logEvent('info', 'exit', { code: 0, path: 'filter_silenced' });
    process.exit(0);
  }

  // Si un subagente emite un Stop interno y notifySubagent está desactivado, silenciarlo.
  if (
    event === 'Stop' &&
    payload.agent_name &&
    payload.agent_name !== 'main' &&
    !cfgField(config, 'notifySubagent', false)
  ) {
    logEvent('info', 'filter', { reason: 'notifySubagent', event, agent: payload.agent_name });
    logEvent('info', 'exit', { code: 0, path: 'filter_silenced' });
    process.exit(0);
  }

  // Toggle de fin de sesión: si está apagado y el evento es SessionEnd, salir silencioso.
  if (event === 'SessionEnd' && !cfgField(config, 'notifySessionEnd', true)) {
    logEvent('info', 'filter', { reason: 'notifySessionEnd', event });
    logEvent('info', 'exit', { code: 0, path: 'filter_silenced' });
    process.exit(0);
  }

  // Toggle de aprobación/permiso: si está apagado y el evento es PermissionRequest, salir silencioso.
  if (event === 'PermissionRequest' && !cfgField(config, 'notifyApproval', true)) {
    logEvent('info', 'filter', { reason: 'notifyApproval', event });
    logEvent('info', 'exit', { code: 0, path: 'filter_silenced' });
    process.exit(0);
  }

  // Para eventos Stop: verificar que el agente principal no tenga herramientas activas y esté asentado
  if (event === 'Stop') {
    const verdict = await verifySettledStop(payload.session_id, config);
    logEvent('info', 'settle', {
      sid: payload.session_id,
      result: verdict.settled ? 'true' : 'false',
      pending_tool_calls: verdict.pendingToolCalls,
      last_finish_reason: verdict.lastFinishReason ?? 'null',
      attempts: verdict.attempts,
    });
    if (!verdict.settled) {
      logEvent('info', 'exit', { code: 0, path: 'settle_silenced' });
      process.exit(0);
    }
  }

  const note = buildNotification(event, payload, config);
  if (!note) {
    logEvent('info', 'exit', { code: 0, path: 'unknown_event', event });
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
    if (res.ok) {
      logEvent('info', 'notify', { event, status: res.status });
    } else {
      logEvent('error', 'notify', { event, status: res.status });
      process.stderr.write(`${s.ntfyError(res.status)}\n`);
    }
  } catch (err) {
    logEvent('error', 'notify', { event, error: err.message });
    process.stderr.write(`${s.fetchError(err.message)}\n`);
  }
  logEvent('info', 'exit', { code: 0, path: 'ok' });
  process.exit(0);
}

// Run `main()` only when invoked directly (e.g. `node bin/notify.mjs`),
// not when the module is imported by tests or other consumers. Without this
// guard, `import { truncateTitle } from './bin/notify.mjs'` would also fire
// the hook handler.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();

  async function main() {
    let payload = {};
    try {
      const raw = await readStdin();
      if (raw.trim()) payload = JSON.parse(raw);
    } catch (err) {
      const lang = 'en';
      process.stderr.write(`${t(lang).badStdin(err.message)}\n`);
      logEvent('info', 'exit', { code: 0, path: 'bad_stdin', error_message: err.message });
      process.exit(0);
    }

    const event = payload.hook_event_name;
    // Cache the session directory once per invocation. verifySettledStop and
    // buildNotification both consult it; findSessionDir does a readdirSync
    // + an existsSync per entry, so doing it twice is wasted I/O.
    const sessionDir = payload.session_id?.startsWith('session_')
      ? findSessionDir(payload.session_id)
      : null;

    logEvent('info', 'invoke', {
      hook_event: event,
      sid: payload.session_id ?? null,
      agent: payload.agent_name ?? null,
      cwd: payload.cwd ?? null,
    });

    const config = await readConfig();
    const candidateLang = config?.language;
    const lang = SUPPORTED_LANGS.includes(candidateLang) ? candidateLang : 'en';
    const s = t(lang);

    if (!config || !config.topic) {
      logEvent('info', 'config', { status: !config ? 'missing' : 'no_topic' });
      logEvent('info', 'exit', { code: 0, path: 'no_config' });
      process.stderr.write(`${s.noConfigStderr}\n`);
      process.exit(0);
    }

    logEvent('info', 'config', { status: 'loaded', topic: config.topic });

    // Toggle de fin de turno: si está apagado y el evento es Stop, salir silencioso.
    if (event === 'Stop' && !cfgField(config, 'notifyTurnEnd', true)) {
      logEvent('info', 'filter', { reason: 'notifyTurnEnd', hook_event: event });
      logEvent('info', 'exit', { code: 0, path: 'filter_silenced' });
      process.exit(0);
    }

    // Toggle de sub-agentes: si está apagado y el evento es SubagentStop, salir silencioso.
    if (event === 'SubagentStop' && !cfgField(config, 'notifySubagent', false)) {
      logEvent('info', 'filter', { reason: 'notifySubagent', hook_event: event });
      logEvent('info', 'exit', { code: 0, path: 'filter_silenced' });
      process.exit(0);
    }

    // Si un subagente emite un Stop interno y notifySubagent está desactivado, silenciarlo.
    if (
      event === 'Stop' &&
      payload.agent_name &&
      payload.agent_name !== 'main' &&
      !cfgField(config, 'notifySubagent', false)
    ) {
      logEvent('info', 'filter', {
        reason: 'notifySubagent',
        hook_event: event,
        agent: payload.agent_name,
      });
      logEvent('info', 'exit', { code: 0, path: 'filter_silenced' });
      process.exit(0);
    }

    // Toggle de fin de sesión: si está apagado y el evento es SessionEnd, salir silencioso.
    if (event === 'SessionEnd' && !cfgField(config, 'notifySessionEnd', true)) {
      logEvent('info', 'filter', { reason: 'notifySessionEnd', hook_event: event });
      logEvent('info', 'exit', { code: 0, path: 'filter_silenced' });
      process.exit(0);
    }

    // Toggle de aprobación/permiso: si está apagado y el evento es PermissionRequest, salir silencioso.
    if (event === 'PermissionRequest' && !cfgField(config, 'notifyApproval', true)) {
      logEvent('info', 'filter', { reason: 'notifyApproval', hook_event: event });
      logEvent('info', 'exit', { code: 0, path: 'filter_silenced' });
      process.exit(0);
    }

    // Para eventos Stop: verificar que el agente principal no tenga herramientas activas y esté asentado
    if (event === 'Stop') {
      const verdict = await verifySettledStop(sessionDir, config);
      logEvent('info', 'settle', {
        sid: payload.session_id ?? null,
        result: verdict.settled,
        pending_tool_calls: verdict.pendingToolCalls,
        last_finish_reason: verdict.lastFinishReason,
        attempts: verdict.attempts,
      });
      if (!verdict.settled) {
        logEvent('info', 'exit', { code: 0, path: 'settle_silenced' });
        process.exit(0);
      }
    }

    const note = buildNotification(event, payload, config, sessionDir);
    if (!note) {
      logEvent('info', 'exit', { code: 0, path: 'unknown_event', hook_event: event });
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
      if (res.ok) {
        logEvent('info', 'notify', { hook_event: event, status: res.status });
      } else {
        logEvent('error', 'notify', { hook_event: event, status: res.status });
        process.stderr.write(`${s.ntfyError(res.status)}\n`);
      }
    } catch (err) {
      logEvent('error', 'notify', { hook_event: event, error_message: err.message });
      process.stderr.write(`${s.fetchError(err.message)}\n`);
    }
    logEvent('info', 'exit', { code: 0, path: 'ok' });
    process.exit(0);
  }
}
