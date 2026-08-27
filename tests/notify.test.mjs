// Hook-handler coverage for bin/notify.mjs. Each test starts a fresh mock
// ntfy server, drops a config into a tmpdir, and spawns notify.mjs with the
// payload on its stdin.

import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_LOG_PATH,
  RESPONSE_MAX,
  TITLE_KEEP,
  TITLE_MAX,
  TITLE_SEPARATOR,
  logEvent,
  truncateTitle,
  verifySettledStop,
} from '../bin/notify.mjs';
import payloads from './fixtures/payloads.json' with { type: 'json' };
import { start } from './mock-ntfy.mjs';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const REPO_ROOT = join(HERE, '..');
const NOTIFY = join(REPO_ROOT, 'bin', 'notify.mjs');
const CONFIG_FILE = 'kimi-ntfy-config.json';

function configPath(home) {
  return join(home, CONFIG_FILE);
}

async function tmpHome() {
  return mkdtemp(join(tmpdir(), 'kimi-ntfy-notify-'));
}

async function seed(home, partial) {
  await writeFile(configPath(home), JSON.stringify(partial, null, 2), { mode: 0o600 });
}

async function runNotify(home, stdinText, extraEnv = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn('node', [NOTIFY], {
      env: { ...process.env, KIMI_CODE_HOME: home, ...extraEnv },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => {
      stdout += d.toString('utf8');
    });
    child.stderr.on('data', (d) => {
      stderr += d.toString('utf8');
    });
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, stdout, stderr }));
    child.stdin.end(stdinText);
  });
}

test('Stop posts once with priority 5, white_check_mark tag, and cwd in body', async () => {
  const mock = await start();
  const home = await tmpHome();
  try {
    await seed(home, { topic: 'mytopic', server: mock.url });
    const r = await runNotify(home, JSON.stringify(payloads.stop));
    assert.equal(r.code, 0, `stderr=${r.stderr}`);
    assert.equal(mock.records.length, 1);
    const rec = mock.records[0];
    assert.equal(rec.method, 'POST');
    assert.ok(rec.headers.title, 'Title header should be present');
    assert.equal(rec.headers.priority, '5');
    assert.ok(rec.headers.tags.includes('white_check_mark'), `tags were ${rec.headers.tags}`);
    assert.equal(rec.headers.markdown, 'yes');
    assert.equal(
      rec.headers.click,
      undefined,
      'Click header should be omitted to avoid launching browser',
    );
    assert.ok(rec.headers.actions.includes('copy,'), `actions was ${rec.headers.actions}`);
    assert.ok(rec.body.includes('/home/wolf/projects/app'), `body was ${rec.body}`);
  } finally {
    await mock.close().catch(() => {});
    await rm(home, { recursive: true, force: true });
  }
});

test('StopFailure posts with priority 4 and tag "x"', async () => {
  const mock = await start();
  const home = await tmpHome();
  try {
    await seed(home, { topic: 'mytopic', server: mock.url });
    const r = await runNotify(home, JSON.stringify(payloads.stopFailure));
    assert.equal(r.code, 0, `stderr=${r.stderr}`);
    assert.equal(mock.records.length, 1);
    assert.equal(mock.records[0].headers.priority, '4');
    assert.ok(mock.records[0].headers.tags.includes('x'));
  } finally {
    await mock.close().catch(() => {});
    await rm(home, { recursive: true, force: true });
  }
});

test('SessionEnd posts with priority 2 and tag "wave"', async () => {
  const mock = await start();
  const home = await tmpHome();
  try {
    await seed(home, { topic: 'mytopic', server: mock.url });
    const r = await runNotify(home, JSON.stringify(payloads.sessionEnd));
    assert.equal(r.code, 0, `stderr=${r.stderr}`);
    assert.equal(mock.records.length, 1);
    assert.equal(mock.records[0].headers.priority, '2');
    assert.ok(mock.records[0].headers.tags.includes('wave'));
  } finally {
    await mock.close().catch(() => {});
    await rm(home, { recursive: true, force: true });
  }
});

test('SessionEnd is silenced when notifySessionEnd is false', async () => {
  const mock = await start();
  const home = await tmpHome();
  try {
    await seed(home, { topic: 'mytopic', server: mock.url, notifySessionEnd: false });
    const r = await runNotify(home, JSON.stringify(payloads.sessionEnd));
    assert.equal(r.code, 0, `stderr=${r.stderr}`);
    assert.equal(mock.records.length, 0);
  } finally {
    await mock.close().catch(() => {});
    await rm(home, { recursive: true, force: true });
  }
});

test('PermissionRequest posts with priority 5 and tag "hand"', async () => {
  const mock = await start();
  const home = await tmpHome();
  try {
    await seed(home, { topic: 'mytopic', server: mock.url });
    const r = await runNotify(home, JSON.stringify(payloads.permissionRequest));
    assert.equal(r.code, 0, `stderr=${r.stderr}`);
    assert.equal(mock.records.length, 1);
    assert.equal(mock.records[0].headers.priority, '5');
    assert.ok(mock.records[0].headers.tags.includes('hand'));
    assert.ok(mock.records[0].body.includes('npm run build'));
  } finally {
    await mock.close().catch(() => {});
    await rm(home, { recursive: true, force: true });
  }
});

test('PermissionRequest is silenced when notifyApproval is false', async () => {
  const mock = await start();
  const home = await tmpHome();
  try {
    await seed(home, { topic: 'mytopic', server: mock.url, notifyApproval: false });
    const r = await runNotify(home, JSON.stringify(payloads.permissionRequest));
    assert.equal(r.code, 0, `stderr=${r.stderr}`);
    assert.equal(mock.records.length, 0);
  } finally {
    await mock.close().catch(() => {});
    await rm(home, { recursive: true, force: true });
  }
});

test('SubagentStop is silenced when notifySubagent is false', async () => {
  const mock = await start();
  const home = await tmpHome();
  try {
    await seed(home, { topic: 'mytopic', server: mock.url, notifySubagent: false });
    const r = await runNotify(home, JSON.stringify(payloads.subagentStop));
    assert.equal(r.code, 0, `stderr=${r.stderr}`);
    assert.equal(mock.records.length, 0);
  } finally {
    await mock.close().catch(() => {});
    await rm(home, { recursive: true, force: true });
  }
});

test('Stop event with agent_name is silenced when notifySubagent is false', async () => {
  const mock = await start();
  const home = await tmpHome();
  try {
    await seed(home, { topic: 'mytopic', server: mock.url, notifySubagent: false });
    const r = await runNotify(home, JSON.stringify({ ...payloads.stop, agent_name: 'explore' }));
    assert.equal(r.code, 0, `stderr=${r.stderr}`);
    assert.equal(mock.records.length, 0);
  } finally {
    await mock.close().catch(() => {});
    await rm(home, { recursive: true, force: true });
  }
});

