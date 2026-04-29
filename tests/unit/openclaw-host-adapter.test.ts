import { beforeEach, describe, expect, it, vi } from 'vitest';

const getOpenClawStatusMock = vi.fn();

vi.mock('@electron/utils/paths', () => ({
  getOpenClawStatus: (...args: unknown[]) => getOpenClawStatusMock(...args),
}));

describe('OpenClawHostAdapter', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('maps current OpenClaw gateway state into primary runtime status without changing semantics', async () => {
    getOpenClawStatusMock.mockReturnValue({
      packageExists: true,
      isBuilt: true,
      entryPath: 'C:/openclaw/openclaw.mjs',
      dir: 'C:/openclaw',
      version: '2026.4.15',
    });

    const { OpenClawHostAdapter } = await import('@electron/runtime/adapters/openclaw-host-adapter');
    const adapter = new OpenClawHostAdapter({
      checkHealth: vi.fn(),
      debouncedReload: vi.fn(),
      debouncedRestart: vi.fn(),
      forceTerminateOwnedProcessForQuit: vi.fn(),
      getDiagnostics: vi.fn().mockReturnValue({ consecutiveHeartbeatMisses: 0, consecutiveRpcFailures: 0 }),
      getStatus: vi.fn().mockReturnValue({
        state: 'running',
        port: 18789,
        version: '2026.4.16',
        gatewayReady: true,
      }),
      isConnected: vi.fn().mockReturnValue(true),
      reload: vi.fn(),
      restart: vi.fn(),
      rpc: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    } as never);

    expect(adapter.getInstallStatus()).toEqual({
      installed: true,
      version: '2026.4.15',
      installPath: 'C:/openclaw',
      installMode: 'native',
    });

    expect(adapter.buildRuntimeStatus({ checkedAt: 123 })).toEqual({
      kind: 'openclaw',
      installed: true,
      running: true,
      healthy: true,
      version: '2026.4.16',
      endpoint: 'http://127.0.0.1:18789',
      lastCheckedAt: 123,
      error: undefined,
    });
  });

  it('delegates lifecycle and health operations to the existing gateway manager', async () => {
    const startMock = vi.fn().mockResolvedValue(undefined);
    const stopMock = vi.fn().mockResolvedValue(undefined);
    const restartMock = vi.fn().mockResolvedValue(undefined);
    const reloadMock = vi.fn().mockResolvedValue(undefined);
    const checkHealthMock = vi.fn().mockResolvedValue({ ok: true, uptime: 42 });
    const rpcMock = vi.fn().mockResolvedValue({ ok: true });
    const debouncedRestartMock = vi.fn();
    const debouncedReloadMock = vi.fn();
    const forceTerminateOwnedProcessForQuitMock = vi.fn().mockResolvedValue(true);

    const { OpenClawHostAdapter } = await import('@electron/runtime/adapters/openclaw-host-adapter');
    const adapter = new OpenClawHostAdapter({
      checkHealth: checkHealthMock,
      debouncedReload: debouncedReloadMock,
      debouncedRestart: debouncedRestartMock,
      forceTerminateOwnedProcessForQuit: forceTerminateOwnedProcessForQuitMock,
      getDiagnostics: vi.fn().mockReturnValue({ consecutiveHeartbeatMisses: 0, consecutiveRpcFailures: 0 }),
      getStatus: vi.fn().mockReturnValue({ state: 'stopped', port: 18789, gatewayReady: false }),
      isConnected: vi.fn().mockReturnValue(false),
      reload: reloadMock,
      restart: restartMock,
      rpc: rpcMock,
      start: startMock,
      stop: stopMock,
    } as never);

    await adapter.start();
    await adapter.stop();
    await adapter.restart();
    await adapter.reload();
    await adapter.checkHealth();
    await adapter.rpc('gateway.ping', { value: 1 }, 5000);
    await adapter.forceTerminateOwnedProcessForQuit();
    adapter.debouncedRestart(250);
    adapter.debouncedReload(500);

    expect(startMock).toHaveBeenCalledOnce();
    expect(stopMock).toHaveBeenCalledOnce();
    expect(restartMock).toHaveBeenCalledOnce();
    expect(reloadMock).toHaveBeenCalledOnce();
    expect(checkHealthMock).toHaveBeenCalledOnce();
    expect(rpcMock).toHaveBeenCalledWith('gateway.ping', { value: 1 }, 5000);
    expect(forceTerminateOwnedProcessForQuitMock).toHaveBeenCalledOnce();
    expect(debouncedRestartMock).toHaveBeenCalledWith(250);
    expect(debouncedReloadMock).toHaveBeenCalledWith(500);
  });
});
