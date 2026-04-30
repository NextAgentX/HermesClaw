import { beforeEach, describe, expect, it, vi } from 'vitest';

const getAllSettingsMock = vi.fn();
const getHermesInstallStatusMock = vi.fn();
const getOpenClawStatusMock = vi.fn();
const hermesManagerCheckHealthMock = vi.fn();
const hermesBridgeRecheckMock = vi.fn();

vi.mock('@electron/utils/store', () => ({
  getAllSettings: (...args: unknown[]) => getAllSettingsMock(...args),
}));

vi.mock('@electron/utils/paths', async () => {
  const actual = await vi.importActual<typeof import('@electron/utils/paths')>('@electron/utils/paths');
  return {
    ...actual,
    getHermesInstallStatus: (...args: unknown[]) => getHermesInstallStatusMock(...args),
    getOpenClawStatus: (...args: unknown[]) => getOpenClawStatusMock(...args),
  };
});

vi.mock('@electron/runtime/services/hermes-standalone-manager', () => ({
  getHermesStandaloneManager: () => ({
    start: vi.fn(),
    stop: vi.fn(),
    restart: vi.fn(),
    reload: vi.fn(),
    debouncedRestart: vi.fn(),
    debouncedReload: vi.fn(),
    checkHealth: (...args: unknown[]) => hermesManagerCheckHealthMock(...args),
    rpc: vi.fn(),
    forceTerminateOwnedProcessForQuit: vi.fn(),
  }),
}));

vi.mock('@electron/runtime/services/hermes-openclaw-bridge-service', () => {
  class HermesOpenClawBridge {
    recheck(...args: unknown[]) {
      return hermesBridgeRecheckMock(...args);
    }
  }

  return { HermesOpenClawBridge };
});

