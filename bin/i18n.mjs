// SPDX-License-Identifier: AGPL-3.0-or-later
// bin/i18n.mjs
// Tabla de cadenas para el plugin kimi-ntfy.
// 'en' es el default. Cualquier idioma fuera de la tabla cae a 'en' en runtime.

export const STRINGS = {
  en: {
    // CLI output (kimi-ntfy-cli)
    configSaved: 'Config saved at',
    noConfig: 'No config yet.',
    noConfigForTest: 'No config. Run setup first.',
    topicEmpty: 'topic empty',
    topicTooLong: 'topic too long (max 64)',
    topicInvalid: 'topic invalid (letters, digits, underscore and dash only)',
    languageChanged: 'Language set to',
    languageInvalid: 'invalid language (use "en" or "es")',
    serverChanged: 'Server set to',
    serverInvalid: 'server must start with http:// or https://',
    subagentsOn: 'sub-agent notifications enabled',
    subagentsOff: 'sub-agent notifications disabled',
    sessionOn: 'session end notifications enabled',
    sessionOff: 'session end notifications disabled',
    approvalOn: 'approval notifications enabled',
    approvalOff: 'approval notifications disabled',
    turnEndOn: 'turn-end notifications enabled',
    turnEndOff: 'turn-end notifications disabled',
    questionOn: 'question notifications enabled',
    questionOff: 'question notifications disabled',
    priorityChanged: 'Priority set to',
    priorityReset: 'Priority override removed (reverted to per-event defaults)',
    priorityInvalid: 'invalid priority (use "min", "low", "default", "high", "urgent", or "reset")',
    configCurrent: 'Current config:',
    topicUrl: 'Topic URL:',
    ntfyResponded: 'ntfy responded',
    unknownSubcommand: 'unknown subcommand:',
    helpUsage: 'Usage:',
    copyCommand: 'Copy command',

    // Notification titles and bodies (handler)
    stopTitle: (project) => `[done] ${project}`,
    stopBody: (cwd, title, resume, text) =>
      `📁 ${cwd}\n` +
      `💬 ${title}\n\n` +
      `📢 ${text || 'Kimi finished its turn.'}\n\n` +
      `🔗 ${resume}`,
    stopFailureTitle: (project) => `[failed] ${project}`,
    stopFailureBody: (cwd, title, resume, errorMsg) =>
      `📁 ${cwd}\n` +
      `💬 ${title}\n\n` +
      `📢 ${errorMsg || 'Kimi stopped with an error.'}\n\n` +
      `🔗 ${resume}`,
    permissionTitle: (project) => `[approval] ${project}`,
    permissionBody: (cwd, action, title, resume) =>
      `📁 ${cwd}\n${title ? `💬 ${title}\n\n` : '\n'}❓ ${action}\n\n🔗 ${resume}`,
    sessionEndTitle: (project) => `[closed] ${project}`,
    sessionEndBody: (cwd, title, resume) =>
      `📁 ${cwd}\n💬 ${title}\n\n📢 Session closed.\n\n🔗 ${resume}`,
    subagentStopTitle: (project, agent) => `[sub-agent] ${project} ${agent}`,
    subagentStopBody: (cwd, agent, title, resume, text) =>
      `📁 ${cwd}\n💬 ${title}\n\n📢 Sub-agent \`${agent}\` finished.\n${text ? `\n📝 ${text}\n\n` : '\n'}🔗 ${resume}`,
    questionTitle: (project) => `[question] ${project}`,
    questionBody: (cwd, action, title, resume) =>
      `📁 ${cwd}\n${title ? `💬 ${title}\n\n` : '\n'}❓ ${action}\n\n🔗 ${resume}`,

    // Tags and priorities are language-agnostic, but kept here for symmetry
    tags: {
      stop: ['white_check_mark', 'robot'],
      stopFailure: ['x', 'warning'],
      permission: ['hand', 'warning'],
      sessionEnd: ['wave', 'robot'],
      subagentStop: ['link', 'robot'],
      question: ['question', 'bell'],
    },
    priority: {
      stop: 5,
      stopFailure: 4,
      permission: 5,
      sessionEnd: 2,
      subagentStop: 1,
      question: 5,
    },

    // stderr from the handler
    noConfigStderr: '[kimi-ntfy] no config: run /kimi-ntfy:setup <topic> first',
    badStdin: (msg) => `[kimi-ntfy] bad stdin: ${msg}`,
    ntfyError: (status) => `[kimi-ntfy] ntfy responded ${status}`,
    fetchError: (msg) => `[kimi-ntfy] fetch failed: ${msg}`,
  },

  es: {
    configSaved: 'Config guardada en',
    noConfig: 'No hay config todavía.',
    noConfigForTest: 'No hay config. Ejecuta setup primero.',
    topicEmpty: 'topic vacío',
    topicTooLong: 'topic demasiado largo (máx 64)',
    topicInvalid: 'topic inválido (solo letras, números, guion y guion bajo)',
    languageChanged: 'Idioma cambiado a',
    languageInvalid: 'idioma inválido (use "en" o "es")',
    serverChanged: 'Servidor cambiado a',
    serverInvalid: 'el servidor debe comenzar con http:// o https://',
    subagentsOn: 'notificaciones de sub-agentes activadas',
    subagentsOff: 'notificaciones de sub-agentes desactivadas',
    sessionOn: 'notificaciones de fin de sesión activadas',
    sessionOff: 'notificaciones de fin de sesión desactivadas',
    approvalOn: 'notificaciones de aprobación activadas',
    approvalOff: 'notificaciones de aprobación desactivadas',
    turnEndOn: 'notificaciones de fin de turno activadas',
    turnEndOff: 'notificaciones de fin de turno desactivadas',
    questionOn: 'notificaciones de preguntas activadas',
    questionOff: 'notificaciones de preguntas desactivadas',
    priorityChanged: 'Prioridad cambiada a',
    priorityReset: 'Prioridad personalizada eliminada (restablecida a valores por evento)',
    priorityInvalid: 'prioridad inválida (use "min", "low", "default", "high", "urgent" o "reset")',
    configCurrent: 'Config actual:',
    topicUrl: 'URL del topic:',
    ntfyResponded: 'ntfy respondió',
    unknownSubcommand: 'subcomando desconocido:',
    helpUsage: 'Uso:',
    copyCommand: 'Copiar comando',

    stopTitle: (project) => `[listo] ${project}`,
    stopBody: (cwd, title, resume, text) =>
      `📁 ${cwd}\n` +
      `💬 ${title}\n\n` +
      `📢 ${text || 'Kimi terminó su turno.'}\n\n` +
      `🔗 ${resume}`,
    stopFailureTitle: (project) => `[falló] ${project}`,
    stopFailureBody: (cwd, title, resume, errorMsg) =>
      `📁 ${cwd}\n` +
      `💬 ${title}\n\n` +
      `📢 ${errorMsg || 'Kimi terminó por error.'}\n\n` +
      `🔗 ${resume}`,
    permissionTitle: (project) => `[aprobación] ${project}`,
    permissionBody: (cwd, action, title, resume) =>
      `📁 ${cwd}\n${title ? `💬 ${title}\n\n` : '\n'}❓ ${action}\n\n🔗 ${resume}`,
    sessionEndTitle: (project) => `[cerrada] ${project}`,
    sessionEndBody: (cwd, title, resume) =>
      `📁 ${cwd}\n💬 ${title}\n\n📢 Sesión cerrada.\n\n🔗 ${resume}`,
    subagentStopTitle: (project, agent) => `[sub-agente] ${project} ${agent}`,
    subagentStopBody: (cwd, agent, title, resume, text) =>
      `📁 ${cwd}\n💬 ${title}\n\n📢 Sub-agente \`${agent}\` terminó.\n${text ? `\n📝 ${text}\n\n` : '\n'}🔗 ${resume}`,
    questionTitle: (project) => `[pregunta] ${project}`,
    questionBody: (cwd, action, title, resume) =>
      `📁 ${cwd}\n${title ? `💬 ${title}\n\n` : '\n'}❓ ${action}\n\n🔗 ${resume}`,

    tags: {
      stop: ['white_check_mark', 'robot'],
      stopFailure: ['x', 'warning'],
      permission: ['hand', 'warning'],
      sessionEnd: ['wave', 'robot'],
      subagentStop: ['link', 'robot'],
      question: ['question', 'bell'],
    },
    priority: {
      stop: 5,
      stopFailure: 4,
      permission: 5,
      sessionEnd: 2,
      subagentStop: 1,
      question: 5,
    },

    noConfigStderr: '[kimi-ntfy] sin config: ejecuta /kimi-ntfy:setup <topic> primero',
    badStdin: (msg) => `[kimi-ntfy] bad stdin: ${msg}`,
    ntfyError: (status) => `[kimi-ntfy] ntfy respondió ${status}`,
    fetchError: (msg) => `[kimi-ntfy] fetch falló: ${msg}`,
  },
};

export const SUPPORTED_LANGS = ['en', 'es'];

// ntfy priority levels. The friendly names match the values documented at
// https://docs.ntfy.sh/publish/#message-priority. Aliases (`silent` -> min,
// `normal` -> default, `max`/`critical` -> urgent) are accepted by the CLI
// and slash command for ergonomics.
export const PRIORITY_LEVELS = {
  min: 1,
  low: 2,
  default: 3,
  high: 4,
  urgent: 5,
  // Aliases
  silent: 1,
  normal: 3,
  max: 5,
  critical: 5,
};

export const PRIORITY_NAMES = Object.keys(PRIORITY_LEVELS);

export function resolvePriority(level) {
  if (typeof level !== 'string') return null;
  return PRIORITY_LEVELS[level.toLowerCase()] ?? null;
}

export function t(lang) {
  return STRINGS[lang] || STRINGS.en;
}