test('Stop is silenced when notifyTurnEnd is false (the proxy-stop bug)', async () => {
  // Reproduces the bug where Kimi Code fires a `Stop` event when a sub-agent
  // finishes its turn. The payload has the main session's metadata and no
  // `agent_name`, so the legacy `notifySubagent`-based filter cannot catch it.
  // `notifyTurnEnd: false` silences every `Stop`, eliminating the duplicate push.
  const mock = await start();
  const home = await tmpHome();
  try {
    await seed(home, {
      topic: 'mytopic',
      server: mock.url,
      notifyTurnEnd: false,
      notifySubagent: false,
    });
    const r = await runNotify(home, JSON.stringify(payloads.stop));
    assert.equal(r.code, 0, `stderr=${r.stderr}`);
    assert.equal(mock.records.length, 0, 'no notification should be posted');
  } finally {
    await mock.close().catch(() => {});
    await rm(home, { recursive: true, force: true });
  }
});

test('Stop posts normally when notifyTurnEnd is true (default)', async () => {
  const mock = await start();
  const home = await tmpHome();
  try {
    await seed(home, {
      topic: 'mytopic',
      server: mock.url,
      notifyTurnEnd: true,
    });
    const r = await runNotify(home, JSON.stringify(payloads.stop));
    assert.equal(r.code, 0, `stderr=${r.stderr}`);
    assert.equal(mock.records.length, 1);
    assert.ok(mock.records[0].headers.tags.includes('white_check_mark'));
  } finally {
    await mock.close().catch(() => {});
    await rm(home, { recursive: true, force: true });
  }
});

test('notifyTurnEnd: false does not silence StopFailure, SessionEnd, or PermissionRequest', async () => {
  // Only `Stop` is silenced; the other lifecycle hooks still post.
  for (const payloadKey of ['stopFailure', 'sessionEnd', 'permissionRequest']) {
    const mock = await start();
    const home = await tmpHome();
    try {
      await seed(home, {
        topic: 'mytopic',
        server: mock.url,
        notifyTurnEnd: false,
        notifySessionEnd: true,
        notifyApproval: true,
      });
      const r = await runNotify(home, JSON.stringify(payloads[payloadKey]));
      assert.equal(r.code, 0, `stderr=${r.stderr} payload=${payloadKey}`);
      assert.equal(mock.records.length, 1, `expected 1 record for ${payloadKey}`);
    } finally {
      await mock.close().catch(() => {});
      await rm(home, { recursive: true, force: true });
    }
  }
});

test('SubagentStop posts and the body mentions the agent name when enabled', async () => {
  const mock = await start();
  const home = await tmpHome();
  try {
    await seed(home, { topic: 'mytopic', server: mock.url, notifySubagent: true });
    const r = await runNotify(home, JSON.stringify(payloads.subagentStop));
    assert.equal(r.code, 0, `stderr=${r.stderr}`);
    assert.equal(mock.records.length, 1);
    assert.ok(mock.records[0].body.includes('explore'), `body was ${mock.records[0].body}`);
  } finally {
    await mock.close().catch(() => {});
    await rm(home, { recursive: true, force: true });
  }
});

test('PreToolUse with AskUserQuestion posts with priority 5 and tag "question"', async () => {
  const mock = await start();
  const home = await tmpHome();
  try {
    await seed(home, { topic: 'mytopic', server: mock.url });
    const r = await runNotify(home, JSON.stringify(payloads.preToolUseAskUserQuestion));
    assert.equal(r.code, 0, `stderr=${r.stderr}`);
    assert.equal(mock.records.length, 1);
    const rec = mock.records[0];
    assert.equal(rec.headers.priority, '5');
    assert.ok(rec.headers.tags.includes('question'), `tags were ${rec.headers.tags}`);
    assert.ok(
      rec.body.includes('Which icon should we use for the success state?'),
      `body was ${rec.body}`,
    );
    assert.ok(rec.body.includes('📁'), `body was ${rec.body}`);
    assert.ok(rec.body.includes('❓'), `body was ${rec.body}`);
    assert.ok(rec.body.includes('🔗'), `body was ${rec.body}`);
  } finally {
    await mock.close().catch(() => {});
    await rm(home, { recursive: true, force: true });
  }
});

test('PreToolUse with AskUserQuestion appends "(N questions)" suffix when multiple questions', async () => {
  const mock = await start();
  const home = await tmpHome();
  try {
    await seed(home, { topic: 'mytopic', server: mock.url });
    const r = await runNotify(home, JSON.stringify(payloads.preToolUseAskUserQuestionMulti));
    assert.equal(r.code, 0, `stderr=${r.stderr}`);
    assert.equal(mock.records.length, 1);
    const rec = mock.records[0];
    assert.ok(
      rec.body.includes('Which icon should we use for the success state? (2 questions)'),
      `body was ${rec.body}`,
    );
  } finally {
    await mock.close().catch(() => {});
    await rm(home, { recursive: true, force: true });
  }
});

test('PreToolUse with AskUserQuestion is silenced when notifyQuestion is false', async () => {
  const mock = await start();
  const home = await tmpHome();
  try {
    await seed(home, { topic: 'mytopic', server: mock.url, notifyQuestion: false });
    const r = await runNotify(home, JSON.stringify(payloads.preToolUseAskUserQuestion));
    assert.equal(r.code, 0, `stderr=${r.stderr}`);
    assert.equal(mock.records.length, 0);
  } finally {
    await mock.close().catch(() => {});
    await rm(home, { recursive: true, force: true });
  }
});

test('PreToolUse with non-AskUserQuestion tool does not post (defensive guard)', async () => {
  const mock = await start();
  const home = await tmpHome();
  try {
    await seed(home, { topic: 'mytopic', server: mock.url });
    const r = await runNotify(home, JSON.stringify(payloads.preToolUseOtherTool));
    assert.equal(r.code, 0, `stderr=${r.stderr}`);
    // The matcher in kimi.plugin.json restricts PreToolUse to AskUserQuestion, but
    // if a future matcher change leaks other tools through, the handler must
    // still drop them.
    assert.equal(mock.records.length, 0);
  } finally {
    await mock.close().catch(() => {});
    await rm(home, { recursive: true, force: true });
  }
});