describe('runtime status service', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    hermesBridgeRecheckMock.mockResolvedValue({
      enabled: true,
      attached: true,
      hermesInstalled: true,
      hermesHealthy: true,
      openclawRecognized: true,
      reasonCode: undefined,
      lastSyncAt: 321,
      error: undefined,
    });
    hermesManagerCheckHealthMock.mockResolvedValue({ ok: true, uptime: 42 });
    getHermesInstallStatusMock.mockReturnValue({
      installed: true,
      installMode: 'native',
      installPath: '/home/test/.hermes',
      endpoint: 'http://127.0.0.1:8642',
    });
    getOpenClawStatusMock.mockReturnValue({
      packageExists: true,
      isBuilt: true,
      entryPath: '/tmp/openclaw/openclaw.mjs',
      dir: '/tmp/openclaw',
      version: '2026.4.15',
    });
  });

  it('builds a both-mode snapshot with openclaw primary and hermes bridge metadata', async () => {
    getAllSettingsMock.mockResolvedValue({
      runtime: {
        installChoice: 'both',
        mode: 'hermesclaw-both',
        installedKinds: ['openclaw', 'hermes'],
        lastStandaloneRuntime: 'openclaw',
      },
      bridge: {
        hermesAsOpenClawAgent: {
          enabled: true,
          attached: true,
          hermesInstalled: true,
        hermesHealthy: true,
        openclawRecognized: true,
        reasonCode: undefined,
        lastSyncAt: 123,
      },
    },
    });

    const { getRuntimeFoundationSnapshot } = await import('@electron/runtime/services/runtime-status-service');
    const snapshot = await getRuntimeFoundationSnapshot({
      getStatus: () => ({
        state: 'running',
        port: 18789,
        version: '2026.4.15',
        gatewayReady: true,
      }),
    } as never);

    expect(snapshot.runtime.installChoice).toBe('both');
    expect(snapshot.runtime.mode).toBe('hermesclaw-both');
    expect(snapshot.bridge).toEqual(expect.objectContaining({
      enabled: true,
      attached: true,
      hermesInstalled: true,
      openclawRecognized: true,
      reasonCode: undefined,
      lastSyncAt: 321,
    }));
    expect(hermesBridgeRecheckMock).toHaveBeenCalledOnce();
    expect(snapshot.runtimes).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'openclaw',
        installed: true,
        running: true,
        healthy: true,
        endpoint: 'http://127.0.0.1:18789',
      }),
      expect.objectContaining({
        kind: 'hermes',
        installed: true,
        running: true,
        healthy: true,
        endpoint: expect.stringContaining('.hermes'),
      }),
    ]));
  });

  it('reports hermes standalone mode from install metadata', async () => {
    getAllSettingsMock.mockResolvedValue({
      runtime: {
        installChoice: 'hermes',
        mode: 'hermes',
        installedKinds: ['hermes'],
        windowsHermesPreferredMode: 'native',
        windowsHermesNativePath: 'C:\\Hermes\\.hermes',
        windowsHermesWslDistro: 'Ubuntu',
        lastStandaloneRuntime: 'hermes',
      },
      bridge: {
        hermesAsOpenClawAgent: {
          enabled: false,
          attached: false,
          hermesInstalled: true,
          hermesHealthy: false,
          openclawRecognized: false,
          reasonCode: 'bridge_disabled',
        },
      },
    });

    const { getRuntimeFoundationSnapshot } = await import('@electron/runtime/services/runtime-status-service');
    const snapshot = await getRuntimeFoundationSnapshot({
      getStatus: () => ({ state: 'stopped', port: 18789, gatewayReady: false }),
    } as never);

    expect(snapshot.runtime).toEqual(expect.objectContaining({
      windowsHermesPreferredMode: 'native',
      windowsHermesNativePath: 'C:\\Hermes\\.hermes',
      windowsHermesWslDistro: 'Ubuntu',
    }));
    expect(getHermesInstallStatusMock).toHaveBeenCalledWith(expect.objectContaining({
      windowsHermesPreferredMode: 'native',
      windowsHermesNativePath: 'C:\\Hermes\\.hermes',
      windowsHermesWslDistro: 'Ubuntu',
      installedKinds: ['hermes'],
    }));

    const hermes = snapshot.runtimes.find((runtime) => runtime.kind === 'hermes');
    expect(hermes).toEqual(expect.objectContaining({
      installed: true,
      running: true,
      healthy: true,
      endpoint: 'http://127.0.0.1:8642',
      error: undefined,
    }));
  });

  it('does not report hermes standalone mode as installed when install metadata is missing', async () => {
    getHermesInstallStatusMock.mockReturnValue({
      installed: false,
      installMode: 'native',
      endpoint: 'http://127.0.0.1:8642',
      error: 'Hermes native home directory was not found at /home/test/.hermes',
    });
    getAllSettingsMock.mockResolvedValue({
      runtime: {
        installChoice: 'hermes',
        mode: 'hermes',
        installedKinds: ['hermes'],
        lastStandaloneRuntime: 'hermes',
      },
      bridge: {
        hermesAsOpenClawAgent: {
          enabled: false,
          attached: false,
          hermesInstalled: false,
          hermesHealthy: false,
          openclawRecognized: false,
          reasonCode: 'bridge_disabled',
        },
      },
    });

    const { getRuntimeFoundationSnapshot } = await import('@electron/runtime/services/runtime-status-service');
    const snapshot = await getRuntimeFoundationSnapshot({
      getStatus: () => ({ state: 'stopped', port: 18789, gatewayReady: false }),
    } as never);

    const hermes = snapshot.runtimes.find((runtime) => runtime.kind === 'hermes');
    expect(hermes).toEqual(expect.objectContaining({
      installed: false,
      running: false,
      healthy: false,
      endpoint: 'http://127.0.0.1:8642',
      error: 'Hermes native home directory was not found at /home/test/.hermes',
    }));
  });

  it('uses Hermes manager health when building hermes standalone runtime status', async () => {
    hermesManagerCheckHealthMock.mockResolvedValue({ ok: false, error: 'Hermes endpoint is unreachable' });
    getAllSettingsMock.mockResolvedValue({
      runtime: {
        installChoice: 'hermes',
        mode: 'hermes',
        installedKinds: ['hermes'],
        lastStandaloneRuntime: 'hermes',
      },
      bridge: {
        hermesAsOpenClawAgent: {
          enabled: false,
          attached: false,
          hermesInstalled: true,
          hermesHealthy: false,
          openclawRecognized: false,
          reasonCode: 'bridge_disabled',
        },
      },
    });

    const { getRuntimeFoundationSnapshot } = await import('@electron/runtime/services/runtime-status-service');
    const snapshot = await getRuntimeFoundationSnapshot({
      getStatus: () => ({ state: 'stopped', port: 18789, gatewayReady: false }),
    } as never);

    const hermes = snapshot.runtimes.find((runtime) => runtime.kind === 'hermes');
    expect(hermesManagerCheckHealthMock).toHaveBeenCalledOnce();
    expect(hermes).toEqual(expect.objectContaining({
      installed: true,
      running: false,
      healthy: false,
      endpoint: 'http://127.0.0.1:8642',
      error: 'Hermes endpoint is unreachable',
    }));
  });

  it('does not infer openclaw recognition from attached when persisted recognition is missing', async () => {
    hermesBridgeRecheckMock.mockResolvedValue({
      enabled: true,
      attached: true,
      hermesInstalled: true,
      hermesHealthy: false,
      openclawRecognized: false,
      reasonCode: 'openclaw_recognition_pending',
      lastSyncAt: 654,
      error: 'OpenClaw bridge reload/recognition is still pending',
    });

    getAllSettingsMock.mockResolvedValue({
      runtime: {
        installChoice: 'both',
        mode: 'openclaw-with-hermes-agent',
        installedKinds: ['openclaw', 'hermes'],
        lastStandaloneRuntime: 'openclaw',
      },
      bridge: {
        hermesAsOpenClawAgent: {
          enabled: true,
          attached: true,
          hermesInstalled: true,
          hermesHealthy: false,
          lastSyncAt: 456,
          reasonCode: 'openclaw_recognition_pending',
          lastError: 'OpenClaw bridge reload/recognition is still pending',
        },
      },
    });

    const { getRuntimeFoundationSnapshot } = await import('@electron/runtime/services/runtime-status-service');
    const snapshot = await getRuntimeFoundationSnapshot({
      getStatus: () => ({
        state: 'running',
        port: 18789,
        version: '2026.4.15',
        gatewayReady: false,
      }),
    } as never);

    expect(snapshot.bridge).toEqual(expect.objectContaining({
      enabled: true,
      attached: true,
      hermesInstalled: true,
      hermesHealthy: false,
      openclawRecognized: false,
      reasonCode: 'openclaw_recognition_pending',
      lastSyncAt: 654,
      error: 'OpenClaw bridge reload/recognition is still pending',
    }));
  });

  it('falls back to persisted bridge reasonCode when live recheck fails', async () => {
    hermesBridgeRecheckMock.mockRejectedValue(new Error('bridge recheck failed'));

    getAllSettingsMock.mockResolvedValue({
      runtime: {
        installChoice: 'both',
        mode: 'openclaw-with-hermes-agent',
        installedKinds: ['openclaw', 'hermes'],
        lastStandaloneRuntime: 'openclaw',
      },
      bridge: {
        hermesAsOpenClawAgent: {
          enabled: true,
          attached: true,
          hermesInstalled: true,
          hermesHealthy: false,
          openclawRecognized: true,
          reasonCode: 'hermes_home_unreachable',
          lastSyncAt: 789,
          lastError: 'Hermes home directory is not reachable',
        },
      },
    });

    const { getRuntimeFoundationSnapshot } = await import('@electron/runtime/services/runtime-status-service');
    const snapshot = await getRuntimeFoundationSnapshot({
      getStatus: () => ({
        state: 'running',
        port: 18789,
        version: '2026.4.15',
        gatewayReady: true,
      }),
    } as never);

    expect(snapshot.bridge).toEqual(expect.objectContaining({
      enabled: true,
      attached: true,
      hermesInstalled: true,
      hermesHealthy: false,
      openclawRecognized: true,
      reasonCode: 'hermes_home_unreachable',
      lastSyncAt: 789,
      error: 'Hermes home directory is not reachable',
    }));
  });

  it('clears stale bridge error when bridge is disabled while keeping bridge_disabled reasonCode', async () => {
    getAllSettingsMock.mockResolvedValue({
      runtime: {
        installChoice: 'openclaw',
        mode: 'openclaw',
        installedKinds: ['openclaw'],
        lastStandaloneRuntime: 'openclaw',
      },
      bridge: {
        hermesAsOpenClawAgent: {
          enabled: true,
          attached: true,
          hermesInstalled: true,
          hermesHealthy: false,
          openclawRecognized: false,
          reasonCode: 'openclaw_recognition_pending',
          lastSyncAt: 999,
          lastError: 'OpenClaw bridge reload/recognition is still pending',
        },
      },
    });

    const { getRuntimeFoundationSnapshot } = await import('@electron/runtime/services/runtime-status-service');
    const snapshot = await getRuntimeFoundationSnapshot({
      getStatus: () => ({ state: 'running', port: 18789, gatewayReady: true }),
    } as never);

    expect(snapshot.bridge).toEqual(expect.objectContaining({
      enabled: false,
      attached: false,
      hermesHealthy: false,
      openclawRecognized: false,
      reasonCode: 'bridge_disabled',
      lastSyncAt: 999,
      error: undefined,
    }));
    expect(hermesBridgeRecheckMock).not.toHaveBeenCalled();
  });
});
