#!/usr/bin/env node
// Validates kimi.plugin.json. Path comes from process.argv[2] (defaults to
// ./kimi.plugin.json, resolved relative to cwd).
//
// Prints `OK: <path>` and exits 0 on success; otherwise prints each error
// to stderr and exits 1. Designed to be invoked by `npm run check`.

import { readFile, stat } from 'node:fs/promises';
import { isAbsolute, resolve } from 'node:path';

const ALLOWED_EVENTS = new Set(['Stop', 'StopFailure', 'SessionEnd', 'SubagentStop']);

async function fileExists(path) {
  try {
    const s = await stat(path);
    return s.isFile();
  } catch {
    return false;
  }
}

async function main() {
  const manifestPath = process.argv[2] || './kimi.plugin.json';
  const errors = [];

  let manifest;
  try {
    manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  } catch (err) {
    errors.push(`cannot parse ${manifestPath}: ${err.message}`);
  }

  if (manifest && typeof manifest === 'object') {
    for (const key of ['name', 'version', 'interface', 'commands', 'hooks']) {
      if (!(key in manifest)) errors.push(`missing top-level key "${key}"`);
    }

    if (manifest.interface && typeof manifest.interface === 'object') {
      const iface = manifest.interface;
      for (const k of ['displayName', 'shortDescription', 'longDescription']) {
        if (!iface[k]) errors.push(`interface.${k} must be a non-empty string`);
      }
    }

    if ('commands' in manifest) {
      if (!Array.isArray(manifest.commands)) {
        errors.push('commands must be an array');
      } else {
        const cwd = process.cwd();
        let i = 0;
        for (const cmd of manifest.commands) {
          if (typeof cmd !== 'string') {
            errors.push(`commands[${i}] must be a string`);
          } else {
            const target = isAbsolute(cmd) ? cmd : resolve(cwd, cmd);
            if (!(await fileExists(target))) {
              errors.push(`commands[${i}] "${cmd}" does not exist on disk`);
            } else if (!target.endsWith('.md')) {
              errors.push(`commands[${i}] "${cmd}" must end in .md`);
            }
          }
          i++;
        }
      }
    }

    if ('hooks' in manifest) {
      if (!Array.isArray(manifest.hooks)) {
        errors.push('hooks must be an array');
      } else {
        let i = 0;
        for (const hook of manifest.hooks) {
          if (!hook || typeof hook !== 'object') {
            errors.push(`hooks[${i}] must be an object`);
          } else {
            if (!ALLOWED_EVENTS.has(hook.event)) {
              errors.push(
                `hooks[${i}].event "${hook.event}" not in [Stop, StopFailure, SessionEnd, SubagentStop]`,
              );
            }
            if (typeof hook.command !== 'string' || hook.command.length === 0) {
              errors.push(`hooks[${i}].command must be a non-empty string`);
            }
            if (
              typeof hook.timeout !== 'number' ||
              !(hook.timeout > 0) ||
              !Number.isFinite(hook.timeout)
            ) {
              errors.push(`hooks[${i}].timeout must be a positive number`);
            }
          }
          i++;
        }
      }
    }
  }

  if (errors.length === 0) {
    console.log(`OK: ${manifestPath}`);
    process.exit(0);
  }

  console.error(`${manifestPath}: ${errors.length} error(s):`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

await main();