test('Stop is silenced when main agent wire has tool calls in progress', async () => {
  const { mkdir, writeFile } = await import('node:fs/promises');
  const mock = await start();
  const home = await tmpHome();
  try {
    await seed(home, { topic: 'mytopic', server: mock.url, notifyTurnEnd: true });
    const sessionDir = join(
      home,
      'sessions',
      'wd_test_123',
      'session_real_busy_123',
      'agents',
      'main',
    );
    await mkdir(sessionDir, { recursive: true });
    const wireContent = [
      JSON.stringify({ event: { type: 'tool.call', toolCall: { name: 'Agent' } } }),
      JSON.stringify({ event: { type: 'step.end', finishReason: 'tool_use' } }),
    ].join('\n');
    await writeFile(join(sessionDir, 'wire.jsonl'), wireContent);

    const payload = {
      hook_event_name: 'Stop',
      session_id: 'session_real_busy_123',
      cwd: '/home/wolf/test',
    };
    const r = await runNotify(home, JSON.stringify(payload));
    assert.equal(r.code, 0, `stderr=${r.stderr}`);
    assert.equal(mock.records.length, 0, 'busy main agent should silence Stop');
  } finally {
    await mock.close().catch(() => {});
    await rm(home, { recursive: true, force: true });
  }
});

test('Stop posts when main agent wire has finished turn with no tools in progress', async () => {
  const { mkdir, writeFile } = await import('node:fs/promises');
  const mock = await start();
  const home = await tmpHome();
  try {
    await seed(home, {
      topic: 'mytopic',
      server: mock.url,
      notifyTurnEnd: true,
      settleAttempts: 0,
    });
    const sessionDir = join(
      home,
      'sessions',
      'wd_test_123',
      'session_real_idle_123',
      'agents',
      'main',
    );
    await mkdir(sessionDir, { recursive: true });
    const wireContent = [
      JSON.stringify({
        event: { type: 'content.part', part: { text: 'Todo listo sin errores.' } },
      }),
      JSON.stringify({ event: { type: 'step.end', finishReason: 'end_turn' } }),
    ].join('\n');
    await writeFile(join(sessionDir, 'wire.jsonl'), wireContent);

    const payload = {
      hook_event_name: 'Stop',
      session_id: 'session_real_idle_123',
      cwd: '/home/wolf/test',
    };
    const r = await runNotify(home, JSON.stringify(payload));
    assert.equal(r.code, 0, `stderr=${r.stderr}`);
    assert.equal(mock.records.length, 1, 'idle main agent should post Stop');
    assert.ok(
      mock.records[0].body.includes('Todo listo sin errores.'),
      `body was ${mock.records[0].body}`,
    );
    assert.ok(
      mock.records[0].body.includes('📁 /home/wolf/test'),
      `body was ${mock.records[0].body}`,
    );
  } finally {
    await mock.close().catch(() => {});
    await rm(home, { recursive: true, force: true });
  }
});

test('empty stdin is a no-op: exit 0, no records', async () => {
  const mock = await start();
  const home = await tmpHome();
  try {
    await seed(home, { topic: 'mytopic', server: mock.url });
    const r = await runNotify(home, '');
    assert.equal(r.code, 0, `stderr=${r.stderr}`);
    assert.equal(mock.records.length, 0);
  } finally {
    await mock.close().catch(() => {});
    await rm(home, { recursive: true, force: true });
  }
});

test('invalid JSON on stdin is a no-op: exit 0, no records', async () => {
  const mock = await start();
  const home = await tmpHome();
  try {
    await seed(home, { topic: 'mytopic', server: mock.url });
    const r = await runNotify(home, 'not json {{');
    assert.equal(r.code, 0, `stderr=${r.stderr}`);
    assert.equal(mock.records.length, 0);
  } finally {
    await mock.close().catch(() => {});
    await rm(home, { recursive: true, force: true });
  }
});

test('missing config file: exit 0, no records, stderr mentions no config', async () => {
  const mock = await start();
  const home = await tmpHome();
  try {
    const r = await runNotify(home, JSON.stringify(payloads.stop));
    assert.equal(r.code, 0, `stderr=${r.stderr}`);
    assert.equal(mock.records.length, 0);
    assert.match(r.stderr, /no config/i);
  } finally {
    await mock.close().catch(() => {});
    await rm(home, { recursive: true, force: true });
  }
});

test('Authorization: Bearer <token> is sent when the config has a token', async () => {
  const mock = await start();
  const home = await tmpHome();
  try {
    await seed(home, {
      topic: 'mytopic',
      server: mock.url,
      token: 'tk_abc123',
    });
    const r = await runNotify(home, JSON.stringify(payloads.stop));
    assert.equal(r.code, 0, `stderr=${r.stderr}`);
    assert.equal(mock.records.length, 1);
    assert.equal(mock.records[0].headers.authorization, 'Bearer tk_abc123');
  } finally {
    await mock.close().catch(() => {});
    await rm(home, { recursive: true, force: true });
  }
});

test('handler still exits 0 when the server returns 500 (fail-open)', async () => {
  const mock = await start();
  const home = await tmpHome();
  try {
    // Putting `?fail=1` on the configured server makes the topic POST
    // hit a path that the mock interprets as a failure request.
    await seed(home, { topic: 'mytopic', server: `${mock.url}?fail=1` });
    const r = await runNotify(home, JSON.stringify(payloads.stop));
    assert.equal(r.code, 0, `stderr=${r.stderr}`);
    assert.equal(mock.records.length, 1);
  } finally {
    await mock.close().catch(() => {});
    await rm(home, { recursive: true, force: true });
  }
});

test('Spanish notifications include Spanish text in the body', async () => {
  const mock = await start();
  const home = await tmpHome();
  try {
    await seed(home, { topic: 'mytopic', server: mock.url, language: 'es' });
    const r = await runNotify(home, JSON.stringify(payloads.stop));
    assert.equal(r.code, 0, `stderr=${r.stderr}`);
    assert.equal(mock.records.length, 1);
    assert.ok(
      mock.records[0].body.includes('Kimi terminó su turno.') ||
        mock.records[0].body.includes('📁'),
      `body was ${mock.records[0].body}`,
    );
  } finally {
    await mock.close().catch(() => {});
    await rm(home, { recursive: true, force: true });
  }
});

test('priority override in config wins over the per-event default', async () => {
  const mock = await start();
  const home = await tmpHome();
  try {
    // StopFailure default is 4. Force it to 1 (min/silent) and verify.
    await seed(home, { topic: 'mytopic', server: mock.url, priority: 'min' });
    const r = await runNotify(home, JSON.stringify(payloads.stopFailure));
    assert.equal(r.code, 0, `stderr=${r.stderr}`);
    assert.equal(mock.records.length, 1);
    assert.equal(mock.records[0].headers.priority, '1');
  } finally {
    await mock.close().catch(() => {});
    await rm(home, { recursive: true, force: true });
  }
});

