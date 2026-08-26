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
  TITLE_KEEP,
  TITLE_MAX,
  TITLE_SEPARATOR,
  logEvent,
  truncateTitle,
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

test('logEvent: writes an ISO-timestamped line with LEVEL, event, and key=value fields', () => {
  const tmp = join(
    tmpdir(),
    `kimi-ntfy-log-${Date.now()}-${Math.random().toString(36).slice(2)}.log`,
  );
  try {
    process.env.KIMI_NTFY_LOG = tmp;
    logEvent('info', 'invoke', { event: 'Stop', sid: 'session_abc', agent: 'main' });
    const line = readFileSync(tmp, 'utf8').trimEnd();
    assert.match(
      line,
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z INFO {1,2}invoke {2,}event=Stop sid=session_abc agent=main$/,
    );
  } finally {
    Reflect.deleteProperty(process.env, 'KIMI_NTFY_LOG');
    rm(tmp, { force: true });
  }
});

test('logEvent: collapses whitespace and newlines in field values to one log line', () => {
  const tmp = join(
    tmpdir(),
    `kimi-ntfy-log-${Date.now()}-${Math.random().toString(36).slice(2)}.log`,
  );
  try {
    process.env.KIMI_NTFY_LOG = tmp;
    logEvent('info', 'probe', { msg: 'hello   world\nNEWLINE HERE', multi: 'a\tb' });
    const content = readFileSync(tmp, 'utf8');
    assert.equal(content.split('\n').filter(Boolean).length, 1);
    assert.ok(!content.includes('\nNEWLINE'));
    assert.ok(content.includes('hello_world_NEWLINE_HERE'));
    assert.ok(content.includes('a_b'));
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
  const target = join(root, 'a', 'b', 'c', 'notify.log');
  try {
    process.env.KIMI_NTFY_LOG = target;
    logEvent('info', 'mkdir_test', { x: 1 });
    assert.ok(existsSync(target), `target missing at ${target}`);
    const content = readFileSync(target, 'utf8');
    assert.ok(content.includes('mkdir_test'));
    assert.ok(content.includes('x=1'));
  } finally {
    Reflect.deleteProperty(process.env, 'KIMI_NTFY_LOG');
    rm(root, { recursive: true, force: true });
  }
});

test('logEvent: KIMI_NTFY_LOG=disable writes nothing', () => {
  const tmp = join(
    tmpdir(),
    `kimi-ntfy-log-${Date.now()}-${Math.random().toString(36).slice(2)}.log`,
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
    `kimi-ntfy-log-${Date.now()}-${Math.random().toString(36).slice(2)}.log`,
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

test('logEvent: truncates fields longer than 256 chars to keep one line per event', () => {
  const tmp = join(
    tmpdir(),
    `kimi-ntfy-log-${Date.now()}-${Math.random().toString(36).slice(2)}.log`,
  );
  try {
    process.env.KIMI_NTFY_LOG = tmp;
    const huge = 'x'.repeat(1000);
    logEvent('info', 'truncate', { msg: huge });
    const content = readFileSync(tmp, 'utf8');
    assert.equal(content.split('\n').filter(Boolean).length, 1);
    const xrun = content.match(/x+/)?.[0].length ?? 0;
    assert.ok(xrun <= 256, `expected <= 256 x's, got ${xrun}`);
  } finally {
    Reflect.deleteProperty(process.env, 'KIMI_NTFY_LOG');
    rm(tmp, { force: true });
  }
});

test('DEFAULT_LOG_PATH is under $KIMI_CODE_HOME/logs/kimi-ntfy.log', () => {
  assert.ok(
    DEFAULT_LOG_PATH.endsWith('logs/kimi-ntfy.log'),
    `expected suffix logs/kimi-ntfy.log, got ${DEFAULT_LOG_PATH}`,
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
    const expectedFile = join(home, 'logs', 'kimi-ntfy.log');
    const st = await stat(expectedFile);
    assert.ok(st.size > 0, `expected log file at ${expectedFile} to be non-empty`);
  } finally {
    await mock.close().catch(() => {});
    await rm(home, { recursive: true, force: true });
  }
});

test('Stop silenced by settle_check writes settle + exit lines', async () => {
  const mock = await start();
  const home = await tmpHome();
  const logFile = join(home, 'kimi-ntfy.log');
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
    const content = await readFile(logFile, 'utf8');
    assert.ok(content.includes('settle'), `expected a settle line, got:\n${content}`);
    assert.ok(content.includes('sid=session_busy_log'), content);
    assert.ok(content.includes('result=false'), content);
    assert.ok(content.includes('pending_tool_calls='), content);
    assert.ok(content.includes('last_finish_reason=tool_use'), content);
    assert.ok(content.includes('path=settle_silenced'), content);
  } finally {
    await mock.close().catch(() => {});
    await rm(home, { recursive: true, force: true });
  }
});

test('Stop normal flow writes invoke + settle result=true + notify + exit path=ok', async () => {
  const mock = await start();
  const home = await tmpHome();
  const logFile = join(home, 'kimi-ntfy.log');
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
    const content = await readFile(logFile, 'utf8');
    assert.ok(content.includes('invoke'), content);
    assert.ok(content.includes('event=Stop'), content);
    assert.ok(content.includes('settle'), content);
    assert.ok(content.includes('result=true'), content);
    assert.ok(content.includes('notify'), content);
    assert.ok(content.includes('status='), content);
    assert.ok(content.includes('path=ok'), content);
  } finally {
    await mock.close().catch(() => {});
    await rm(home, { recursive: true, force: true });
  }
});

test('Stop silenced by notifyTurnEnd=false writes filter reason=notifyTurnEnd + exit path=filter_silenced', async () => {
  const mock = await start();
  const home = await tmpHome();
  const logFile = join(home, 'kimi-ntfy.log');
  try {
    await seed(home, { topic: 'mytopic', server: mock.url, notifyTurnEnd: false });
    const r = await runNotifyWithEnv(home, JSON.stringify(payloads.stop), {
      ...process.env,
      KIMI_CODE_HOME: home,
      KIMI_NTFY_LOG: logFile,
    });
    assert.equal(r.code, 0, `stderr=${r.stderr}`);
    assert.equal(mock.records.length, 0);
    const content = await readFile(logFile, 'utf8');
    assert.ok(content.includes('filter'), content);
    assert.ok(content.includes('reason=notifyTurnEnd'), content);
    assert.ok(content.includes('event=Stop'), content);
    assert.ok(content.includes('path=filter_silenced'), content);
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
