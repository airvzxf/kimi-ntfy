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

test('Stop posts once with priority 3, white_check_mark tag, and cwd in body', async () => {
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
    assert.equal(rec.headers.priority, '3');
    assert.ok(rec.headers.tags.includes('white_check_mark'), `tags were ${rec.headers.tags}`);
    assert.equal(rec.headers.markdown, 'yes');
    assert.ok(rec.headers.click.includes('/mytopic'), `click was ${rec.headers.click}`);
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
    assert.ok(mock.records[0].body.includes('Sesión:'), `body was ${mock.records[0].body}`);
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
    // Stop default is 3 — typo must not stop notifications.
    assert.equal(mock.records[0].headers.priority, '3');
  } finally {
    await mock.close().catch(() => {});
    await rm(home, { recursive: true, force: true });
  }
});
