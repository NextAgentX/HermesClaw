import { beforeEach, describe, expect, it, vi } from 'vitest';

const getAllSettingsMock = vi.fn();
const setSettingMock = vi.fn();
const getRuntimeFoundationSnapshotMock = vi.fn();
const withConfigLockMock = vi.fn();
const readOpenClawConfigMock = vi.fn();
const writeOpenClawConfigMock = vi.fn();
const removePluginRegistrationMock = vi.fn();
const getHermesInstallStatusMock = vi.fn();

vi.mock('@electron/utils/store', () => ({
  getAllSettings: (...args: unknown[]) => getAllSettingsMock(...args),
  setSetting: (...args: unknown[]) => setSettingMock(...args),
}));

vi.mock('@electron/utils/config-mutex', () => ({
  withConfigLock: (fn: () => Promise<unknown>) => withConfigLockMock(fn),
}));

vi.mock('@electron/utils/channel-config', () => ({
  readOpenClawConfig: (...args: unknown[]) => readOpenClawConfigMock(...args),
  writeOpenClawConfig: (...args: unknown[]) => writeOpenClawConfigMock(...args),
  removePluginRegistration: (...args: unknown[]) => removePluginRegistrationMock(...args),
}));

vi.mock('@electron/runtime/services/runtime-status-service', () => ({
  getRuntimeFoundationSnapshot: (...args: unknown[]) => getRuntimeFoundationSnapshotMock(...args),
}));

vi.mock('@electron/utils/paths', () => ({
  getHermesInstallStatus: (...args: unknown[]) => getHermesInstallStatusMock(...args),
}));

