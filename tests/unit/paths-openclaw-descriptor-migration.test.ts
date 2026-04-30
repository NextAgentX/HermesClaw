/**
 * Verifies that paths.ts auto-migrates a legacy v1 OpenClaw runtime
 * descriptor (which may point at the obsolete `dist/gateway.js` entrypoint)
 * to the current v2 shape (`dist/entry.js`) on read.
 *
 * Why this matters: a stale on-disk runtime.json from an older release was
 * causing Hermes/OpenClaw gateway startup failures with
 * `Error: Cannot find module 'dist/gateway.js'`. The migrate-on-read path
 * self-heals such installs without requiring users to manually delete
 * runtime.json or reinstall.
 *
 * Test isolation: This file does NOT mock `@electron/utils/paths` (so the
 * real migration code runs); it mocks only `fs` and `electron` so the
 * filesystem is virtual and writes are observable.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { join } from 'node:path';

// In vitest's jsdom env, paths.ts's getElectronApp() does NOT see the mocked
// electron module because it short-circuits to a node fallback when
// process.versions.electron is undefined. That fallback honours
// HERMESCLAW_USER_DATA_DIR. Setting it here pins the root to the same value
// our virtual-fs seeds expect, so the migration code reads/writes paths the
// mocks can observe.
process.env.HERMESCLAW_USER_DATA_DIR = '/tmp/hermesclaw-test';

const existsSyncMock = vi.fn();
const readFileSyncMock = vi.fn();
const writeFileSyncMock = vi.fn();
const mkdirSyncMock = vi.fn();
const realpathSyncMock = vi.fn((p: string) => p);

vi.mock('fs', () => ({
  default: {
    existsSync: (...args: unknown[]) => existsSyncMock(...args),
    readFileSync: (...args: unknown[]) => readFileSyncMock(...args),
    writeFileSync: (...args: unknown[]) => writeFileSyncMock(...args),
    mkdirSync: (...args: unknown[]) => mkdirSyncMock(...args),
    realpathSync: (...args: unknown[]) => realpathSyncMock(...args as [string]),
  },
  existsSync: (...args: unknown[]) => existsSyncMock(...args),
  readFileSync: (...args: unknown[]) => readFileSyncMock(...args),
  writeFileSync: (...args: unknown[]) => writeFileSyncMock(...args),
  mkdirSync: (...args: unknown[]) => mkdirSyncMock(...args),
  realpathSync: (...args: unknown[]) => realpathSyncMock(...args as [string]),
}));

// paths.ts joins HERMESCLAW_USER_DATA_DIR with 'HermesClaw' for the root.
// Use path.join so separators match the host platform (paths.ts uses path.join
// internally; on Windows that produces backslashes which must match our seeds).
const HERMESCLAW_ROOT = join('/tmp/hermesclaw-test', 'HermesClaw');
const ACTIVE_RUNTIMES_PATH = join(HERMESCLAW_ROOT, 'runtime-state', 'active-runtimes.json');
const ACTIVE_OPENCLAW_RUNTIME_DIR = join(HERMESCLAW_ROOT, 'runtimes', 'user', 'openclaw', 'local');
const ACTIVE_OPENCLAW_DESCRIPTOR_PATH = join(ACTIVE_OPENCLAW_RUNTIME_DIR, 'runtime.json');
const EXPECTED_OPENCLAW_ENTRY_PATH = join(ACTIVE_OPENCLAW_RUNTIME_DIR, 'dist/entry.js');

const files = new Map<string, unknown>();

function seed(path: string, value: unknown): void {
  files.set(path, value);
}

function readWritten(path: string): unknown {
  const captured = writeFileSyncMock.mock.calls
    .filter((call) => call[0] === path)
    .pop();
  if (!captured) return undefined;
  return JSON.parse(captured[1] as string);
}

beforeEach(() => {
  files.clear();
  existsSyncMock.mockReset();
  readFileSyncMock.mockReset();
  writeFileSyncMock.mockReset();
  mkdirSyncMock.mockReset();

  existsSyncMock.mockImplementation((path: string) => files.has(path));
  readFileSyncMock.mockImplementation((path: string) => {
    if (!files.has(path)) {
      throw new Error(`ENOENT (test): ${path}`);
    }
    const value = files.get(path);
    return typeof value === 'string' ? value : JSON.stringify(value);
  });
  writeFileSyncMock.mockImplementation((path: string, contents: string) => {
    try {
      files.set(path, JSON.parse(contents));
    } catch {
      files.set(path, contents);
    }
  });
});

afterEach(() => {
  vi.resetModules();
});

describe('paths.ts OpenClaw runtime descriptor migration', () => {
  it('migrates a v1 descriptor pointing at dist/gateway.js to v2 dist/entry.js on read', async () => {
    // Active runtimes record points at our test runtime dir.
    seed(ACTIVE_RUNTIMES_PATH, {
      runtimes: {
        openclaw: {
          runtime: 'openclaw',
          channel: 'stable',
          version: 'local',
          runtimeDir: ACTIVE_OPENCLAW_RUNTIME_DIR,
          status: 'ready',
        },
      },
    });
    // readActiveOpenClawRuntimeRecord requires existsSync(runtimeDir) to be
    // true; mark the directory as present so the lookup does not short-circuit
    // to the bundled fallback.
    seed(ACTIVE_OPENCLAW_RUNTIME_DIR, '<dir>');

    // Legacy v1 descriptor with the obsolete entrypoint that caused the bug.
    seed(ACTIVE_OPENCLAW_DESCRIPTOR_PATH, {
      schemaVersion: 1,
      version: 'local',
      entry: {
        type: 'node',
        command: 'node',
        args: ['dist/gateway.js'],
      },
      health: {
        url: 'http://127.0.0.1:18789/health',
      },
    });

    const { getOpenClawRuntimeEntryPath } = await import('../../electron/utils/paths');

    const entryPath = getOpenClawRuntimeEntryPath();

    // The launcher must now see the corrected entrypoint.
    expect(entryPath).toBe(EXPECTED_OPENCLAW_ENTRY_PATH);

    // The on-disk descriptor must have been rewritten to the v2 shape, so
    // future cold starts read clean state.
    const rewritten = readWritten(ACTIVE_OPENCLAW_DESCRIPTOR_PATH) as {
      schemaVersion: number;
      version: string;
      entry: { type: string; command: string; args: string[] };
      health: { url: string };
    };
    expect(rewritten).toBeDefined();
    expect(rewritten.schemaVersion).toBe(2);
    expect(rewritten.version).toBe('local');
    expect(rewritten.entry.type).toBe('node');
    expect(rewritten.entry.command).toBe('node');
    expect(rewritten.entry.args).toEqual(['dist/entry.js']);
    expect(rewritten.health.url).toBe('http://127.0.0.1:18789/health');
  });

  it('leaves a current v2 descriptor untouched on read', async () => {
    seed(ACTIVE_RUNTIMES_PATH, {
      runtimes: {
        openclaw: {
          runtime: 'openclaw',
          channel: 'stable',
          version: '2026.4.27',
          runtimeDir: ACTIVE_OPENCLAW_RUNTIME_DIR,
          status: 'ready',
        },
      },
    });
    seed(ACTIVE_OPENCLAW_RUNTIME_DIR, '<dir>');

    seed(ACTIVE_OPENCLAW_DESCRIPTOR_PATH, {
      schemaVersion: 2,
      version: '2026.4.27',
      entry: {
        type: 'node',
        command: 'node',
        args: ['dist/entry.js'],
      },
      health: {
        url: 'http://127.0.0.1:18789/health',
      },
    });

    const { getOpenClawRuntimeEntryPath } = await import('../../electron/utils/paths');

    const entryPath = getOpenClawRuntimeEntryPath();
    expect(entryPath).toBe(EXPECTED_OPENCLAW_ENTRY_PATH);

    // No rewrite of an already-current descriptor.
    const writes = writeFileSyncMock.mock.calls.filter(
      (call) => call[0] === ACTIVE_OPENCLAW_DESCRIPTOR_PATH,
    );
    expect(writes).toHaveLength(0);
  });
});

describe('paths.ts active-runtimes Hermes path heal', () => {
  it('rewrites a mis-pointed hermes.runtimeDir from \\openclaw\\ to \\hermes\\ and clears rollback-required', async () => {
    const misPointedHermesDir = join(HERMESCLAW_ROOT, 'runtimes', 'user', 'openclaw', 'local');
    const expectedHealedDir = join(HERMESCLAW_ROOT, 'runtimes', 'user', 'hermes', 'local');

    seed(ACTIVE_RUNTIMES_PATH, {
      runtimes: {
        openclaw: {
          runtime: 'openclaw',
          channel: 'stable',
          version: 'local',
          runtimeDir: ACTIVE_OPENCLAW_RUNTIME_DIR,
          status: 'ready',
        },
        hermes: {
          runtime: 'hermes',
          channel: 'stable',
          version: 'local',
          runtimeDir: misPointedHermesDir,
          status: 'rollback-required',
          lastError: "Cannot find module 'dist/gateway.js'",
        },
      },
    });

    const { healActiveHermesRuntimePathIfMisPointed } = await import('../../electron/utils/paths');

    healActiveHermesRuntimePathIfMisPointed();

    const rewritten = readWritten(ACTIVE_RUNTIMES_PATH) as {
      runtimes: {
        hermes: { runtimeDir: string; status: string; lastError?: string };
      };
    };
    expect(rewritten.runtimes.hermes.runtimeDir).toBe(expectedHealedDir);
    expect(rewritten.runtimes.hermes.status).toBe('ready');
    expect(rewritten.runtimes.hermes.lastError).toBeUndefined();
  });

  it('is a no-op when hermes.runtimeDir is already correct', async () => {
    const correctHermesDir = join(HERMESCLAW_ROOT, 'runtimes', 'user', 'hermes', 'local');

    seed(ACTIVE_RUNTIMES_PATH, {
      runtimes: {
        hermes: {
          runtime: 'hermes',
          channel: 'stable',
          version: 'local',
          runtimeDir: correctHermesDir,
          status: 'ready',
        },
      },
    });

    const { healActiveHermesRuntimePathIfMisPointed } = await import('../../electron/utils/paths');

    healActiveHermesRuntimePathIfMisPointed();

    const writes = writeFileSyncMock.mock.calls.filter(
      (call) => call[0] === ACTIVE_RUNTIMES_PATH,
    );
    expect(writes).toHaveLength(0);
  });
});
