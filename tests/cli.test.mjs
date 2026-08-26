// Subcommand coverage for bin/kimi-ntfy-cli.mjs. Each test creates a fresh
// KIMI_CODE_HOME inside os.tmpdir() and spawns the CLI with KIMI_CODE_HOME
// pointing at it. spawnSync keeps the assertions straightforward.

import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { start } from './mock-ntfy.mjs';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const REPO_ROOT = join(HERE, '..');
const CLI = join(REPO_ROOT, 'bin', 'kimi-ntfy-cli.mjs');
const CONFIG_FILE = 'kimi-ntfy-config.json';

function tmpHome(prefix) {
  return mkdtemp(join(tmpdir(), `kimi-ntfy-cli-${prefix}-`));
}

function configPath(home) {
  return join(home, CONFIG_FILE);
}

function runCli(home, ...args) {
  return new Promise((resolve) => {
    const child = spawn('node', [CLI, ...args], {
      env: { ...process.env, KIMI_CODE_HOME: home },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => {
      stdout += d.toString('utf8');
    });
    child.stderr.on('data', (d) => {
      stderr += d.toString('utf8');
    });
    child.on('error', (err) => {
      resolve({ status: null, signal: null, stdout, stderr, error: err });
    });
    child.on('close', (code, signal) => {
      resolve({ status: code, signal, stdout, stderr });
    });
    setTimeout(() => {
      child.kill('SIGKILL');
      resolve({ status: null, signal: 'SIGKILL', stdout, stderr, error: new Error('Timeout') });
    }, 10000);
  });
}

async function readConfig(home) {
  const raw = await readFile(configPath(home), 'utf8');
  return JSON.parse(raw);
}

async function seed(home, partial) {
  await writeFile(configPath(home), JSON.stringify(partial, null, 2), { mode: 0o600 });
}

test('cli setup writes the config file with mode 0600 and the given topic', async () => {
  const home = await tmpHome('setup-ok');
  try {
    const r = await runCli(home, 'setup', 'mytopic');
    assert.equal(r.status, 0, `unexpected exit, stderr=${r.stderr}`);
    const cfg = await readConfig(home);
    assert.equal(cfg.topic, 'mytopic');
    const st = await stat(configPath(home));
    assert.equal(st.mode & 0o777, 0o600, `mode is ${(st.mode & 0o777).toString(8)}`);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test('cli setup rejects an empty topic with exit 2', async () => {
  const home = await tmpHome('setup-empty');
  try {
    const r = await runCli(home, 'setup', '');
    assert.equal(r.status, 2);
    assert.match(r.stderr, /topic/);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test('cli setup rejects a topic containing bad characters', async () => {
  const home = await tmpHome('setup-bad');
  try {
    const r = await runCli(home, 'setup', 'bad topic!');
    assert.equal(r.status, 2);
    assert.match(r.stderr, /topic/);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test('cli setup rejects a topic longer than 64 chars', async () => {
  const home = await tmpHome('setup-long');
  try {
    const r = await runCli(home, 'setup', 'a'.repeat(65));
    assert.equal(r.status, 2);
    assert.match(r.stderr, /topic/);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test('cli setup writes the server when given two args', async () => {
  const home = await tmpHome('setup-server');
  try {
    const r = await runCli(home, 'setup', 'mytopic', 'http://localhost:1234');
    assert.equal(r.status, 0, `unexpected exit, stderr=${r.stderr}`);
    const cfg = await readConfig(home);
    assert.equal(cfg.topic, 'mytopic');
    assert.equal(cfg.server, 'http://localhost:1234');
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test('cli setup preserves an existing language and notifySubagent', async () => {
  const home = await tmpHome('setup-preserve');
  try {
    await seed(home, {
      topic: 'old',
      language: 'es',
      notifySubagent: true,
      server: 'https://ntfy.example.com',
    });
    const r = await runCli(home, 'setup', 'newtopic');
    assert.equal(r.status, 0, `unexpected exit, stderr=${r.stderr}`);
    const cfg = await readConfig(home);
    assert.equal(cfg.topic, 'newtopic');
    assert.equal(cfg.language, 'es');
    assert.equal(cfg.notifySubagent, true);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test('cli lang sets language to es and rejects fr', async () => {
  const home = await tmpHome('lang');
  try {
    await seed(home, { topic: 't', server: 'http://x' });
    const ok = await runCli(home, 'lang', 'es');
    assert.equal(ok.status, 0, `unexpected exit, stderr=${ok.stderr}`);
    assert.equal((await readConfig(home)).language, 'es');
    const bad = await runCli(home, 'lang', 'fr');
    assert.equal(bad.status, 2);
    assert.match(bad.stderr, /language/i);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test('cli server sets the URL and rejects non-URL input', async () => {
  const home = await tmpHome('server');
  try {
    await seed(home, { topic: 't' });
    const ok = await runCli(home, 'server', 'https://ntfy.example.com');
    assert.equal(ok.status, 0, `unexpected exit, stderr=${ok.stderr}`);
    assert.equal((await readConfig(home)).server, 'https://ntfy.example.com');
    const bad = await runCli(home, 'server', 'not-a-url');
    assert.equal(bad.status, 2);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test('cli setup rejects a non-URL server', async () => {
  const home = await tmpHome('setup-bad-server');
  try {
    const r = await runCli(home, 'setup', 'mytopic', 'invalid-server');
    assert.equal(r.status, 2);
    assert.match(r.stderr, /server/i);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test('cli subagents on|off toggles the flag and prints proper feedback', async () => {
  const home = await tmpHome('sub');
  try {
    await seed(home, { topic: 't' });
    const on = await runCli(home, 'subagents', 'on');
    assert.equal(on.status, 0, `unexpected exit, stderr=${on.stderr}`);
    assert.equal((await readConfig(home)).notifySubagent, true);
    assert.match(on.stdout, /enabled/);
    const off = await runCli(home, 'subagents', 'off');
    assert.equal(off.status, 0, `unexpected exit, stderr=${off.stderr}`);
    assert.equal((await readConfig(home)).notifySubagent, false);
    assert.match(off.stdout, /disabled/);
    const bad = await runCli(home, 'subagents', 'maybe');
    assert.equal(bad.status, 2);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test('cli session on|off toggles notifySessionEnd flag and prints proper feedback', async () => {
  const home = await tmpHome('session');
  try {
    await seed(home, { topic: 't' });
    const off = await runCli(home, 'session', 'off');
    assert.equal(off.status, 0, `unexpected exit, stderr=${off.stderr}`);
    assert.equal((await readConfig(home)).notifySessionEnd, false);
    assert.match(off.stdout, /disabled/);
    const on = await runCli(home, 'session', 'on');
    assert.equal(on.status, 0, `unexpected exit, stderr=${on.stderr}`);
    assert.equal((await readConfig(home)).notifySessionEnd, true);
    assert.match(on.stdout, /enabled/);
    const bad = await runCli(home, 'session', 'maybe');
    assert.equal(bad.status, 2);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test('cli approval on|off toggles notifyApproval flag and prints proper feedback', async () => {
  const home = await tmpHome('approval');
  try {
    await seed(home, { topic: 't' });
    const off = await runCli(home, 'approval', 'off');
    assert.equal(off.status, 0, `unexpected exit, stderr=${off.stderr}`);
    assert.equal((await readConfig(home)).notifyApproval, false);
    assert.match(off.stdout, /disabled/);
    const on = await runCli(home, 'approval', 'on');
    assert.equal(on.status, 0, `unexpected exit, stderr=${on.stderr}`);
    assert.equal((await readConfig(home)).notifyApproval, true);
    assert.match(on.stdout, /enabled/);
    const bad = await runCli(home, 'approval', 'maybe');
    assert.equal(bad.status, 2);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test('cli turnend on|off toggles notifyTurnEnd flag and prints proper feedback', async () => {
  const home = await tmpHome('turnend');
  try {
    await seed(home, { topic: 't' });
    const off = await runCli(home, 'turnend', 'off');
    assert.equal(off.status, 0, `unexpected exit, stderr=${off.stderr}`);
    assert.equal((await readConfig(home)).notifyTurnEnd, false);
    assert.match(off.stdout, /disabled/);
    const on = await runCli(home, 'turnend', 'on');
    assert.equal(on.status, 0, `unexpected exit, stderr=${on.stderr}`);
    assert.equal((await readConfig(home)).notifyTurnEnd, true);
    assert.match(on.stdout, /enabled/);
    const bad = await runCli(home, 'turnend', 'maybe');
    assert.equal(bad.status, 2);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test('cli turnend aliases (turn-end, turns) map to the same handler', async () => {
  const home = await tmpHome('turnend-alias');
  try {
    await seed(home, { topic: 't' });
    const a = await runCli(home, 'turn-end', 'off');
    assert.equal(a.status, 0, `stderr=${a.stderr}`);
    assert.equal((await readConfig(home)).notifyTurnEnd, false);
    const b = await runCli(home, 'turns', 'on');
    assert.equal(b.status, 0, `stderr=${b.stderr}`);
    assert.equal((await readConfig(home)).notifyTurnEnd, true);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test('cli priority accepts the five ntfy names and aliases; rejects others', async () => {
  const home = await tmpHome('pri');
  try {
    await seed(home, { topic: 't' });
    for (const name of ['min', 'low', 'default', 'high', 'urgent']) {
      const r = await runCli(home, 'priority', name);
      assert.equal(r.status, 0, `unexpected exit for ${name}, stderr=${r.stderr}`);
      assert.equal((await readConfig(home)).priority, name);
    }
    // Aliases resolve and are stored normalized to the canonical key.
    const silent = await runCli(home, 'priority', 'silent');
    assert.equal(silent.status, 0);
    assert.equal((await readConfig(home)).priority, 'silent');
    const normal = await runCli(home, 'priority', 'normal');
    assert.equal(normal.status, 0);
    assert.equal((await readConfig(home)).priority, 'normal');
    const critical = await runCli(home, 'priority', 'critical');
    assert.equal(critical.status, 0);
    assert.equal((await readConfig(home)).priority, 'critical');
    const upper = await runCli(home, 'priority', 'HIGH');
    assert.equal(upper.status, 0);
    assert.equal((await readConfig(home)).priority, 'high');
    const bad = await runCli(home, 'priority', 'loud');
    assert.equal(bad.status, 2);
    assert.match(bad.stderr, /priority/i);
    const none = await runCli(home, 'priority');
    assert.equal(none.status, 2);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test('cli priority reset removes the priority override', async () => {
  const home = await tmpHome('pri-reset');
  try {
    await seed(home, { topic: 't', priority: 'high' });
    const r = await runCli(home, 'priority', 'reset');
    assert.equal(r.status, 0, `unexpected exit, stderr=${r.stderr}`);
    const cfg = await readConfig(home);
    assert.equal(cfg.priority, undefined);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test('cli test posts to the configured server', async () => {
  const mock = await start();
  const home = await tmpHome('test-ok');
  try {
    await seed(home, { topic: 'hello', server: mock.url });
    const before = mock.records.length;
    const r = await runCli(home, 'test');
    assert.equal(r.status, 0, `unexpected exit, stderr=${r.stderr}`);
    assert.equal(mock.records.length, before + 1);
  } finally {
    await mock.close().catch(() => {});
    await rm(home, { recursive: true, force: true });
  }
});

test('cli test posts with Authorization header when token is configured', async () => {
  const mock = await start();
  const home = await tmpHome('test-token');
  try {
    await seed(home, { topic: 'hello', server: mock.url, token: 'tk_secret' });
    const r = await runCli(home, 'test');
    assert.equal(r.status, 0, `unexpected exit, stderr=${r.stderr}`);
    assert.equal(mock.records[0].headers.authorization, 'Bearer tk_secret');
  } finally {
    await mock.close().catch(() => {});
    await rm(home, { recursive: true, force: true });
  }
});

test('cli path prints the config path', async () => {
  const home = await tmpHome('path');
  try {
    const r = await runCli(home, 'path');
    assert.equal(r.status, 0, `unexpected exit, stderr=${r.stderr}`);
    assert.ok(
      r.stdout.includes(configPath(home)),
      `stdout did not contain ${configPath(home)}: ${r.stdout}`,
    );
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test('cli version prints "kimi-ntfy <semver>" with the package.json version', async () => {
  const home = await tmpHome('version');
  try {
    // Read the version out of the real package.json so this test is
    // robust against future bumps.
    const { readFile: rf } = await import('node:fs/promises');
    const pkg = JSON.parse(await rf(join(HERE, '..', 'package.json'), 'utf8'));
    for (const flag of ['version', '--version', '-v']) {
      const r = await runCli(home, flag);
      assert.equal(r.status, 0, `flag=${flag} exit=${r.status}, stderr=${r.stderr}`);
      assert.equal(r.stdout.trim(), `kimi-ntfy ${pkg.version}`, `flag=${flag} got ${r.stdout}`);
    }
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test('cli status prints the current config', async () => {
  const home = await tmpHome('status');
  try {
    await seed(home, {
      topic: 'showme',
      server: 'https://ntfy.example.com',
      language: 'en',
      notifySubagent: false,
    });
    const r = await runCli(home, 'status');
    assert.equal(r.status, 0, `unexpected exit, stderr=${r.stderr}`);
    assert.match(r.stdout, /showme/);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});
