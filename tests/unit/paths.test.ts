import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const existsSyncMock = vi.fn();
const execFileSyncMock = vi.fn();

vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs');
  return {
    ...actual,
    existsSync: (...args: unknown[]) => existsSyncMock(...args),
  };
});

vi.mock('node:fs', async () => {
  const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
  return {
    ...actual,
    existsSync: (...args: unknown[]) => existsSyncMock(...args),
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

  it('prefers native Hermes on Windows when preferredMode is native and native path exists', async () => {
    const { getHermesInstallStatus } = await import('@electron/utils/paths');
    const status = getHermesInstallStatus({
      windowsHermesPreferredMode: 'native',
      windowsHermesNativePath: 'C:\\Hermes\\.hermes',
      installedKinds: ['hermes'],
    });

    expect(status).toEqual(expect.objectContaining({
      installed: true,
      installMode: 'native',
      installPath: 'C:\\Hermes\\.hermes',
      endpoint: 'http://127.0.0.1:8642',
      error: undefined,
    }));
    expect(execFileSyncMock).not.toHaveBeenCalled();
  });

  it('falls back to native Hermes on Windows when WSL is preferred but not configured', async () => {
    const { getHermesInstallStatus } = await import('@electron/utils/paths');
    const status = getHermesInstallStatus({
      windowsHermesPreferredMode: 'wsl2',
      windowsHermesNativePath: 'C:\\Hermes\\.hermes',
      installedKinds: ['hermes'],
    });

    expect(status).toEqual(expect.objectContaining({
      installed: true,
      installMode: 'native',
      installPath: 'C:\\Hermes\\.hermes',
      endpoint: 'http://127.0.0.1:8642',
    }));
  });
});
