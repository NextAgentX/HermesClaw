import { EventEmitter } from 'node:events';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getAllSettingsMock = vi.fn();
const getHermesInstallStatusMock = vi.fn();
const proxyAwareFetchMock = vi.fn();
const spawnMock = vi.fn();
const existsSyncMock = vi.fn();
const readFileSyncMock = vi.fn();

class MockHermesChild extends EventEmitter {
  readonly stdout = new EventEmitter();
  readonly stderr = new EventEmitter();
  readonly pid = 4321;
  readonly kill = vi.fn();
}

let spawnedChild: MockHermesChild;

vi.mock('node:child_process', () => ({
  default: { spawn: (...args: unknown[]) => spawnMock(...args) },
  spawn: (...args: unknown[]) => spawnMock(...args),
}));

vi.mock('node:fs', () => ({
  default: {
    existsSync: (...args: unknown[]) => existsSyncMock(...args),
    readFileSync: (...args: unknown[]) => readFileSyncMock(...args),
  },
  existsSync: (...args: unknown[]) => existsSyncMock(...args),
  readFileSync: (...args: unknown[]) => readFileSyncMock(...args),
}));

vi.mock('@electron/utils/store', () => ({
  getAllSettings: (...args: unknown[]) => getAllSettingsMock(...args),
}));

vi.mock('@electron/utils/paths', () => ({
  getHermesEndpoint: () => 'http://127.0.0.1:8642',
  getHermesInstallStatus: (...args: unknown[]) => getHermesInstallStatusMock(...args),
  getHermesClawRuntimeLayout: () => ({
    manifestPath: 'C:\\HermesClaw\\HermesClaw\\runtime-manifest.json',
  }),
}));

vi.mock('@electron/utils/proxy-fetch', () => ({
  proxyAwareFetch: (...args: unknown[]) => proxyAwareFetchMock(...args),
}));

