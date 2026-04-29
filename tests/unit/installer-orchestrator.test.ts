import { beforeEach, describe, expect, it, vi } from 'vitest';

const openclawStartMock = vi.fn();
const hermesStartMock = vi.fn();
const bridgeAttachMock = vi.fn();
const bridgeRecheckMock = vi.fn();

vi.mock('@electron/runtime/adapters/openclaw-host-adapter', () => ({
  OpenClawHostAdapter: class {
    start = openclawStartMock;
  },
}));

vi.mock('@electron/runtime/adapters/hermes-standalone-adapter', () => ({
  HermesStandaloneAdapter: class {
    start = hermesStartMock;
  },
}));

vi.mock('@electron/runtime/services/hermes-openclaw-bridge-service', () => ({
  HermesOpenClawBridge: class {
    attach = bridgeAttachMock;
    recheck = bridgeRecheckMock;
  },
}));

describe('InstallerOrchestrator', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('emits runtime install progress events as steps change', async () => {
    const readSettingsMock = vi.fn().mockResolvedValue({
      runtime: {
        installChoice: 'openclaw',
        mode: 'openclaw',
        installedKinds: ['openclaw'],
        lastStandaloneRuntime: 'openclaw',
      },
      bridge: {
        hermesAsOpenClawAgent: {
          enabled: false,
          attached: false,
          hermesInstalled: false,
          hermesHealthy: false,
          openclawRecognized: false,
        },
      },
    });
    const writeSettingMock = vi.fn().mockResolvedValue(undefined);
    const readSnapshotMock = vi.fn().mockResolvedValue({
      runtime: {
        installChoice: 'both',
        mode: 'openclaw-with-hermes-agent',
        installedKinds: ['openclaw', 'hermes'],
      },
      bridge: {
        enabled: true,
        attached: false,
        hermesInstalled: true,
        hermesHealthy: false,
        openclawRecognized: false,
      },
      runtimes: [],
    });
    const emitMock = vi.fn();

    const { InstallerOrchestrator } = await import('@electron/runtime/installer-orchestrator');
    const orchestrator = Reflect.construct(InstallerOrchestrator, [
      {},
      readSettingsMock,
      writeSettingMock,
      readSnapshotMock,
      { emit: emitMock },
    ]) as InstanceType<typeof InstallerOrchestrator>;

    await orchestrator.install('both');

    expect(emitMock).toHaveBeenCalledWith('runtime:install:progress', expect.objectContaining({
      installChoice: 'both',
      activeStepId: 'openclaw',
      steps: expect.arrayContaining([
        expect.objectContaining({ id: 'openclaw', status: 'installing' }),
      ]),
    }));
    expect(emitMock).toHaveBeenCalledWith('runtime:install:progress', expect.objectContaining({
      installChoice: 'both',
      activeStepId: 'bridge',
      steps: expect.arrayContaining([
        expect.objectContaining({ id: 'bridge', status: 'completed' }),
      ]),
    }));
  });

  it('calls concrete runtime and bridge hooks for both installs', async () => {
    const readSettingsMock = vi.fn().mockResolvedValue({
      runtime: {
        installChoice: 'openclaw',
        mode: 'openclaw',
        installedKinds: ['openclaw'],
        lastStandaloneRuntime: 'openclaw',
      },
      bridge: {
        hermesAsOpenClawAgent: {
          enabled: false,
          attached: false,
          hermesInstalled: false,
          hermesHealthy: false,
          openclawRecognized: false,
        },
      },
    });
    const writeSettingMock = vi.fn().mockResolvedValue(undefined);
    const readSnapshotMock = vi.fn().mockResolvedValue({
      runtime: {
        installChoice: 'both',
        mode: 'openclaw-with-hermes-agent',
        installedKinds: ['openclaw', 'hermes'],
      },
      bridge: {
        enabled: true,
        attached: true,
        hermesInstalled: true,
        hermesHealthy: true,
        openclawRecognized: true,
      },
      runtimes: [],
    });

    openclawStartMock.mockResolvedValue(undefined);
    hermesStartMock.mockResolvedValue(undefined);
    bridgeAttachMock.mockResolvedValue({ attached: true });
    bridgeRecheckMock.mockResolvedValue({ attached: true, openclawRecognized: true });

    const { InstallerOrchestrator } = await import('@electron/runtime/installer-orchestrator');
    const orchestrator = Reflect.construct(InstallerOrchestrator, [
      {},
      readSettingsMock,
      writeSettingMock,
      readSnapshotMock,
      undefined,
    ]) as InstanceType<typeof InstallerOrchestrator>;

    const result = await orchestrator.install('both');

    expect(openclawStartMock).toHaveBeenCalledOnce();
    expect(hermesStartMock).toHaveBeenCalledOnce();
    expect(bridgeAttachMock).toHaveBeenCalledOnce();
    expect(bridgeRecheckMock).toHaveBeenCalledOnce();
    expect(result.success).toBe(true);
    expect(result.steps).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'openclaw', status: 'completed' }),
      expect.objectContaining({ id: 'hermes', status: 'completed' }),
      expect.objectContaining({ id: 'bridge', status: 'completed' }),
    ]));
  });

  it('persists refreshed bridge truth after a successful both install', async () => {
    const bridgeStatus = {
      enabled: true,
      attached: true,
      hermesInstalled: true,
      hermesHealthy: true,
      openclawRecognized: true,
      reasonCode: undefined,
      lastSyncAt: 123,
      lastError: undefined,
    };
    const readSettingsMock = vi.fn().mockResolvedValue({
      runtime: {
        installChoice: 'openclaw',
        mode: 'openclaw',
        installedKinds: ['openclaw'],
        lastStandaloneRuntime: 'openclaw',
      },
      bridge: {
        hermesAsOpenClawAgent: {
          enabled: false,
          attached: false,
          hermesInstalled: false,
          hermesHealthy: false,
          openclawRecognized: false,
        },
      },
    });
    const writeSettingMock = vi.fn().mockResolvedValue(undefined);
    const readSnapshotMock = vi.fn().mockResolvedValue({
      runtime: {
        installChoice: 'both',
        mode: 'openclaw-with-hermes-agent',
        installedKinds: ['openclaw', 'hermes'],
      },
      bridge: bridgeStatus,
      runtimes: [],
    });

    openclawStartMock.mockResolvedValue(undefined);
    hermesStartMock.mockResolvedValue(undefined);
    bridgeAttachMock.mockResolvedValue(bridgeStatus);
    bridgeRecheckMock.mockResolvedValue(bridgeStatus);

    const { InstallerOrchestrator } = await import('@electron/runtime/installer-orchestrator');
    const orchestrator = Reflect.construct(InstallerOrchestrator, [
      {},
      readSettingsMock,
      writeSettingMock,
      readSnapshotMock,
      undefined,
    ]) as InstanceType<typeof InstallerOrchestrator>;

    await orchestrator.install('both');

    expect(writeSettingMock).toHaveBeenCalledWith('bridge', expect.objectContaining({
      hermesAsOpenClawAgent: expect.objectContaining({
        enabled: true,
        attached: true,
        hermesInstalled: true,
        hermesHealthy: true,
        openclawRecognized: true,
        lastSyncAt: 123,
      }),
    }));
  });

  it('degrades bridge failure instead of failing the whole both install', async () => {
    const readSettingsMock = vi.fn().mockResolvedValue({
      runtime: {
        installChoice: 'openclaw',
        mode: 'openclaw',
        installedKinds: ['openclaw'],
        lastStandaloneRuntime: 'openclaw',
      },
      bridge: {
        hermesAsOpenClawAgent: {
          enabled: false,
          attached: false,
          hermesInstalled: false,
          hermesHealthy: false,
          openclawRecognized: false,
        },
      },
    });
    const writeSettingMock = vi.fn().mockResolvedValue(undefined);
    const readSnapshotMock = vi.fn().mockResolvedValue({
      runtime: {
        installChoice: 'both',
        mode: 'openclaw-with-hermes-agent',
        installedKinds: ['openclaw', 'hermes'],
      },
      bridge: {
        enabled: true,
        attached: false,
        hermesInstalled: true,
        hermesHealthy: false,
        openclawRecognized: false,
        error: 'Bridge attach failed',
      },
      runtimes: [],
    });

    openclawStartMock.mockResolvedValue(undefined);
    hermesStartMock.mockResolvedValue(undefined);
    bridgeAttachMock.mockRejectedValue(new Error('Bridge attach failed'));

    const { InstallerOrchestrator } = await import('@electron/runtime/installer-orchestrator');
    const orchestrator = Reflect.construct(InstallerOrchestrator, [
      {},
      readSettingsMock,
      writeSettingMock,
      readSnapshotMock,
      undefined,
    ]) as InstanceType<typeof InstallerOrchestrator>;

    const result = await orchestrator.install('both');

    expect(result.success).toBe(true);
    expect(result.steps).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'openclaw', status: 'completed' }),
      expect.objectContaining({ id: 'hermes', status: 'completed' }),
      expect.objectContaining({ id: 'bridge', status: 'failed', error: 'Bridge attach failed' }),
    ]));
    expect(writeSettingMock).toHaveBeenCalledWith('runtime', expect.objectContaining({
      installChoice: 'both',
      mode: 'hermesclaw-both',
    }));
    expect(writeSettingMock).toHaveBeenCalledWith('bridge', expect.objectContaining({
      hermesAsOpenClawAgent: expect.objectContaining({
        enabled: true,
        attached: false,
        hermesInstalled: true,
        hermesHealthy: false,
        openclawRecognized: false,
        lastError: 'Bridge attach failed',
      }),
    }));
  });

  it('skips unrelated hooks for hermes-only installs', async () => {
    const readSettingsMock = vi.fn().mockResolvedValue({
      runtime: {
        installChoice: 'openclaw',
        mode: 'openclaw',
        installedKinds: ['openclaw'],
        lastStandaloneRuntime: 'openclaw',
      },
      bridge: {
        hermesAsOpenClawAgent: {
          enabled: false,
          attached: false,
          hermesInstalled: false,
          hermesHealthy: false,
          openclawRecognized: false,
        },
      },
    });
    const writeSettingMock = vi.fn().mockResolvedValue(undefined);
    const readSnapshotMock = vi.fn().mockResolvedValue({
      runtime: {
        installChoice: 'hermes',
        mode: 'hermes',
        installedKinds: ['hermes'],
      },
      bridge: {
        enabled: false,
        attached: false,
        hermesInstalled: true,
        hermesHealthy: false,
        openclawRecognized: false,
      },
      runtimes: [],
    });

    hermesStartMock.mockResolvedValue(undefined);

    const { InstallerOrchestrator } = await import('@electron/runtime/installer-orchestrator');
    const orchestrator = Reflect.construct(InstallerOrchestrator, [
      {},
      readSettingsMock,
      writeSettingMock,
      readSnapshotMock,
      undefined,
    ]) as InstanceType<typeof InstallerOrchestrator>;

    await orchestrator.install('hermes');

    expect(openclawStartMock).not.toHaveBeenCalled();
    expect(hermesStartMock).toHaveBeenCalledOnce();
    expect(bridgeAttachMock).not.toHaveBeenCalled();
    expect(bridgeRecheckMock).not.toHaveBeenCalled();
  });

  it('treats missing Hermes runtime manifest as a recoverable prepare state during hermes install', async () => {
    const readSettingsMock = vi.fn().mockResolvedValue({
      runtime: {
        installChoice: 'openclaw',
        mode: 'openclaw',
        installedKinds: ['openclaw'],
        lastStandaloneRuntime: 'openclaw',
      },
      bridge: {
        hermesAsOpenClawAgent: {
          enabled: false,
          attached: false,
          hermesInstalled: false,
          hermesHealthy: false,
          openclawRecognized: false,
        },
      },
    });
    const writeSettingMock = vi.fn().mockResolvedValue(undefined);
    const readSnapshotMock = vi.fn().mockResolvedValue({
      runtime: {
        installChoice: 'hermes',
        mode: 'hermes',
        installedKinds: ['hermes'],
      },
      bridge: {
        enabled: false,
        attached: false,
        hermesInstalled: true,
        hermesHealthy: false,
        openclawRecognized: false,
      },
      runtimes: [],
    });

    hermesStartMock.mockRejectedValue(
      new Error('Hermes runtime manifest entry was not found. Install or repair HermesClaw runtime before starting it.'),
    );

    const { InstallerOrchestrator } = await import('@electron/runtime/installer-orchestrator');
    const orchestrator = Reflect.construct(InstallerOrchestrator, [
      {},
      readSettingsMock,
      writeSettingMock,
      readSnapshotMock,
      undefined,
    ]) as InstanceType<typeof InstallerOrchestrator>;

    const result = await orchestrator.install('hermes');

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
    expect(result.steps).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'hermes', status: 'completed' }),
    ]));
    expect(writeSettingMock).toHaveBeenCalledWith('runtime', expect.objectContaining({
      installChoice: 'hermes',
      mode: 'hermes',
      installedKinds: ['hermes'],
    }));
    expect(bridgeAttachMock).not.toHaveBeenCalled();
    expect(bridgeRecheckMock).not.toHaveBeenCalled();
  });
});
