// Hook-handler coverage for bin/notify.mjs. Each test starts a fresh mock
// ntfy server, drops a config into a tmpdir, and spawns notify.mjs with the
// payload on its stdin.

import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { TITLE_KEEP, TITLE_MAX, TITLE_SEPARATOR, truncateTitle } from '../bin/notify.mjs';
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