describe('HermesOpenClawBridge', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    withConfigLockMock.mockImplementation(async (fn: () => Promise<unknown>) => fn());
    getHermesInstallStatusMock.mockReset();
    removePluginRegistrationMock.mockImplementation((config: Record<string, unknown>, pluginId: string) => {
      const plugins = config.plugins as { allow?: string[]; entries?: Record<string, unknown>; enabled?: boolean } | undefined;
      if (!plugins) return false;

      if (Array.isArray(plugins.allow)) {
        plugins.allow = plugins.allow.filter((entry) => entry !== pluginId);
        if (plugins.allow.length === 0) {
          delete plugins.allow;
        }
      }

      if (plugins.entries) {
        delete plugins.entries[pluginId];
        if (Object.keys(plugins.entries).length === 0) {
          delete plugins.entries;
        }
      }

      if (!plugins.allow && !plugins.entries) {
        delete config.plugins;
      }

      return true;
    });
  });

  it('attaches by persisting a reserved managed plugin entry and returning refreshed bridge truth', async () => {
    getAllSettingsMock.mockResolvedValue({
      runtime: {
        mode: 'hermesclaw-both',
        installedKinds: ['openclaw', 'hermes'],
      },
      bridge: {
        hermesAsOpenClawAgent: {
          enabled: false,
          attached: false,
          hermesInstalled: false,
          hermesHealthy: false,
          openclawRecognized: false,
          lastError: 'old-error',
        },
      },
    });
    readOpenClawConfigMock.mockResolvedValue({});
    getRuntimeFoundationSnapshotMock.mockResolvedValue({
      bridge: {
        enabled: true,
        attached: true,
        hermesInstalled: true,
        hermesHealthy: true,
        openclawRecognized: true,
        reasonCode: undefined,
      },
    });

    const { HermesOpenClawBridge } = await import('@electron/runtime/services/hermes-openclaw-bridge-service');
    const service = new HermesOpenClawBridge({
      getStatus: vi.fn().mockReturnValue({ state: 'running' }),
      reload: vi.fn().mockResolvedValue(undefined),
      checkHealth: vi.fn().mockResolvedValue({ ok: true, uptime: 10 }),
    } as never, undefined, undefined, undefined, undefined, undefined, undefined, vi.fn().mockResolvedValue({ ok: true }));

    await expect(service.attach()).resolves.toEqual(expect.objectContaining({
      enabled: true,
      attached: true,
      openclawRecognized: true,
      reasonCode: undefined,
    }));

    expect(writeOpenClawConfigMock).toHaveBeenCalledWith(expect.objectContaining({
      plugins: expect.objectContaining({
        allow: expect.arrayContaining(['hermesclaw-bridge']),
        entries: expect.objectContaining({
          'hermesclaw-bridge': expect.objectContaining({ enabled: true }),
        }),
      }),
    }));
    expect(setSettingMock).toHaveBeenCalledWith('bridge', expect.objectContaining({
      hermesAsOpenClawAgent: expect.objectContaining({
        enabled: true,
        attached: true,
        hermesInstalled: true,
        hermesHealthy: true,
        openclawRecognized: true,
        reasonCode: undefined,
        lastError: undefined,
        lastSyncAt: expect.any(Number),
      }),
    }));
  });

  it('persists detach state and reflects the current bridge truth after recheck', async () => {
    getAllSettingsMock.mockResolvedValue({
      runtime: {
        mode: 'openclaw-with-hermes-agent',
        installedKinds: ['openclaw', 'hermes'],
      },
      bridge: {
        hermesAsOpenClawAgent: {
          enabled: true,
          attached: true,
          hermesInstalled: true,
          hermesHealthy: true,
          openclawRecognized: true,
          lastError: 'bridge-warning',
        },
      },
    });
    readOpenClawConfigMock.mockResolvedValue({
      plugins: {
        allow: ['hermesclaw-bridge', 'hermesclaw-hermes-bridge'],
        entries: {
          'hermesclaw-bridge': { enabled: true },
          'hermesclaw-hermes-bridge': { enabled: true },
        },
      },
    });
    getRuntimeFoundationSnapshotMock.mockResolvedValue({
      bridge: {
        enabled: true,
        attached: false,
        hermesInstalled: true,
        hermesHealthy: false,
        openclawRecognized: false,
        reasonCode: 'bridge_config_missing',
        error: 'Hermes bridge config is not registered in OpenClaw',
      },
    });

    const { HermesOpenClawBridge } = await import('@electron/runtime/services/hermes-openclaw-bridge-service');
    const service = new HermesOpenClawBridge({
      getStatus: vi.fn().mockReturnValue({ state: 'running' }),
      reload: vi.fn().mockResolvedValue(undefined),
      checkHealth: vi.fn().mockResolvedValue({ ok: true, uptime: 10 }),
    } as never, undefined, undefined, undefined, undefined, undefined, undefined, vi.fn().mockResolvedValue({ ok: true }));

    await expect(service.detach()).resolves.toEqual(expect.objectContaining({
      attached: false,
      reasonCode: 'bridge_config_missing',
      error: 'Hermes bridge config is not registered in OpenClaw',
    }));

    expect(removePluginRegistrationMock).toHaveBeenCalledWith(expect.any(Object), 'hermesclaw-bridge');
    expect(removePluginRegistrationMock).toHaveBeenCalledWith(expect.any(Object), 'hermesclaw-hermes-bridge');
    expect(setSettingMock).toHaveBeenCalledWith('bridge', expect.objectContaining({
      hermesAsOpenClawAgent: expect.objectContaining({
        enabled: true,
        attached: false,
        hermesInstalled: true,
        hermesHealthy: false,
        openclawRecognized: false,
        reasonCode: 'bridge_config_missing',
        lastError: 'Hermes bridge config is not registered in OpenClaw',
        lastSyncAt: expect.any(Number),
      }),
    }));
  });

  it('recheck derives truth from config presence and openclaw health, then persists bridge state', async () => {
    getAllSettingsMock.mockResolvedValue({
      runtime: {
        mode: 'hermesclaw-both',
        installedKinds: ['openclaw', 'hermes'],
      },
      bridge: {
        hermesAsOpenClawAgent: {
          enabled: true,
          attached: false,
          hermesInstalled: false,
          hermesHealthy: false,
          openclawRecognized: false,
        },
      },
    });
    readOpenClawConfigMock.mockResolvedValue({
      plugins: {
        allow: ['hermesclaw-hermes-bridge'],
        entries: {
          'hermesclaw-hermes-bridge': { enabled: true },
        },
      },
    });
    getRuntimeFoundationSnapshotMock.mockResolvedValue({
      bridge: {
        enabled: true,
        attached: true,
        hermesInstalled: true,
        hermesHealthy: true,
        openclawRecognized: true,
        reasonCode: undefined,
      },
    });

    const { HermesOpenClawBridge } = await import('@electron/runtime/services/hermes-openclaw-bridge-service');
    const service = new HermesOpenClawBridge({
      reload: vi.fn().mockResolvedValue(undefined),
      getStatus: vi.fn().mockReturnValue({ state: 'running', gatewayReady: true }),
      checkHealth: vi.fn().mockResolvedValue({ ok: true, uptime: 10 }),
    } as never, undefined, undefined, undefined, undefined, undefined, undefined, vi.fn().mockResolvedValue({ ok: true }));

    await expect(service.recheck()).resolves.toEqual(expect.objectContaining({
      enabled: true,
      attached: true,
      hermesHealthy: true,
      reasonCode: undefined,
    }));

    expect(setSettingMock).toHaveBeenCalledWith('bridge', expect.objectContaining({
      hermesAsOpenClawAgent: expect.objectContaining({
        enabled: true,
        attached: true,
        hermesInstalled: true,
        hermesHealthy: true,
        openclawRecognized: true,
        reasonCode: undefined,
        lastSyncAt: expect.any(Number),
      }),
    }));
  });

  it('reloads openclaw after attach when both mode is active and gateway is running', async () => {
    const reloadMock = vi.fn().mockResolvedValue(undefined);
    getAllSettingsMock.mockResolvedValue({
      runtime: {
        mode: 'openclaw-with-hermes-agent',
        installedKinds: ['openclaw', 'hermes'],
      },
      bridge: {
        hermesAsOpenClawAgent: {
          enabled: false,
          attached: false,
        },
      },
    });
    readOpenClawConfigMock.mockResolvedValue({});
    getRuntimeFoundationSnapshotMock.mockResolvedValue({
      bridge: {
        enabled: true,
        attached: true,
        hermesInstalled: true,
        hermesHealthy: true,
        openclawRecognized: true,
        reasonCode: undefined,
      },
    });

    const { HermesOpenClawBridge } = await import('@electron/runtime/services/hermes-openclaw-bridge-service');
    const service = new HermesOpenClawBridge({
      getStatus: vi.fn().mockReturnValue({ state: 'running' }),
      checkHealth: vi.fn().mockResolvedValue({ ok: true, uptime: 10 }),
      reload: reloadMock,
    } as never, undefined, undefined, undefined, undefined, undefined, undefined, vi.fn().mockResolvedValue({ ok: true }));

    await service.attach();

    expect(reloadMock).toHaveBeenCalledTimes(1);
  });

  it('does not reload openclaw after attach when gateway is stopped', async () => {
    const reloadMock = vi.fn().mockResolvedValue(undefined);
    getAllSettingsMock.mockResolvedValue({
      runtime: {
        mode: 'openclaw-with-hermes-agent',
        installedKinds: ['openclaw', 'hermes'],
      },
      bridge: {
        hermesAsOpenClawAgent: {
          enabled: false,
          attached: false,
        },
      },
    });
    readOpenClawConfigMock.mockResolvedValue({});
    getRuntimeFoundationSnapshotMock.mockResolvedValue({
      bridge: {
        enabled: true,
        attached: true,
        hermesInstalled: true,
        hermesHealthy: true,
        openclawRecognized: true,
        reasonCode: undefined,
      },
    });

    const { HermesOpenClawBridge } = await import('@electron/runtime/services/hermes-openclaw-bridge-service');
    const service = new HermesOpenClawBridge({
      getStatus: vi.fn().mockReturnValue({ state: 'stopped' }),
      checkHealth: vi.fn().mockResolvedValue({ ok: true, uptime: 10 }),
      reload: reloadMock,
    } as never, undefined, undefined, undefined, undefined, undefined, undefined, vi.fn().mockResolvedValue({ ok: true }));

    await service.attach();

    expect(reloadMock).not.toHaveBeenCalled();
  });

  it('keeps attached true but marks hermes unhealthy when hermes probe fails', async () => {
    getAllSettingsMock.mockResolvedValue({
      runtime: {
        mode: 'openclaw-with-hermes-agent',
        installedKinds: ['openclaw', 'hermes'],
      },
      bridge: {
        hermesAsOpenClawAgent: {
          enabled: true,
          attached: true,
        },
      },
    });
    readOpenClawConfigMock.mockResolvedValue({
      plugins: {
        allow: ['hermesclaw-hermes-bridge'],
        entries: {
          'hermesclaw-hermes-bridge': { enabled: true },
        },
      },
    });
    getRuntimeFoundationSnapshotMock.mockResolvedValue({
      bridge: {
        enabled: true,
        attached: true,
        hermesInstalled: true,
        hermesHealthy: false,
        openclawRecognized: true,
        reasonCode: 'hermes_home_unreachable',
        error: 'Hermes home directory is not reachable',
      },
    });

    const { HermesOpenClawBridge } = await import('@electron/runtime/services/hermes-openclaw-bridge-service');
    const service = new HermesOpenClawBridge({
      getStatus: vi.fn().mockReturnValue({ state: 'running', gatewayReady: true }),
      checkHealth: vi.fn().mockResolvedValue({ ok: true, uptime: 10 }),
      reload: vi.fn().mockResolvedValue(undefined),
    } as never, undefined, undefined, undefined, undefined, undefined, undefined, vi.fn().mockResolvedValue({ ok: false, error: 'Hermes home directory is not reachable' }));

    await expect(service.recheck()).resolves.toEqual(expect.objectContaining({
      attached: true,
      hermesHealthy: false,
      openclawRecognized: true,
      reasonCode: 'hermes_home_unreachable',
      error: 'Hermes home directory is not reachable',
    }));

    expect(setSettingMock).toHaveBeenCalledWith('bridge', expect.objectContaining({
      hermesAsOpenClawAgent: expect.objectContaining({
        attached: true,
        hermesHealthy: false,
        openclawRecognized: true,
        reasonCode: 'hermes_home_unreachable',
        lastError: 'Hermes home directory is not reachable',
      }),
    }));
  });

  it('keeps attached true but marks recognition pending when gateway is running and not ready', async () => {
    getAllSettingsMock.mockResolvedValue({
      runtime: {
        mode: 'openclaw-with-hermes-agent',
        installedKinds: ['openclaw', 'hermes'],
      },
      bridge: {
        hermesAsOpenClawAgent: {
          enabled: true,
          attached: true,
        },
      },
    });
    readOpenClawConfigMock.mockResolvedValue({
      plugins: {
        allow: ['hermesclaw-hermes-bridge'],
        entries: {
          'hermesclaw-hermes-bridge': { enabled: true },
        },
      },
    });
    getRuntimeFoundationSnapshotMock.mockResolvedValue({
      bridge: {
        enabled: true,
        attached: true,
        hermesInstalled: true,
        hermesHealthy: false,
        openclawRecognized: false,
        reasonCode: 'openclaw_recognition_pending',
        error: 'OpenClaw bridge reload/recognition is still pending',
      },
    });

    const probeMock = vi.fn().mockResolvedValue({ ok: true });
    const { HermesOpenClawBridge } = await import('@electron/runtime/services/hermes-openclaw-bridge-service');
    const service = new HermesOpenClawBridge({
      getStatus: vi.fn().mockReturnValue({ state: 'running', gatewayReady: false }),
      checkHealth: vi.fn().mockResolvedValue({ ok: true, uptime: 10 }),
      reload: vi.fn().mockResolvedValue(undefined),
    } as never, undefined, undefined, undefined, undefined, undefined, undefined, probeMock);

    await expect(service.recheck()).resolves.toEqual(expect.objectContaining({
      attached: true,
      hermesHealthy: false,
      openclawRecognized: false,
      reasonCode: 'openclaw_recognition_pending',
      error: 'OpenClaw bridge reload/recognition is still pending',
    }));

    expect(probeMock).not.toHaveBeenCalled();
    expect(setSettingMock).toHaveBeenCalledWith('bridge', expect.objectContaining({
      hermesAsOpenClawAgent: expect.objectContaining({
        attached: true,
        hermesHealthy: false,
        openclawRecognized: false,
        reasonCode: 'openclaw_recognition_pending',
        lastError: 'OpenClaw bridge reload/recognition is still pending',
      }),
    }));
  });

  it('classifies gateway stopped separately from generic gateway health failures', async () => {
    getAllSettingsMock.mockResolvedValue({
      runtime: {
        mode: 'openclaw-with-hermes-agent',
        installedKinds: ['openclaw', 'hermes'],
      },
      bridge: {
        hermesAsOpenClawAgent: {
          enabled: true,
          attached: true,
        },
      },
    });
    readOpenClawConfigMock.mockResolvedValue({
      plugins: {
        allow: ['hermesclaw-hermes-bridge'],
        entries: {
          'hermesclaw-hermes-bridge': { enabled: true },
        },
      },
    });
    getRuntimeFoundationSnapshotMock.mockResolvedValue({
      bridge: {
        enabled: true,
        attached: true,
        hermesInstalled: true,
        hermesHealthy: false,
        openclawRecognized: false,
        reasonCode: 'openclaw_gateway_stopped',
        error: 'OpenClaw gateway is not running',
      },
    });

    const probeMock = vi.fn().mockResolvedValue({ ok: true });
    const { HermesOpenClawBridge } = await import('@electron/runtime/services/hermes-openclaw-bridge-service');
    const service = new HermesOpenClawBridge({
      getStatus: vi.fn().mockReturnValue({ state: 'stopped', gatewayReady: false }),
      checkHealth: vi.fn().mockResolvedValue({ ok: false, error: 'WebSocket not connected' }),
      reload: vi.fn().mockResolvedValue(undefined),
    } as never, undefined, undefined, undefined, undefined, undefined, undefined, probeMock);

    await expect(service.recheck()).resolves.toEqual(expect.objectContaining({
      attached: true,
      hermesHealthy: false,
      openclawRecognized: false,
      reasonCode: 'openclaw_gateway_stopped',
      error: 'OpenClaw gateway is not running',
    }));

    expect(probeMock).not.toHaveBeenCalled();
    expect(setSettingMock).toHaveBeenCalledWith('bridge', expect.objectContaining({
      hermesAsOpenClawAgent: expect.objectContaining({
        reasonCode: 'openclaw_gateway_stopped',
        lastError: 'OpenClaw gateway is not running',
      }),
    }));
  });

  it('classifies missing hermes runtime with a machine-readable reason code', async () => {
    getAllSettingsMock.mockResolvedValue({
      runtime: {
        mode: 'openclaw-with-hermes-agent',
        installedKinds: ['openclaw'],
      },
      bridge: {
        hermesAsOpenClawAgent: {
          enabled: true,
          attached: false,
        },
      },
    });
    readOpenClawConfigMock.mockResolvedValue({});
    getRuntimeFoundationSnapshotMock.mockResolvedValue({
      bridge: {
        enabled: true,
        attached: false,
        hermesInstalled: false,
        hermesHealthy: false,
        openclawRecognized: false,
        reasonCode: 'hermes_not_installed',
        error: 'Hermes runtime is not installed',
      },
    });

    const probeMock = vi.fn().mockResolvedValue({ ok: true });
    const { HermesOpenClawBridge } = await import('@electron/runtime/services/hermes-openclaw-bridge-service');
    const service = new HermesOpenClawBridge({
      getStatus: vi.fn().mockReturnValue({ state: 'running', gatewayReady: true }),
      checkHealth: vi.fn().mockResolvedValue({ ok: true, uptime: 10 }),
      reload: vi.fn().mockResolvedValue(undefined),
    } as never, undefined, undefined, undefined, undefined, undefined, undefined, probeMock);

    await expect(service.recheck()).resolves.toEqual(expect.objectContaining({
      attached: false,
      hermesInstalled: false,
      reasonCode: 'hermes_not_installed',
      error: 'Hermes runtime is not installed',
    }));

    expect(probeMock).not.toHaveBeenCalled();
    expect(setSettingMock).toHaveBeenCalledWith('bridge', expect.objectContaining({
      hermesAsOpenClawAgent: expect.objectContaining({
        attached: false,
        hermesInstalled: false,
        reasonCode: 'hermes_not_installed',
        lastError: 'Hermes runtime is not installed',
      }),
    }));
  });

  it('surfaces native-preferred bridge probe errors when both native path and WSL are configured', async () => {
    getAllSettingsMock.mockResolvedValue({
      runtime: {
        mode: 'openclaw-with-hermes-agent',
        installedKinds: ['openclaw', 'hermes'],
        windowsHermesPreferredMode: 'native',
        windowsHermesNativePath: 'C:\\Hermes\\.hermes',
        windowsHermesWslDistro: 'Ubuntu-24.04',
      },
      bridge: {
        hermesAsOpenClawAgent: {
          enabled: true,
          attached: true,
        },
      },
    });
    readOpenClawConfigMock.mockResolvedValue({
      plugins: {
        allow: ['hermesclaw-hermes-bridge'],
        entries: {
          'hermesclaw-hermes-bridge': { enabled: true },
        },
      },
    });
    getHermesInstallStatusMock.mockResolvedValue({
      installed: false,
      installMode: 'native',
      error: 'Hermes native home directory was not found at C:\\Hermes\\.hermes',
    });
    getRuntimeFoundationSnapshotMock.mockResolvedValue({
      bridge: {
        enabled: true,
        attached: true,
        hermesInstalled: true,
        hermesHealthy: false,
        openclawRecognized: true,
        reasonCode: 'hermes_home_unreachable',
        error: 'Hermes native home directory was not found at C:\\Hermes\\.hermes',
      },
    });

    const { HermesOpenClawBridge } = await import('@electron/runtime/services/hermes-openclaw-bridge-service');
    const service = new HermesOpenClawBridge({
      getStatus: vi.fn().mockReturnValue({ state: 'running', gatewayReady: true }),
      checkHealth: vi.fn().mockResolvedValue({ ok: true, uptime: 10 }),
      reload: vi.fn().mockResolvedValue(undefined),
    } as never);

    await expect(service.recheck()).resolves.toEqual(expect.objectContaining({
      reasonCode: 'hermes_home_unreachable',
      error: 'Hermes native home directory was not found at C:\\Hermes\\.hermes',
    }));

    expect(getHermesInstallStatusMock).toHaveBeenCalledWith({
      windowsHermesPreferredMode: 'native',
      windowsHermesNativePath: 'C:\\Hermes\\.hermes',
      windowsHermesWslDistro: 'Ubuntu-24.04',
      installedKinds: [],
    });
  });

  it('surfaces wsl-preferred bridge probe errors when both native path and WSL are configured', async () => {
    getAllSettingsMock.mockResolvedValue({
      runtime: {
        mode: 'openclaw-with-hermes-agent',
        installedKinds: ['openclaw', 'hermes'],
        windowsHermesPreferredMode: 'wsl2',
        windowsHermesNativePath: 'C:\\Hermes\\.hermes',
        windowsHermesWslDistro: 'Ubuntu-24.04',
      },
      bridge: {
        hermesAsOpenClawAgent: {
          enabled: true,
          attached: true,
        },
      },
    });
    readOpenClawConfigMock.mockResolvedValue({
      plugins: {
        allow: ['hermesclaw-hermes-bridge'],
        entries: {
          'hermesclaw-hermes-bridge': { enabled: true },
        },
      },
    });
    getHermesInstallStatusMock.mockResolvedValue({
      installed: false,
      installMode: 'wsl2',
      error: 'Hermes home directory is not reachable in WSL distro "Ubuntu-24.04"',
    });
    getRuntimeFoundationSnapshotMock.mockResolvedValue({
      bridge: {
        enabled: true,
        attached: true,
        hermesInstalled: true,
        hermesHealthy: false,
        openclawRecognized: true,
        reasonCode: 'hermes_home_unreachable',
        error: 'Hermes home directory is not reachable in WSL distro "Ubuntu-24.04"',
      },
    });

    const { HermesOpenClawBridge } = await import('@electron/runtime/services/hermes-openclaw-bridge-service');
    const service = new HermesOpenClawBridge({
      getStatus: vi.fn().mockReturnValue({ state: 'running', gatewayReady: true }),
      checkHealth: vi.fn().mockResolvedValue({ ok: true, uptime: 10 }),
      reload: vi.fn().mockResolvedValue(undefined),
    } as never);

    await expect(service.recheck()).resolves.toEqual(expect.objectContaining({
      reasonCode: 'hermes_home_unreachable',
      error: 'Hermes home directory is not reachable in WSL distro "Ubuntu-24.04"',
    }));

    expect(getHermesInstallStatusMock).toHaveBeenCalledWith({
      windowsHermesPreferredMode: 'wsl2',
      windowsHermesNativePath: 'C:\\Hermes\\.hermes',
      windowsHermesWslDistro: 'Ubuntu-24.04',
      installedKinds: [],
    });
  });
});
