import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const existsSyncMock = vi.fn();
const readFileSyncMock = vi.fn();
const execFileSyncMock = vi.fn();

vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs');
  return {
    ...actual,
    existsSync: (...args: unknown[]) => existsSyncMock(...args),
    readFileSync: (...args: unknown[]) => readFileSyncMock(...args),
  };
});

vi.mock('node:fs', async () => {
  const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
  return {
    ...actual,
    existsSync: (...args: unknown[]) => existsSyncMock(...args),
    readFileSync: (...args: unknown[]) => readFileSyncMock(...args),
  };
});

vi.mock('child_process', async () => {
  const actual = await vi.importActual<typeof import('child_process')>('child_process');
  return {
    ...actual,
    execFileSync: (...args: unknown[]) => execFileSyncMock(...args),
  };
});

describe('getHermesInstallStatus', () => {
  const originalPlatform = process.platform;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    readFileSyncMock.mockImplementation((...args: unknown[]) => {
      throw new Error(`Unexpected readFileSync call: ${String(args[0])}`);
    });
    Object.defineProperty(process, 'platform', {
      value: 'win32',
      configurable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(process, 'platform', {
      value: originalPlatform,
      configurable: true,
    });
  });

  it('reports Hermes as unavailable on Windows when preferredMode is native and no install is reachable', async () => {
    vi.spyOn(process, 'cwd').mockReturnValue('Z:\\missing-hermes-app');
    existsSyncMock.mockReturnValue(false);
    const { getHermesInstallStatus } = await import('@electron/utils/paths');
    const status = getHermesInstallStatus({
      windowsHermesPreferredMode: 'native',
      windowsHermesNativePath: 'C:\\Hermes\\.hermes',
      installedKinds: ['hermes'],
    });

    expect(status).toEqual(expect.objectContaining({
      installed: false,
      installMode: 'native',
      installPath: undefined,
      endpoint: 'http://127.0.0.1:8642',
      error: 'Hermes native home directory was not found at C:\\Hermes\\.hermes | Hermes on Windows requires a configured WSL2 distro',
    }));
    expect(execFileSyncMock).not.toHaveBeenCalled();
  });

  it('reports WSL as the primary failure mode when WSL is preferred and no install is reachable', async () => {
    vi.spyOn(process, 'cwd').mockReturnValue('Z:\\missing-hermes-app');
    existsSyncMock.mockReturnValue(false);
    const { getHermesInstallStatus } = await import('@electron/utils/paths');
    const status = getHermesInstallStatus({
      windowsHermesPreferredMode: 'wsl2',
      windowsHermesNativePath: 'C:\\Hermes\\.hermes',
      installedKinds: ['hermes'],
    });

    expect(status).toEqual(expect.objectContaining({
      installed: false,
      installMode: 'wsl2',
      endpoint: 'http://127.0.0.1:8642',
      error: 'Hermes on Windows requires a configured WSL2 distro | Hermes native home directory was not found at C:\\Hermes\\.hermes',
    }));
  });

  it('falls back to the bundled HermesAgent runtime when no native install is reachable', async () => {
    vi.spyOn(process, 'cwd').mockReturnValue('D:\\_04_OpenCode\\HermesClaw-Main');
    existsSyncMock.mockImplementation((path: unknown) =>
      path === 'D:\\_04_OpenCode\\HermesClaw-Main\\build\\hermes-agent'
      || path === 'D:\\_04_OpenCode\\HermesClaw-Main\\build\\hermes-agent\\manifest.json'
      || path === 'D:\\_04_OpenCode\\HermesClaw-Main\\build\\hermes-agent\\.venv\\Scripts\\python.exe',
    );
    readFileSyncMock.mockImplementation((filePath: unknown) => {
      if (filePath === 'D:\\_04_OpenCode\\HermesClaw-Main\\build\\hermes-agent\\manifest.json') {
        return JSON.stringify({ version: '0.11.0' });
      }
      throw new Error(`Unexpected readFileSync call: ${String(filePath)}`);
    });

    const { getHermesInstallStatus } = await import('@electron/utils/paths');
    const status = getHermesInstallStatus({
      windowsHermesPreferredMode: 'native',
      windowsHermesNativePath: 'C:\\Hermes\\.hermes',
      installedKinds: ['hermes'],
    });

    expect(status).toMatchObject({
      installed: true,
      installMode: 'native',
      installPath: 'D:\\_04_OpenCode\\HermesClaw-Main\\build\\hermes-agent',
      endpoint: 'http://127.0.0.1:8642',
      version: '0.11.0',
    });
  });
});
