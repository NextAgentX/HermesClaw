import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { BridgeStatus, RuntimeSettings } from '@electron/runtime/types';

describe('HermesStandaloneAdapter', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('maps hermes-only mode into standalone runtime health when install metadata is available', async () => {
    const { HermesStandaloneAdapter } = await import('@electron/runtime/adapters/hermes-standalone-adapter');
    const adapter = new HermesStandaloneAdapter((runtime) => ({
      installed: true,
      installMode: 'wsl2',
      version: '1.2.3',
    }));

    const runtime: RuntimeSettings = {
      installChoice: 'hermes',
      mode: 'hermes',
      installedKinds: ['hermes'],
      lastStandaloneRuntime: 'hermes',
      windowsHermesWslDistro: 'Ubuntu',
    };
    const bridge: BridgeStatus = {
      enabled: false,
      attached: false,
      hermesInstalled: true,
      hermesHealthy: false,
      openclawRecognized: false,
    };

    expect(adapter.getInstallStatus(runtime)).toEqual({
      installed: true,
      installMode: 'wsl2',
      version: '1.2.3',
    });

    expect(adapter.buildRuntimeStatus(runtime, bridge, { checkedAt: 456 })).toEqual({
      kind: 'hermes',
      installed: true,
      running: true,
      healthy: true,
      version: '1.2.3',
      endpoint: 'http://127.0.0.1:8642',
      lastCheckedAt: 456,
      error: undefined,
    });
  });

  it('uses bridge metadata when Hermes is present under OpenClaw primary mode', async () => {
    const { HermesStandaloneAdapter } = await import('@electron/runtime/adapters/hermes-standalone-adapter');
    const adapter = new HermesStandaloneAdapter((runtime) => ({
      installed: true,
      installMode: 'native',
      installPath: '/home/test/.hermes',
    }));

    const runtime: RuntimeSettings = {
      installChoice: 'both',
      mode: 'openclaw-with-hermes-agent',
      installedKinds: ['openclaw', 'hermes'],
      lastStandaloneRuntime: 'openclaw',
    };
    const bridge: BridgeStatus = {
      enabled: true,
      attached: true,
      hermesInstalled: true,
      hermesHealthy: true,
      openclawRecognized: true,
      lastSyncAt: 789,
    };

    expect(adapter.buildRuntimeStatus(runtime, bridge, { checkedAt: 789 })).toEqual({
      kind: 'hermes',
      installed: true,
      running: true,
      healthy: true,
      version: undefined,
      endpoint: '/home/test/.hermes',
      lastCheckedAt: 789,
      error: undefined,
    });
  });

  it('does not mark Hermes standalone mode as installed from persisted runtime kinds alone', async () => {
    const { HermesStandaloneAdapter } = await import('@electron/runtime/adapters/hermes-standalone-adapter');
    const adapter = new HermesStandaloneAdapter(() => ({
      installed: false,
      installMode: 'native',
      error: 'Hermes native home directory was not found at /home/test/.hermes',
    }));

    const runtime: RuntimeSettings = {
      installChoice: 'hermes',
      mode: 'hermes',
      installedKinds: ['hermes'],
      lastStandaloneRuntime: 'hermes',
    };
    const bridge: BridgeStatus = {
      enabled: false,
      attached: false,
      hermesInstalled: false,
      hermesHealthy: false,
      openclawRecognized: false,
    };

    expect(adapter.buildRuntimeStatus(runtime, bridge, { checkedAt: 999 })).toEqual({
      kind: 'hermes',
      installed: false,
      running: false,
      healthy: false,
      version: undefined,
      endpoint: 'http://127.0.0.1:8642',
      lastCheckedAt: 999,
      error: 'Hermes native home directory was not found at /home/test/.hermes',
    });
  });

  it('delegates standalone lifecycle and health operations to the Hermes manager surface', async () => {
    const startMock = vi.fn().mockResolvedValue(undefined);
    const stopMock = vi.fn().mockResolvedValue(undefined);
    const restartMock = vi.fn().mockResolvedValue(undefined);
    const reloadMock = vi.fn().mockResolvedValue(undefined);
    const checkHealthMock = vi.fn().mockResolvedValue({ ok: true, uptime: 12 });
    const rpcMock = vi.fn().mockResolvedValue({ ok: true });
    const debouncedRestartMock = vi.fn();
    const debouncedReloadMock = vi.fn();
    const forceTerminateOwnedProcessForQuitMock = vi.fn().mockResolvedValue(true);

    const { HermesStandaloneAdapter } = await import('@electron/runtime/adapters/hermes-standalone-adapter');
    const adapter = new HermesStandaloneAdapter(
      () => ({
        installed: true,
        installMode: 'wsl2',
      }),
      {
        checkHealth: checkHealthMock,
        debouncedReload: debouncedReloadMock,
        debouncedRestart: debouncedRestartMock,
        forceTerminateOwnedProcessForQuit: forceTerminateOwnedProcessForQuitMock,
        reload: reloadMock,
        restart: restartMock,
        rpc: rpcMock,
        start: startMock,
        stop: stopMock,
      },
    );

    await adapter.start();
    await adapter.stop();
    await adapter.restart();
    await adapter.reload();
    await adapter.checkHealth();
    await adapter.rpc('hermes.ping', { value: 1 }, 5000);
    await adapter.forceTerminateOwnedProcessForQuit();
    adapter.debouncedRestart(250);
    adapter.debouncedReload(500);

    expect(startMock).toHaveBeenCalledOnce();
    expect(stopMock).toHaveBeenCalledOnce();
    expect(restartMock).toHaveBeenCalledOnce();
    expect(reloadMock).toHaveBeenCalledOnce();
    expect(checkHealthMock).toHaveBeenCalledOnce();
    expect(rpcMock).toHaveBeenCalledWith('hermes.ping', { value: 1 }, 5000);
    expect(forceTerminateOwnedProcessForQuitMock).toHaveBeenCalledOnce();
    expect(debouncedRestartMock).toHaveBeenCalledWith(250);
    expect(debouncedReloadMock).toHaveBeenCalledWith(500);
  });
});
