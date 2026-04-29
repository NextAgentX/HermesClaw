import { beforeEach, describe, expect, it, vi } from 'vitest';

const getAllSettingsMock = vi.fn();
const bridgeRecheckMock = vi.fn();
const bridgeAttachMock = vi.fn();
const hermesManagerStartMock = vi.fn();
const syncHermesClawSharedConfigMock = vi.fn();
const loggerWarnMock = vi.fn();

vi.mock('@electron/utils/store', () => ({
  getAllSettings: (...args: unknown[]) => getAllSettingsMock(...args),
}));

vi.mock('@electron/runtime/services/hermes-openclaw-bridge-service', () => ({
  HermesOpenClawBridge: class {
    recheck = bridgeRecheckMock;
    attach = bridgeAttachMock;
  },
}));

vi.mock('@electron/runtime/services/hermes-standalone-manager', () => ({
  getHermesStandaloneManager: () => ({
    start: (...args: unknown[]) => hermesManagerStartMock(...args),
  }),
}));

vi.mock('@electron/runtime/services/hermesclaw-local-integration-service', () => ({
  syncHermesClawSharedConfig: (...args: unknown[]) => syncHermesClawSharedConfigMock(...args),
}));

vi.mock('@electron/utils/logger', () => ({
  logger: {
    warn: (...args: unknown[]) => loggerWarnMock(...args),
  },
}));

describe('runtime startup coordinator', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('starts Hermes manager during hermes-mode startup', async () => {
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
    hermesManagerStartMock.mockResolvedValue(undefined);
    syncHermesClawSharedConfigMock.mockResolvedValue({ dryRun: false, scope: 'startup', changes: [], log: [] });

    const { syncRuntimeStartup } = await import('@electron/runtime/services/runtime-startup-coordinator');
    await syncRuntimeStartup({ getStatus: () => ({ state: 'stopped', gatewayReady: false }) } as never);

    expect(hermesManagerStartMock).toHaveBeenCalledOnce();
    expect(syncHermesClawSharedConfigMock).toHaveBeenCalledWith({ dryRun: false, scope: 'startup' });
    expect(bridgeRecheckMock).not.toHaveBeenCalled();
    expect(bridgeAttachMock).not.toHaveBeenCalled();
  });

  it('starts Hermes before repairing the bridge in both mode when Hermes is installed but not attached', async () => {
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
          attached: false,
          hermesInstalled: true,
          hermesHealthy: false,
          openclawRecognized: false,
          reasonCode: 'bridge_config_missing',
        },
      },
    });
    hermesManagerStartMock.mockResolvedValue(undefined);
    bridgeRecheckMock.mockResolvedValue({
      enabled: true,
      attached: false,
      hermesInstalled: true,
      hermesHealthy: false,
      openclawRecognized: false,
      reasonCode: 'bridge_config_missing',
    });
    bridgeAttachMock.mockResolvedValue({
      enabled: true,
      attached: true,
      hermesInstalled: true,
      hermesHealthy: true,
      openclawRecognized: true,
    });
    syncHermesClawSharedConfigMock.mockResolvedValue({ dryRun: false, scope: 'startup', changes: [], log: [] });

    const { syncRuntimeStartup } = await import('@electron/runtime/services/runtime-startup-coordinator');
    await syncRuntimeStartup({ getStatus: () => ({ state: 'running', gatewayReady: true }) } as never);

    expect(syncHermesClawSharedConfigMock).toHaveBeenCalledWith({ dryRun: false, scope: 'startup' });
    expect(hermesManagerStartMock).toHaveBeenCalledOnce();
    expect(bridgeRecheckMock).toHaveBeenCalledOnce();
    expect(bridgeAttachMock).toHaveBeenCalledOnce();
    expect(hermesManagerStartMock.mock.invocationCallOrder[0]).toBeLessThan(bridgeRecheckMock.mock.invocationCallOrder[0]);
  });

  it('does not fail startup when shared config startup sync fails', async () => {
    const error = new Error('adapter write failed');
    getAllSettingsMock.mockResolvedValue({
      runtime: {
        installChoice: 'hermes',
        mode: 'hermes',
        installedKinds: ['hermes'],
        lastStandaloneRuntime: 'hermes',
      },
      bridge: { hermesAsOpenClawAgent: { enabled: false } },
    });
    hermesManagerStartMock.mockResolvedValue(undefined);
    syncHermesClawSharedConfigMock.mockRejectedValue(error);

    const { syncRuntimeStartup } = await import('@electron/runtime/services/runtime-startup-coordinator');
    await expect(syncRuntimeStartup({ getStatus: () => ({ state: 'stopped' }) } as never)).resolves.toBeUndefined();

    expect(loggerWarnMock).toHaveBeenCalledWith(
      'Failed to sync HermesClaw shared config during runtime startup:',
      error,
    );
  });

  it('skips Hermes startup gracefully when installedKinds says hermes but no runtime manifest entry exists', async () => {
    const error = new Error('Hermes runtime manifest entry was not found. Install or repair HermesClaw runtime before starting it.');
    getAllSettingsMock.mockResolvedValue({
      runtime: {
        installChoice: 'hermes',
        mode: 'hermes',
        installedKinds: ['hermes'],
        lastStandaloneRuntime: 'hermes',
      },
      bridge: { hermesAsOpenClawAgent: { enabled: false } },
    });
    hermesManagerStartMock.mockRejectedValue(error);

    const { syncRuntimeStartup } = await import('@electron/runtime/services/runtime-startup-coordinator');

    await expect(syncRuntimeStartup({ getStatus: () => ({ state: 'stopped' }) } as never)).resolves.toBeUndefined();

    expect(syncHermesClawSharedConfigMock).not.toHaveBeenCalled();
    expect(bridgeRecheckMock).not.toHaveBeenCalled();
    expect(bridgeAttachMock).not.toHaveBeenCalled();
    expect(loggerWarnMock).toHaveBeenCalledWith(
      'Skipping Hermes runtime startup because no launchable Hermes runtime is installed yet. Install or repair HermesClaw runtime to enable Hermes startup.',
    );
  });

  it('skips both-mode bridge startup when Hermes runtime manifest entry is missing', async () => {
    const error = new Error('Hermes runtime manifest entry was not found. Install or repair HermesClaw runtime before starting it.');
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
          attached: false,
          hermesInstalled: false,
          hermesHealthy: false,
          openclawRecognized: false,
          reasonCode: 'bridge_config_missing',
        },
      },
    });
    hermesManagerStartMock.mockRejectedValue(error);

    const { syncRuntimeStartup } = await import('@electron/runtime/services/runtime-startup-coordinator');

    await expect(syncRuntimeStartup({ getStatus: () => ({ state: 'running', gatewayReady: true }) } as never)).resolves.toBeUndefined();

    expect(syncHermesClawSharedConfigMock).not.toHaveBeenCalled();
    expect(bridgeRecheckMock).not.toHaveBeenCalled();
    expect(bridgeAttachMock).not.toHaveBeenCalled();
    expect(loggerWarnMock).toHaveBeenCalledWith(
      'Skipping Hermes runtime startup because no launchable Hermes runtime is installed yet. Install or repair HermesClaw runtime to enable Hermes startup.',
    );
  });
});