describe('hermes standalone manager', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.resetModules();
    vi.useRealTimers();

    spawnedChild = new MockHermesChild();
    spawnMock.mockImplementation(() => {
      queueMicrotask(() => spawnedChild.emit('spawn'));
      return spawnedChild;
    });

    getAllSettingsMock.mockResolvedValue({
      runtime: {
        installChoice: 'hermes',
        mode: 'hermes',
        installedKinds: ['hermes'],
        lastStandaloneRuntime: 'hermes',
        windowsHermesPreferredMode: 'native',
        windowsHermesNativePath: 'C:\\Hermes\\.hermes',
        windowsHermesWslDistro: undefined,
      },
    });
    existsSyncMock.mockReturnValue(false);
  });

  it('fails fast with install-status error before probing health when Hermes is not configured', async () => {
    getHermesInstallStatusMock.mockReturnValue({
      installed: false,
      installMode: 'native',
      error: 'Native Hermes home not found',
    });

    const { getHermesStandaloneManager } = await import('@electron/runtime/services/hermes-standalone-manager');

    await expect(getHermesStandaloneManager().start()).rejects.toThrow('Native Hermes home not found');
    expect(proxyAwareFetchMock).not.toHaveBeenCalled();
    expect(spawnMock).not.toHaveBeenCalled();
  });

  it('probes the resolved Hermes endpoint when install metadata is available', async () => {
    getHermesInstallStatusMock.mockReturnValue({
      installed: true,
      installMode: 'native',
      endpoint: 'http://127.0.0.1:9642',
    });
    proxyAwareFetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, uptime: 42 }),
    });

    const { getHermesStandaloneManager } = await import('@electron/runtime/services/hermes-standalone-manager');
    const health = await getHermesStandaloneManager().checkHealth();

    expect(getHermesInstallStatusMock).toHaveBeenCalledWith({
      windowsHermesPreferredMode: 'native',
      windowsHermesNativePath: 'C:\\Hermes\\.hermes',
      windowsHermesWslDistro: undefined,
      installedKinds: ['hermes'],
    });
    expect(proxyAwareFetchMock).toHaveBeenCalledWith('http://127.0.0.1:9642/health', { method: 'GET' });
    expect(health).toEqual({ ok: true, uptime: 42, error: undefined, pid: undefined, state: 'stopped' });
  });

  it('starts an owned Hermes subprocess from the active HermesClaw runtime manifest', async () => {
    getHermesInstallStatusMock.mockReturnValue({
      installed: true,
      installMode: 'native',
      endpoint: 'http://127.0.0.1:9642',
      installPath: 'C:\\Hermes\\.hermes',
    });
    existsSyncMock.mockImplementation((path: unknown) =>
      path === 'C:\\HermesClaw\\HermesClaw\\runtime-manifest.json' ||
      path === 'C:\\HermesClaw\\HermesClaw\\runtimes\\user\\stable\\1.0.0\\runtime.json',
    );
    readFileSyncMock.mockImplementation((path: unknown) => {
      if (path === 'C:\\HermesClaw\\HermesClaw\\runtime-manifest.json') {
        return JSON.stringify({
          activeChannel: 'stable',
          channels: {
            stable: {
              version: '1.0.0',
              runtimeDir: 'C:\\HermesClaw\\HermesClaw\\runtimes\\user\\stable\\1.0.0',
            },
          },
        });
      }
      return JSON.stringify({
        entry: {
          command: 'python',
          args: ['-m', 'hermes.gateway.run', '--port', '{port}'],
        },
      });
    });

    const { getHermesStandaloneManager } = await import('@electron/runtime/services/hermes-standalone-manager');
    await expect(getHermesStandaloneManager().start()).resolves.toBeUndefined();
    expect(spawnMock).toHaveBeenCalledWith(
      'python',
      ['-m', 'hermes.gateway.run', '--port', '8642'],
      expect.objectContaining({
        cwd: 'C:\\HermesClaw\\HermesClaw\\runtimes\\user\\stable\\1.0.0',
        windowsHide: true,
        stdio: 'pipe',
        env: expect.objectContaining({
          HERMES_ENDPOINT: 'http://127.0.0.1:8642',
          HERMES_PORT: '8642',
        }),
      }),
    );
    expect(proxyAwareFetchMock).not.toHaveBeenCalled();
  });

  it('fails start when no runtime launch manifest can be resolved', async () => {
    getHermesInstallStatusMock.mockReturnValue({
      installed: true,
      installMode: 'native',
      endpoint: 'http://127.0.0.1:9642',
      installPath: 'C:\\Hermes\\.hermes',
    });

    const { getHermesStandaloneManager } = await import('@electron/runtime/services/hermes-standalone-manager');

    await expect(getHermesStandaloneManager().start()).rejects.toThrow(
      'Hermes runtime manifest entry was not found',
    );
    expect(spawnMock).not.toHaveBeenCalled();
  });

  it('starts Hermes from the bundled HermesAgent runtime manifest when package metadata is present', async () => {
    getHermesInstallStatusMock.mockReturnValue({
      installed: true,
      installMode: 'native',
      endpoint: 'http://127.0.0.1:8642',
      installPath: 'D:\\_04_OpenCode\\HermesClaw-Main\\build\\hermes-agent',
      version: '0.11.0',
    });
    existsSyncMock.mockImplementation((path: unknown) =>
      path === 'C:\\HermesClaw\\HermesClaw\\runtime-manifest.json'
      || path === 'D:\\_04_OpenCode\\HermesClaw-Main\\build\\hermes-agent\\manifest.json'
      || path === 'D:\\_04_OpenCode\\HermesClaw-Main\\build\\hermes-agent\\.venv\\Scripts\\python.exe',
    );
    readFileSyncMock.mockImplementation((path: unknown) => {
      if (path === 'C:\\HermesClaw\\HermesClaw\\runtime-manifest.json') {
        return JSON.stringify({
          activeChannel: 'stable',
          channels: {
            stable: {
              version: '0.11.0',
              runtimeDir: 'D:\\_04_OpenCode\\HermesClaw-Main\\build\\hermes-agent',
            },
          },
        });
      }

      return JSON.stringify({
        packageName: 'hermes-agent',
        version: '0.11.0',
      });
    });

    const { getHermesStandaloneManager } = await import('@electron/runtime/services/hermes-standalone-manager');
    await expect(getHermesStandaloneManager().start()).resolves.toBeUndefined();

    expect(spawnMock).toHaveBeenCalledWith(
      'D:\\_04_OpenCode\\HermesClaw-Main\\build\\hermes-agent\\.venv\\Scripts\\python.exe',
      ['-m', 'hermes.gateway.run', '--port', '8642'],
      expect.objectContaining({
        cwd: 'D:\\_04_OpenCode\\HermesClaw-Main\\build\\hermes-agent',
        windowsHide: true,
        stdio: 'pipe',
        env: expect.objectContaining({
          HERMES_ENDPOINT: 'http://127.0.0.1:8642',
          HERMES_PORT: '8642',
        }),
      }),
    );
  });

  it('stops an owned Hermes subprocess with SIGTERM', async () => {
    getHermesInstallStatusMock.mockReturnValue({
      installed: true,
      installMode: 'native',
      endpoint: 'http://127.0.0.1:9642',
      installPath: 'C:\\Hermes\\.hermes',
    });
    existsSyncMock.mockImplementation((path: unknown) => path === 'C:\\Hermes\\.hermes\\runtime.json');
    readFileSyncMock.mockReturnValue(JSON.stringify({ command: 'python', args: ['-m', 'hermes.gateway.run'] }));

    const { getHermesStandaloneManager } = await import('@electron/runtime/services/hermes-standalone-manager');
    const manager = getHermesStandaloneManager();
    await manager.start();
    const stopPromise = manager.stop();
    queueMicrotask(() => spawnedChild.emit('exit', 0, null));

    await expect(stopPromise).resolves.toBeUndefined();
    expect(spawnedChild.kill).toHaveBeenCalledWith('SIGTERM');
  });

  it('sends JSON-RPC requests to the resolved Hermes endpoint', async () => {
    getHermesInstallStatusMock.mockReturnValue({
      installed: true,
      installMode: 'native',
      endpoint: 'http://127.0.0.1:9642',
    });
    proxyAwareFetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ result: { answer: 42 } }),
    });

    const { getHermesStandaloneManager } = await import('@electron/runtime/services/hermes-standalone-manager');
    const result = await getHermesStandaloneManager().rpc('ping', { verbose: true });

    expect(proxyAwareFetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:9642/rpc',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: expect.stringContaining('"method":"ping"'),
      }),
    );
    expect(result).toEqual({ answer: 42 });
  });

  it('adds Hermes endpoint context when an explicit health probe throws a generic fetch error', async () => {
    getHermesInstallStatusMock.mockReturnValue({
      installed: true,
      installMode: 'native',
      endpoint: 'http://127.0.0.1:9642',
    });
    proxyAwareFetchMock.mockRejectedValue(new Error('fetch failed'));

    const { getHermesStandaloneManager } = await import('@electron/runtime/services/hermes-standalone-manager');

    await expect(getHermesStandaloneManager().checkHealth()).resolves.toEqual({
      ok: false,
      error: 'Failed to reach Hermes endpoint http://127.0.0.1:9642: fetch failed',
      pid: undefined,
      state: 'stopped',
    });
  });
});
