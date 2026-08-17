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
    subagentsOn: 'sub-agent notifications enabled',
    subagentsOff: 'sub-agent notifications disabled',
    configCurrent: 'Current config:',
    topicUrl: 'Topic URL:',
    ntfyResponded: 'ntfy responded',
    unknownSubcommand: 'unknown subcommand:',
    helpUsage: 'Usage:',

    // Notification titles and bodies (handler)
    stopTitle: (project) => `[done] ${project}`,
    stopBody: (cwd, title, resume) =>
      `Kimi finished its turn in \`${cwd}\`.\n` +
      `Session: ${title}\n` +
      `To resume: \`${resume}\``,
    stopFailureTitle: (project) => `[failed] ${project}`,
    stopFailureBody: (cwd, title, resume) =>
      `Kimi stopped with an error in \`${cwd}\`.\n` +
      `Session: ${title}\n` +
      `Check the transcript: \`${resume}\``,
    sessionEndTitle: (project) => `[closed] ${project}`,
    sessionEndBody: (cwd, title, resume) =>
      `Session closed in \`${cwd}\`.\n` + `Last title: ${title}\n` + `Reopen with: \`${resume}\``,
    subagentStopTitle: (project, agent) => `[sub-agent] ${project} ${agent}`,
    subagentStopBody: (cwd, agent, title, resume) =>
      `Sub-agent \`${agent}\` finished in \`${cwd}\`.\n` +
      `Session: ${title}\n` +
      `To resume: \`${resume}\``,

    // Tags and priorities are language-agnostic, but kept here for symmetry
    tags: {
      stop: ['white_check_mark', 'robot'],
      stopFailure: ['x', 'warning'],
      sessionEnd: ['wave', 'robot'],
      subagentStop: ['link', 'robot'],
    },
    priority: {
      stop: 3,
      stopFailure: 4,
      sessionEnd: 2,
      subagentStop: 1,
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
    subagentsOn: 'notificaciones de sub-agentes activadas',
    subagentsOff: 'notificaciones de sub-agentes desactivadas',
    configCurrent: 'Config actual:',
    topicUrl: 'URL del topic:',
    ntfyResponded: 'ntfy respondió',
    unknownSubcommand: 'subcomando desconocido:',
    helpUsage: 'Uso:',

    stopTitle: (project) => `[listo] ${project}`,
    stopBody: (cwd, title, resume) =>
      `Kimi terminó su turno en \`${cwd}\`.\n` +
      `Sesión: ${title}\n` +
      `Para retomar: \`${resume}\``,
    stopFailureTitle: (project) => `[falló] ${project}`,
    stopFailureBody: (cwd, title, resume) =>
      `Kimi terminó por error en \`${cwd}\`.\n` +
      `Sesión: ${title}\n` +
      `Revisa el transcript: \`${resume}\``,
    sessionEndTitle: (project) => `[cerrada] ${project}`,
    sessionEndBody: (cwd, title, resume) =>
      `Sesión cerrada en \`${cwd}\`.\n` +
      `Último título: ${title}\n` +
      `Reabrir con: \`${resume}\``,
    subagentStopTitle: (project, agent) => `[sub-agente] ${project} ${agent}`,
    subagentStopBody: (cwd, agent, title, resume) =>
      `Sub-agente \`${agent}\` terminó en \`${cwd}\`.\n` +
      `Sesión: ${title}\n` +
      `Para retomar: \`${resume}\``,

    tags: {
      stop: ['white_check_mark', 'robot'],
      stopFailure: ['x', 'warning'],
      sessionEnd: ['wave', 'robot'],
      subagentStop: ['link', 'robot'],
    },
    priority: {
      stop: 3,
      stopFailure: 4,
      sessionEnd: 2,
      subagentStop: 1,
    },

    noConfigStderr: '[kimi-ntfy] sin config: ejecuta /kimi-ntfy:setup <topic> primero',
    badStdin: (msg) => `[kimi-ntfy] bad stdin: ${msg}`,
    ntfyError: (status) => `[kimi-ntfy] ntfy respondió ${status}`,
    fetchError: (msg) => `[kimi-ntfy] fetch falló: ${msg}`,
  },
};

export const SUPPORTED_LANGS = ['en', 'es'];

export function t(lang) {
  return STRINGS[lang] || STRINGS.en;
}