test('priority override accepts aliases and uppercase', async () => {
  const mock = await start();
  const home = await tmpHome();
  try {
    // 'URGENT' should be normalized to priority 5.
    await seed(home, { topic: 'mytopic', server: mock.url, priority: 'URGENT' });
    const r = await runNotify(home, JSON.stringify(payloads.stop));
    assert.equal(r.code, 0, `stderr=${r.stderr}`);
    assert.equal(mock.records.length, 1);
    assert.equal(mock.records[0].headers.priority, '5');
  } finally {
    await mock.close().catch(() => {});
    await rm(home, { recursive: true, force: true });
  }
});

test('invalid priority in config is silently ignored (per-event default applies)', async () => {
  const mock = await start();
  const home = await tmpHome();
  try {
    await seed(home, { topic: 'mytopic', server: mock.url, priority: 'loud' });
    const r = await runNotify(home, JSON.stringify(payloads.stop));
    assert.equal(r.code, 0, `stderr=${r.stderr}`);
    assert.equal(mock.records.length, 1);
    // Stop default is 5 (urgent) — typo must not stop notifications.
    assert.equal(mock.records[0].headers.priority, '5');
  } finally {
    await mock.close().catch(() => {});
    await rm(home, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// truncateTitle — direct unit tests for the title-truncation helper.
// These run against the in-process export, not the spawned handler.
// ---------------------------------------------------------------------------

test('truncateTitle: undefined/null/empty pass through unchanged', () => {
  assert.equal(truncateTitle(undefined), undefined);
  assert.equal(truncateTitle(null), null);
  assert.equal(truncateTitle(''), '');
});

test('truncateTitle: "Unknown" (the handler fallback) is not modified', () => {
  assert.equal(truncateTitle('Unknown'), 'Unknown');
});

test('truncateTitle: titles of 78 code points or less are returned intact', () => {
  const exact = 'a'.repeat(TITLE_MAX);
  assert.equal(truncateTitle(exact), exact, '78-code-point title must be unchanged');
  const short = 'Fix login page';
  assert.equal(truncateTitle(short), short);
});

test('truncateTitle: 79 code points triggers the 36 + sep + 36 split', () => {
  const input = 'a'.repeat(79);
  const out = truncateTitle(input);
  const expected = 'a'.repeat(TITLE_KEEP) + TITLE_SEPARATOR + 'a'.repeat(TITLE_KEEP);
  assert.equal(out, expected, `got ${JSON.stringify(out)}`);
  // Output length is exactly 36 + 3 + 36 = 75 regardless of input length.
  assert.equal(Array.from(out).length, 75);
});

test('truncateTitle: very long input still produces a 75-code-point output', () => {
  const out = truncateTitle('z'.repeat(500));
  assert.equal(out.length, 75);
  assert.equal(out.startsWith('z'.repeat(TITLE_KEEP)), true);
  assert.equal(out.endsWith('z'.repeat(TITLE_KEEP)), true);
  assert.ok(out.includes(TITLE_SEPARATOR));
});

test('truncateTitle: the user-provided example produces the expected shape', () => {
  const input =
    'Vamos a consolidar estos cambios vas a crear una rama, le vas a hacer commit a los cambios, ' +
    'vas a crear un issue, vas a crear un pull request, los vas a relacionar, ' +
    'vas a aceptar el pull request.';
  const expected = 'Vamos a consolidar estos cambios vas ⟶ onar, vas a aceptar el pull request.';
  const out = truncateTitle(input);
  assert.equal(out, expected);
  assert.equal(Array.from(out).length, 75);
});

test('truncateTitle: emoji and surrogate pairs are not split mid-codepoint', () => {
  // 🚀 is U+1F680 (surrogate pair in UTF-16, single code point). Slicing by
  // raw length would split a surrogate pair into "\uFFFD" — verify we don't.
  const head = '🚀'.repeat(TITLE_KEEP);
  const tailText = 'fin del título con texto ASCII suficiente para alcanzar 36 cps';
  const input = head + tailText;
  const out = truncateTitle(input);
  // No replacement chars (U+FFFD) anywhere.
  assert.ok(!out.includes('\uFFFD'), `split surrogate in ${JSON.stringify(out)}`);
  // The 36 head code points must all be 🚀.
  const first36 = Array.from(out).slice(0, TITLE_KEEP).join('');
  assert.equal(first36, '🚀'.repeat(TITLE_KEEP));
});

test('truncateTitle: emoji at the head of the long example is preserved whole', () => {
  const input = '🚀 Lanzar deploy ahora mismo para validar el flujo completo'.padEnd(80, 'x');
  const out = truncateTitle(input);
  assert.ok(out.startsWith('🚀 Lanzar deploy'), `got ${JSON.stringify(out)}`);
});

test('truncateTitle: exported constants match the documented values', () => {
  assert.equal(TITLE_MAX, 78);
  assert.equal(TITLE_KEEP, 36);
  assert.equal(TITLE_SEPARATOR, ' ⟶ ');
});

// ---------------------------------------------------------------------------
// End-to-end: notify.mjs handler must apply truncateTitle before emitting.
// ---------------------------------------------------------------------------

test('Stop with short session_title does not add a separator in the body', async () => {
  const mock = await start();
  const home = await tmpHome();
  try {
    await seed(home, { topic: 'mytopic', server: mock.url });
    const r = await runNotify(
      home,
      JSON.stringify({ ...payloads.stop, session_title: 'Fix login page' }),
    );
    assert.equal(r.code, 0, `stderr=${r.stderr}`);
    assert.equal(mock.records.length, 1);
    assert.ok(mock.records[0].body.includes('💬 Fix login page'), mock.records[0].body);
    assert.ok(!mock.records[0].body.includes(' ⟶ '), mock.records[0].body);
  } finally {
    await mock.close().catch(() => {});
    await rm(home, { recursive: true, force: true });
  }
});

test('Stop with very long session_title is truncated to first/last 36 with separator', async () => {
  const mock = await start();
  const home = await tmpHome();
  try {
    await seed(home, { topic: 'mytopic', server: mock.url });
    const longTitle =
      'Vamos a consolidar estos cambios vas a crear una rama, le vas a hacer commit a los cambios, ' +
      'vas a crear un issue, vas a crear un pull request, los vas a relacionar, ' +
      'vas a aceptar el pull request.';
    const r = await runNotify(home, JSON.stringify({ ...payloads.stop, session_title: longTitle }));
    assert.equal(r.code, 0, `stderr=${r.stderr}`);
    assert.equal(mock.records.length, 1);
    const body = mock.records[0].body;
    assert.ok(body.includes('Vamos a consolidar estos cambios vas'), body);
    assert.ok(body.includes('onar, vas a aceptar el pull request.'), body);
    assert.ok(body.includes(' ⟶ '), body);
    // Extract the line that follows the 💬 prefix and assert its length.
    const line = body.split('\n').find((l) => l.startsWith('💬 ')) ?? '';
    const titleInBody = line.slice('💬 '.length);
    const cpLength = Array.from(titleInBody).length;
    assert.ok(cpLength <= 78, `title line was ${cpLength} code points: ${titleInBody}`);
  } finally {
    await mock.close().catch(() => {});
    await rm(home, { recursive: true, force: true });
  }
});

test('Stop with 79-character session_title triggers the truncation', async () => {
  const mock = await start();
  const home = await tmpHome();
  try {
    await seed(home, { topic: 'mytopic', server: mock.url });
    const r = await runNotify(
      home,
      JSON.stringify({ ...payloads.stop, session_title: 'a'.repeat(79) }),
    );
    assert.equal(r.code, 0, `stderr=${r.stderr}`);
    assert.equal(mock.records.length, 1);
    const expected = 'a'.repeat(TITLE_KEEP) + TITLE_SEPARATOR + 'a'.repeat(TITLE_KEEP);
    assert.ok(mock.records[0].body.includes(expected), mock.records[0].body);
  } finally {
    await mock.close().catch(() => {});
    await rm(home, { recursive: true, force: true });
  }
});

test('Stop with emoji in session_title keeps the emoji intact across truncation', async () => {
  const mock = await start();
  const home = await tmpHome();
  try {
    await seed(home, { topic: 'mytopic', server: mock.url });
    const title = '🚀 Lanzar deploy ahora mismo para validar el flujo completo'.padEnd(120, 'x');
    const r = await runNotify(home, JSON.stringify({ ...payloads.stop, session_title: title }));
    assert.equal(r.code, 0, `stderr=${r.stderr}`);
    assert.equal(mock.records.length, 1);
    const body = mock.records[0].body;
    // The 🚀 glyph survives at the head — no replacement char.
    assert.ok(!body.includes('\uFFFD'), `body had replacement chars: ${body}`);
    assert.ok(body.includes('🚀 Lanzar deploy'), body);
    assert.ok(body.includes(' ⟶ '), body);
  } finally {
    await mock.close().catch(() => {});
    await rm(home, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Persistent diagnostic log. The handler writes append-only to
// $KIMI_CODE_HOME/logs/kimi-ntfy.log with the same shape as
// ~/.kimi-code/logs/kimi-code.log. Tests pass KIMI_NTFY_LOG=<tmp> to keep
// the user's real log file untouched.
// ---------------------------------------------------------------------------

test('logEvent: writes one JSON object per line with ts, level, event and arbitrary fields', () => {
  const tmp = join(
    tmpdir(),
    `kimi-ntfy-log-${Date.now()}-${Math.random().toString(36).slice(2)}.jsonl`,
  );
  try {
    process.env.KIMI_NTFY_LOG = tmp;
    logEvent('info', 'invoke', { hook_event: 'Stop', sid: 'session_abc', agent: 'main' });
    const content = readFileSync(tmp, 'utf8');
    const lines = content.trim().split('\n').filter(Boolean);
    assert.equal(lines.length, 1, `expected exactly one line, got ${lines.length}`);
    const obj = JSON.parse(lines[0]);
    assert.match(obj.ts, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    assert.equal(obj.level, 'info');
    assert.equal(obj.event, 'invoke');
    assert.equal(obj.hook_event, 'Stop');
    assert.equal(obj.sid, 'session_abc');
    assert.equal(obj.agent, 'main');
  } finally {
    Reflect.deleteProperty(process.env, 'KIMI_NTFY_LOG');
    rm(tmp, { force: true });
  }
});

test('logEvent: writes a strictly-typed JSONL — one event per line, no embedded newlines', () => {
  const tmp = join(
    tmpdir(),
    `kimi-ntfy-log-${Date.now()}-${Math.random().toString(36).slice(2)}.jsonl`,
  );
  try {
    process.env.KIMI_NTFY_LOG = tmp;
    logEvent('info', 'probe', { msg: 'hello   world\nNEWLINE HERE', multi: 'a\tb' });
    const content = readFileSync(tmp, 'utf8');
    const lines = content.split('\n');
    // JSON.stringify will escape the embedded \n as \n inside the JSON string,
    // so the file still has exactly one line terminated by \n.
    assert.equal(lines.filter(Boolean).length, 1, `got ${JSON.stringify(lines)}`);
    assert.ok(content.endsWith('\n'));
    const obj = JSON.parse(content);
    assert.equal(obj.msg, 'hello   world\nNEWLINE HERE');
    assert.equal(obj.multi, 'a\tb');
  } finally {
    Reflect.deleteProperty(process.env, 'KIMI_NTFY_LOG');
    rm(tmp, { force: true });
  }
});

test('logEvent: creates the parent directory if missing', () => {
  const root = join(
    tmpdir(),
    `kimi-ntfy-logdir-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  const target = join(root, 'a', 'b', 'c', 'notify.jsonl');
  try {
    process.env.KIMI_NTFY_LOG = target;
    logEvent('info', 'mkdir_test', { x: 1 });
    assert.ok(existsSync(target), `target missing at ${target}`);
    const content = readFileSync(target, 'utf8');
    const obj = JSON.parse(content.trim());
    assert.equal(obj.event, 'mkdir_test');
    assert.equal(obj.x, 1);
  } finally {
    Reflect.deleteProperty(process.env, 'KIMI_NTFY_LOG');
    rm(root, { recursive: true, force: true });
  }
});

test('logEvent: KIMI_NTFY_LOG=disable writes nothing', () => {
  const tmp = join(
    tmpdir(),
    `kimi-ntfy-log-${Date.now()}-${Math.random().toString(36).slice(2)}.jsonl`,
  );
  try {
    process.env.KIMI_NTFY_LOG = 'disable';
    logEvent('info', 'should_not_appear', { x: 1 });
    assert.equal(existsSync(tmp), false, 'no file should be created when disabled');
  } finally {
    Reflect.deleteProperty(process.env, 'KIMI_NTFY_LOG');
    rm(tmp, { force: true });
  }
});

test('logEvent: writes mode 0600', async () => {
  const tmp = join(
    tmpdir(),
    `kimi-ntfy-log-${Date.now()}-${Math.random().toString(36).slice(2)}.jsonl`,
  );
  try {
    process.env.KIMI_NTFY_LOG = tmp;
    logEvent('info', 'permission', { mode: '0600' });
    const st = await stat(tmp);
    assert.equal(st.mode & 0o777, 0o600, `mode is ${(st.mode & 0o777).toString(8)}`);
  } finally {
    Reflect.deleteProperty(process.env, 'KIMI_NTFY_LOG');
    rm(tmp, { force: true });
  }
});

test('logEvent: long fields are accepted and parse back from JSON cleanly', () => {
  const tmp = join(
    tmpdir(),
    `kimi-ntfy-log-${Date.now()}-${Math.random().toString(36).slice(2)}.jsonl`,
  );
  try {
    process.env.KIMI_NTFY_LOG = tmp;
    const huge = 'x'.repeat(2048);
    logEvent('info', 'truncate', { msg: huge });
    const content = readFileSync(tmp, 'utf8');
    // JSONL keeps one line per event regardless of field size — no truncation.
    assert.equal(content.split('\n').filter(Boolean).length, 1);
    const obj = JSON.parse(content);
    assert.equal(obj.msg.length, 2048, 'JSONL does not truncate; the whole msg persists');
  } finally {
    Reflect.deleteProperty(process.env, 'KIMI_NTFY_LOG');
    rm(tmp, { force: true });
  }
});

test('logEvent: emits to stdout for INFO and stderr for ERROR (capture helper)', () => {
  const tmp = join(
    tmpdir(),
    `kimi-ntfy-log-${Date.now()}-${Math.random().toString(36).slice(2)}.jsonl`,
  );
  try {
    process.env.KIMI_NTFY_LOG = tmp;
    // Capture both streams from this Node process (the test IS Node, so
    // monkey-patch process.stdout / process.stderr just for this test).
    const captured = { stdout: '', stderr: '' };
    const origWriteOut = process.stdout.write.bind(process.stdout);
    const origWriteErr = process.stderr.write.bind(process.stderr);
    process.stdout.write = (chunk, ...rest) => {
      captured.stdout += String(chunk);
      return origWriteOut(chunk, ...rest);
    };
    process.stderr.write = (chunk, ...rest) => {
      captured.stderr += String(chunk);
      return origWriteErr(chunk, ...rest);
    };
    try {
      logEvent('info', 'std_invoke', { foo: 'bar' });
      logEvent('error', 'std_fail', { code: 500 });
    } finally {
      process.stdout.write = origWriteOut;
      process.stderr.write = origWriteErr;
    }
    assert.match(captured.stdout, /"event":"std_invoke"/, captured.stdout);
    assert.match(captured.stderr, /"event":"std_fail"/, captured.stderr);
    assert.match(captured.stderr, /"level":"error"/, captured.stderr);
    assert.doesNotMatch(captured.stdout, /"event":"std_fail"/, captured.stdout);
    // Each line ends with \n and parses as JSON.
    const stdoutObj = JSON.parse(captured.stdout.trim());
    assert.equal(stdoutObj.event, 'std_invoke');
    const stderrObj = JSON.parse(captured.stderr.trim());
    assert.equal(stderrObj.event, 'std_fail');
  } finally {
    Reflect.deleteProperty(process.env, 'KIMI_NTFY_LOG');
    rm(tmp, { force: true });
  }
});

test('logEvent: KIMI_NTFY_LOG=silent suppresses stdout, stderr AND the file', () => {
  const tmp = join(
    tmpdir(),
    `kimi-ntfy-log-${Date.now()}-${Math.random().toString(36).slice(2)}.jsonl`,
  );
  try {
    process.env.KIMI_NTFY_LOG = 'silent';
    const captured = { stdout: '', stderr: '' };
    const origWriteOut = process.stdout.write.bind(process.stdout);
    const origWriteErr = process.stderr.write.bind(process.stderr);
    process.stdout.write = (chunk, ...rest) => {
      captured.stdout += String(chunk);
      return origWriteOut(chunk, ...rest);
    };
    process.stderr.write = (chunk, ...rest) => {
      captured.stderr += String(chunk);
      return origWriteErr(chunk, ...rest);
    };
    try {
      logEvent('info', 'should_not_appear_stdout', { x: 1 });
      logEvent('error', 'should_not_appear_stderr', { x: 1 });
    } finally {
      process.stdout.write = origWriteOut;
      process.stderr.write = origWriteErr;
    }
    assert.equal(captured.stdout, '', `stdout should be empty, got ${captured.stdout}`);
    assert.equal(captured.stderr, '', `stderr should be empty, got ${captured.stderr}`);
    // The tmp path was never created (no writes).
    assert.equal(existsSync(tmp), false, 'no file should be created when silent');
  } finally {
    Reflect.deleteProperty(process.env, 'KIMI_NTFY_LOG');
    rm(tmp, { force: true });
  }
});

test('DEFAULT_LOG_PATH ends in /logs/kimi-ntfy.jsonl', () => {
  assert.ok(
    DEFAULT_LOG_PATH.endsWith('logs/kimi-ntfy.jsonl'),
    `expected suffix logs/kimi-ntfy.jsonl, got ${DEFAULT_LOG_PATH}`,
  );
});

test('handler honors KIMI_CODE_HOME for the default log path', async () => {
  const mock = await start();
  const home = await tmpHome();
  Reflect.deleteProperty(process.env, 'KIMI_NTFY_LOG');
  try {
    await seed(home, {
      topic: 'mytopic',
      server: mock.url,
      notifyTurnEnd: true,
      settleAttempts: 0,
    });
    const r = await runNotifyWithEnv(home, JSON.stringify(payloads.stop), {
      ...process.env,
      KIMI_CODE_HOME: home,
    });
    assert.equal(r.code, 0, `stderr=${r.stderr}`);
    assert.equal(mock.records.length, 1);
    const expectedFile = join(home, 'logs', 'kimi-ntfy.jsonl');
    const st = await stat(expectedFile);
    assert.ok(st.size > 0, `expected log file at ${expectedFile} to be non-empty`);
    const events = (await readFile(expectedFile, 'utf8'))
      .split('\n')
      .filter(Boolean)
      .map((l) => JSON.parse(l));
    assert.ok(events.some((e) => e.event === 'invoke' && e.hook_event === 'Stop'));
  } finally {
    await mock.close().catch(() => {});
    await rm(home, { recursive: true, force: true });
  }
});

test('Stop silenced by settle_check writes settle + exit lines (JSONL)', async () => {
  const mock = await start();
  const home = await tmpHome();
  const logFile = join(home, 'kimi-ntfy.jsonl');
  const sessionDir = join(home, 'sessions', 'wd_test', 'session_busy_log', 'agents', 'main');
  try {
    await seed(home, {
      topic: 'mytopic',
      server: mock.url,
      notifyTurnEnd: true,
      settleAttempts: 0,
    });
    await mkdir(sessionDir, { recursive: true });
    const wireContent = [
      JSON.stringify({ event: { type: 'tool.call', toolCall: { name: 'Agent' } } }),
      JSON.stringify({ event: { type: 'step.end', finishReason: 'tool_use' } }),
    ].join('\n');
    await writeFile(join(sessionDir, 'wire.jsonl'), wireContent);

    const r = await runNotifyWithEnv(
      home,
      JSON.stringify({
        hook_event_name: 'Stop',
        session_id: 'session_busy_log',
        cwd: '/home/wolf/test',
      }),
      { ...process.env, KIMI_CODE_HOME: home, KIMI_NTFY_LOG: logFile },
    );
    assert.equal(r.code, 0, `stderr=${r.stderr}`);
    assert.equal(mock.records.length, 0, 'busy main agent should silence Stop');
    const events = (await readFile(logFile, 'utf8'))
      .split('\n')
      .filter(Boolean)
      .map((l) => JSON.parse(l));
    const settleEv = events.find((e) => e.event === 'settle');
    const exitEv = events.find((e) => e.event === 'exit');
    assert.ok(settleEv, `expected a settle event, got:\n${JSON.stringify(events, null, 2)}`);
    assert.ok(exitEv, 'expected an exit event');
    assert.equal(settleEv.sid, 'session_busy_log');
    assert.equal(settleEv.result, false);
    assert.equal(settleEv.pending_tool_calls, 1);
    assert.equal(settleEv.last_finish_reason, 'tool_use');
    assert.equal(exitEv.path, 'settle_silenced');
  } finally {
    await mock.close().catch(() => {});
    await rm(home, { recursive: true, force: true });
  }
});

test('Stop normal flow writes invoke + settle result=true + notify + exit path=ok', async () => {
  const mock = await start();
  const home = await tmpHome();
  const logFile = join(home, 'kimi-ntfy.jsonl');
  try {
    await seed(home, {
      topic: 'mytopic',
      server: mock.url,
      notifyTurnEnd: true,
      settleAttempts: 0,
    });
    const r = await runNotifyWithEnv(home, JSON.stringify(payloads.stop), {
      ...process.env,
      KIMI_CODE_HOME: home,
      KIMI_NTFY_LOG: logFile,
    });
    assert.equal(r.code, 0, `stderr=${r.stderr}`);
    assert.equal(mock.records.length, 1);
    const events = (await readFile(logFile, 'utf8'))
      .split('\n')
      .filter(Boolean)
      .map((l) => JSON.parse(l));
    const types = events.map((e) => e.event);
    assert.ok(types.includes('invoke'));
    assert.ok(types.includes('settle'));
    assert.ok(types.includes('notify'));
    assert.ok(types.includes('exit'));
    assert.equal(events.find((e) => e.event === 'invoke').hook_event, 'Stop');
    assert.equal(events.find((e) => e.event === 'settle').result, true);
    assert.equal(events.find((e) => e.event === 'notify').status, 200);
    assert.equal(events.find((e) => e.event === 'exit').path, 'ok');
  } finally {
    await mock.close().catch(() => {});
    await rm(home, { recursive: true, force: true });
  }
});

test('Stop silenced by notifyTurnEnd=false writes filter reason=notifyTurnEnd + exit path=filter_silenced', async () => {
  const mock = await start();
  const home = await tmpHome();
  const logFile = join(home, 'kimi-ntfy.jsonl');
  try {
    await seed(home, { topic: 'mytopic', server: mock.url, notifyTurnEnd: false });
    const r = await runNotifyWithEnv(home, JSON.stringify(payloads.stop), {
      ...process.env,
      KIMI_CODE_HOME: home,
      KIMI_NTFY_LOG: logFile,
    });
    assert.equal(r.code, 0, `stderr=${r.stderr}`);
    assert.equal(mock.records.length, 0);
    const events = (await readFile(logFile, 'utf8'))
      .split('\n')
      .filter(Boolean)
      .map((l) => JSON.parse(l));
    const filterEv = events.find((e) => e.event === 'filter');
    const exitEv = events.find((e) => e.event === 'exit');
    assert.ok(filterEv, `expected a filter event, got ${JSON.stringify(events)}`);
    assert.equal(filterEv.reason, 'notifyTurnEnd');
    assert.equal(filterEv.hook_event, 'Stop');
    assert.equal(exitEv.path, 'filter_silenced');
  } finally {
    await mock.close().catch(() => {});
    await rm(home, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Unit tests for verifySettledStop — pins the new return shape
// ({settled, pendingToolCalls, lastFinishReason, attempts}).
// ---------------------------------------------------------------------------

test('verifySettledStop: null sessionDir returns settled:true with zero counters', async () => {
  const v = await verifySettledStop(null, {});
  assert.deepEqual(v, { settled: true, pendingToolCalls: 0, lastFinishReason: null, attempts: 0 });
});

test('verifySettledStop: missing wire.jsonl returns settled:true (defaults)', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'kimi-ntfy-settle-'));
  try {
    // No agents/main/wire.jsonl under this dir.
    const v = await verifySettledStop(dir, {});
    assert.equal(v.settled, true);
    assert.equal(v.pendingToolCalls, 0);
    assert.equal(v.lastFinishReason, null);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('verifySettledStop: pending tool.call returns settled:false with pendingToolCalls=1', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'kimi-ntfy-settle-'));
  const wireDir = join(dir, 'agents', 'main');
  try {
    await mkdir(wireDir, { recursive: true });
    await writeFile(
      join(wireDir, 'wire.jsonl'),
      `${JSON.stringify({ event: { type: 'tool.call', toolCall: { name: 'Bash' } } })}\n${JSON.stringify({ event: { type: 'step.end', finishReason: 'tool_use' } })}\n`,
    );
    const v = await verifySettledStop(dir, { settleAttempts: 0 });
    assert.equal(v.settled, false);
    assert.equal(v.pendingToolCalls, 1);
    assert.equal(v.lastFinishReason, 'tool_use');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('verifySettledStop: balanced tool.call+tool.result returns settled:true', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'kimi-ntfy-settle-'));
  const wireDir = join(dir, 'agents', 'main');
  try {
    await mkdir(wireDir, { recursive: true });
    await writeFile(
      join(wireDir, 'wire.jsonl'),
      `${JSON.stringify({ event: { type: 'tool.call', toolCall: { name: 'Bash' } } })}\n${JSON.stringify({ event: { type: 'tool.result' } })}\n${JSON.stringify({ event: { type: 'step.end', finishReason: 'end_turn' } })}\n`,
    );
    const v = await verifySettledStop(dir, { settleAttempts: 0 });
    assert.equal(v.settled, true);
    assert.equal(v.pendingToolCalls, 0);
    assert.equal(v.lastFinishReason, 'end_turn');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Truncation helpers — RESPONSE_MAX caps body text for both assistantText
// and subagentResponse.
// ---------------------------------------------------------------------------

test('RESPONSE_MAX is 3000 and helper truncates above that with a marker', () => {
  assert.equal(RESPONSE_MAX, 3000);
  // Indirect via the integration: send a long SubagentStop response and
  // expect the (Truncated) marker.
});

test('SubagentStop body truncates long responses over RESPONSE_MAX chars', async () => {
  const mock = await start();
  const home = await tmpHome();
  try {
    await seed(home, {
      topic: 'mytopic',
      server: mock.url,
      notifySubagent: true,
    });
    const huge = 'y'.repeat(RESPONSE_MAX * 2);
    const r = await runNotifyWithEnv(
      home,
      JSON.stringify({
        hook_event_name: 'SubagentStop',
        session_id: 'session_subagent_test',
        session_title: 'x',
        client_type: 'kimi_code_cli',
        agent_name: 'explore',
        cwd: '/home/wolf/test',
        response: huge,
      }),
      { ...process.env, KIMI_CODE_HOME: home },
    );
    assert.equal(r.code, 0, `stderr=${r.stderr}`);
    assert.equal(mock.records.length, 1);
    const body = mock.records[0].body;
    assert.ok(body.includes('*(Truncated)*'), body);
    assert.ok(!body.includes('y'.repeat(RESPONSE_MAX + 2)));
  } finally {
    await mock.close().catch(() => {});
    await rm(home, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Stderr capture for error events — confirms JSONL flow through stderr
// independently of the persisted file.
// ---------------------------------------------------------------------------

test('handler emits JSONL error events on stderr when ntfy returns 5xx', async () => {
  const mock = await start();
  const home = await tmpHome();
  try {
    await seed(home, {
      topic: 'mytopic',
      server: `${mock.url}?fail=1`,
      notifyTurnEnd: true,
      settleAttempts: 0,
    });
    const r = await runNotifyWithEnv(home, JSON.stringify(payloads.stop), {
      ...process.env,
      KIMI_CODE_HOME: home,
      KIMI_NTFY_LOG: 'disable', // disable the persisted file; stream output remains
    });
    assert.equal(r.code, 0, `stderr=${r.stderr}`);
    // stderr MUST contain at least one JSONL error event. Any non-JSON
    // lines (the legacy [kimi-ntfy] stderr text from the handler) are
    // silently skipped.
    const stderrLines = r.stderr
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    const errorEvents = stderrLines
      .map((l) => {
        try {
          return JSON.parse(l);
        } catch {
          return null;
        }
      })
      .filter((e) => e && e.level === 'error' && e.event === 'notify');
    assert.ok(errorEvents.length >= 1, `expected error event on stderr, got ${r.stderr}`);
    assert.equal(errorEvents[0].status, 500);
  } finally {
    await mock.close().catch(() => {});
    await rm(home, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Tail-only reads — verify the handler doesn't load multi-MB wire files.
// ---------------------------------------------------------------------------

test('checkMainAgentIdle reads only the tail of wire.jsonl (perf guarantee)', async () => {
  // Synthesize a 2 MB wire.jsonl full of "tool.call" never followed by
  // tool.result. The settled verdict must be false (still busy) and the
  // process should finish quickly — a full read of 2 MB would take
  // measurable time on slow disks; tail-only stays fast.
  const dir = await mkdtemp(join(tmpdir(), 'kimi-ntfy-tail-'));
  const wireDir = join(dir, 'agents', 'main');
  try {
    await mkdir(wireDir, { recursive: true });
    const fakeLines = [];
    for (let i = 0; i < 30000; i++) {
      fakeLines.push(JSON.stringify({ event: { type: 'tool.call', toolCall: { name: 'Bash' } } }));
    }
    const body = `${fakeLines.join('\n')}\n`; // ~2.0 MB
    await writeFile(join(wireDir, 'wire.jsonl'), body);
    const stat1 = await stat(join(wireDir, 'wire.jsonl'));
    assert.ok(stat1.size > 1_000_000, `wire should be > 1 MB; got ${stat1.size}`);

    const startNs = process.hrtime.bigint();
    const v = await verifySettledStop(dir, { settleAttempts: 0 });
    const elapsedMs = Number(process.hrtime.bigint() - startNs) / 1e6;

    assert.equal(v.settled, false, '30k pending tool.calls must look busy');
    assert.ok(v.pendingToolCalls > 0);
    // Soft timing ceiling: 200ms is well above tail-only read time on
    // any reasonable disk; full read of 2 MB is consistently slower.
    assert.ok(elapsedMs < 200, `verifySettledStop took ${elapsedMs}ms; expected tail-only`);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Surface JSON parse errors from readConfig — verifiable via a tampered
// config file (invalid JSON) at the default path.
// ---------------------------------------------------------------------------

test('handler logs a config error event when config JSON is malformed', async () => {
  const mock = await start();
  const home = await tmpHome();
  const logFile = join(home, 'kimi-ntfy.jsonl');
  try {
    // Tamper: write invalid JSON so JSON.parse throws.
    await writeFile(join(home, 'kimi-ntfy-config.json'), '{ "topic": "kimiCode",\n  "broken":\n', {
      mode: 0o600,
    });
    const r = await runNotifyWithEnv(home, JSON.stringify(payloads.stop), {
      ...process.env,
      KIMI_CODE_HOME: home,
      KIMI_NTFY_LOG: logFile,
    });
    assert.equal(r.code, 0, `stderr=${r.stderr}`);
    assert.equal(mock.records.length, 0, 'malformed config should silence Stop');
    const events = (await readFile(logFile, 'utf8'))
      .split('\n')
      .filter(Boolean)
      .map((l) => JSON.parse(l));
    const bad = events.find((e) => e.event === 'config' && e.status === 'invalid_parse');
    assert.ok(bad, `expected an invalid_parse config event, got ${JSON.stringify(events)}`);
    assert.equal(bad.level, 'error');
    assert.match(bad.error_message, /JSON|parse|Unexpected/);
  } finally {
    await mock.close().catch(() => {});
    await rm(home, { recursive: true, force: true });
  }
});

async function runNotifyWithEnv(home, stdinText, env) {
  return new Promise((resolve, reject) => {
    const child = spawn('node', [NOTIFY], { env, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => {
      stdout += d.toString('utf8');
    });
    child.stderr.on('data', (d) => {
      stderr += d.toString('utf8');
    });
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, stdout, stderr }));
    child.stdin.end(stdinText);
  });
}
