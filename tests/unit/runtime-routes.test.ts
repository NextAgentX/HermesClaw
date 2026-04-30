import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IncomingMessage, ServerResponse } from 'http';

const parseJsonBodyMock = vi.fn();
const sendJsonMock = vi.fn();
const getAllSettingsMock = vi.fn();
const setSettingMock = vi.fn();
const getRuntimeFoundationSnapshotMock = vi.fn();
const runRuntimeHealthCheckMock = vi.fn();
const runtimeInstallMock = vi.fn();
const installerConstructorMock = vi.fn();
const bridgeAttachMock = vi.fn();
const bridgeDetachMock = vi.fn();
const bridgeRecheckMock = vi.fn();
const bridgeGetStatusMock = vi.fn();
const proxyAwareFetchMock = vi.fn();
const getHermesClawLocalStatusMock = vi.fn();
const runHermesClawDoctorMock = vi.fn();
const checkOpenClawRuntimeUpdateMock = vi.fn();
const applyOpenClawRuntimeUpdateMock = vi.fn();
const rollbackOpenClawRuntimeMock = vi.fn();
const checkHermesClawUpdateMock = vi.fn();
const applyHermesClawUpdateMock = vi.fn();
const rollbackHermesClawRuntimeMock = vi.fn();
const repairHermesClawInstallationMock = vi.fn();
const getHermesClawLogsLocationMock = vi.fn();
const getHermesClawSharedConfigMock = vi.fn();
const syncHermesClawSharedConfigMock = vi.fn();
const hermesStartMock = vi.fn();
const hermesStopMock = vi.fn();
const hermesRestartMock = vi.fn();

vi.mock('@electron/api/route-utils', () => ({
  parseJsonBody: (...args: unknown[]) => parseJsonBodyMock(...args),
  sendJson: (...args: unknown[]) => sendJsonMock(...args),
}));

vi.mock('@electron/utils/store', () => ({
  getAllSettings: (...args: unknown[]) => getAllSettingsMock(...args),
  setSetting: (...args: unknown[]) => setSettingMock(...args),
}));

vi.mock('@electron/runtime/services/runtime-status-service', () => ({
  getRuntimeFoundationSnapshot: (...args: unknown[]) => getRuntimeFoundationSnapshotMock(...args),
}));

vi.mock('@electron/runtime/services/runtime-health-service', () => ({
  runRuntimeHealthCheck: (...args: unknown[]) => runRuntimeHealthCheckMock(...args),
}));

vi.mock('@electron/runtime/installer-orchestrator', () => ({
  InstallerOrchestrator: class {
    constructor(...args: unknown[]) {
      installerConstructorMock(...args);
    }

    install(installChoice: unknown) {
      return runtimeInstallMock(installChoice);
    }
  },
}));

vi.mock('@electron/runtime/services/hermes-openclaw-bridge-service', () => ({
  HermesOpenClawBridge: class {
    attach() {
      return bridgeAttachMock();
    }

    detach() {
      return bridgeDetachMock();
    }

    recheck() {
      return bridgeRecheckMock();
    }

    getStatus() {
      return bridgeGetStatusMock();
    }
  },
}));

vi.mock('@electron/utils/proxy-fetch', () => ({
  proxyAwareFetch: (...args: unknown[]) => proxyAwareFetchMock(...args),
}));

vi.mock('@electron/runtime/services/hermesclaw-local-integration-service', () => ({
  checkOpenClawRuntimeUpdate: (...args: unknown[]) => checkOpenClawRuntimeUpdateMock(...args),
  applyOpenClawRuntimeUpdate: (...args: unknown[]) => applyOpenClawRuntimeUpdateMock(...args),
  rollbackOpenClawRuntime: (...args: unknown[]) => rollbackOpenClawRuntimeMock(...args),
  getHermesClawLocalStatus: (...args: unknown[]) => getHermesClawLocalStatusMock(...args),
  runHermesClawDoctor: (...args: unknown[]) => runHermesClawDoctorMock(...args),
  checkHermesClawUpdate: (...args: unknown[]) => checkHermesClawUpdateMock(...args),
  applyHermesClawUpdate: (...args: unknown[]) => applyHermesClawUpdateMock(...args),
  rollbackHermesClawRuntime: (...args: unknown[]) => rollbackHermesClawRuntimeMock(...args),
  repairHermesClawInstallation: (...args: unknown[]) => repairHermesClawInstallationMock(...args),
  getHermesClawLogsLocation: (...args: unknown[]) => getHermesClawLogsLocationMock(...args),
  getHermesClawSharedConfig: (...args: unknown[]) => getHermesClawSharedConfigMock(...args),
  syncHermesClawSharedConfig: (...args: unknown[]) => syncHermesClawSharedConfigMock(...args),
}));

vi.mock('@electron/runtime/services/hermes-standalone-manager', () => ({
  getHermesStandaloneManager: () => ({
    start: (...args: unknown[]) => hermesStartMock(...args),
    stop: (...args: unknown[]) => hermesStopMock(...args),
    restart: (...args: unknown[]) => hermesRestartMock(...args),
  }),
}));

describe('runtime routes', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    proxyAwareFetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '{}',
    });
  });

  it('returns current runtime mode through host api', async () => {
    getRuntimeFoundationSnapshotMock.mockResolvedValue({
      runtime: {
        installChoice: 'both',
        mode: 'openclaw-with-hermes-agent',
      },
    });

    const { handleRuntimeModeRoutes } = await import('@electron/api/routes/runtime-mode');
    const handled = await handleRuntimeModeRoutes(
      { method: 'GET' } as IncomingMessage,
      {} as ServerResponse,
      new URL('http://127.0.0.1:13210/api/runtime/mode'),
      { gatewayManager: {} } as never,
    );

    expect(handled).toBe(true);
    expect(sendJsonMock).toHaveBeenCalledWith(expect.anything(), 200, {
      installChoice: 'both',
      mode: 'openclaw-with-hermes-agent',
    });
  });

  it('normalizes install choice updates into persisted runtime settings', async () => {
    parseJsonBodyMock.mockResolvedValue({ installChoice: 'both' });
    getAllSettingsMock.mockResolvedValue({
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
          reasonCode: 'bridge_disabled',
          lastSyncAt: 100,
          lastError: 'stale bridge error',
        },
      },
    });

    const { handleRuntimeModeRoutes } = await import('@electron/api/routes/runtime-mode');
    const handled = await handleRuntimeModeRoutes(
      { method: 'PUT' } as IncomingMessage,
      {} as ServerResponse,
      new URL('http://127.0.0.1:13210/api/runtime/install-choice'),
      { gatewayManager: {} } as never,
    );

    expect(handled).toBe(true);
    expect(setSettingMock).toHaveBeenCalledWith('runtime', expect.objectContaining({
      installChoice: 'both',
      mode: 'hermesclaw-both',
      installedKinds: ['openclaw', 'hermes'],
      lastStandaloneRuntime: 'openclaw',
    }));
    expect(setSettingMock).toHaveBeenCalledWith('bridge', expect.objectContaining({
      hermesAsOpenClawAgent: expect.objectContaining({
        enabled: true,
        attached: false,
        hermesInstalled: true,
        hermesHealthy: false,
        openclawRecognized: false,
        reasonCode: undefined,
        lastSyncAt: undefined,
        lastError: undefined,
      }),
    }));
    expect(sendJsonMock).toHaveBeenCalledWith(expect.anything(), 200, {
      success: true,
      installChoice: 'both',
    });
  });

  it('accepts canonical HermesClaw both runtime mode updates', async () => {
    parseJsonBodyMock.mockResolvedValue({ mode: 'hermesclaw-both' });
    getAllSettingsMock.mockResolvedValue({
      runtime: {
        installChoice: 'openclaw',
        mode: 'openclaw',
        installedKinds: ['openclaw'],
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

    const { handleRuntimeModeRoutes } = await import('@electron/api/routes/runtime-mode');
    const handled = await handleRuntimeModeRoutes(
      { method: 'PUT' } as IncomingMessage,
      {} as ServerResponse,
      new URL('http://127.0.0.1:13210/api/runtime/mode'),
      { gatewayManager: {} } as never,
    );

    expect(handled).toBe(true);
    expect(setSettingMock).toHaveBeenCalledWith('runtime', expect.objectContaining({
      mode: 'hermesclaw-both',
      installChoice: 'both',
      installedKinds: ['openclaw', 'hermes'],
      lastStandaloneRuntime: 'hermes',
    }));
    expect(setSettingMock).toHaveBeenCalledWith('bridge', expect.objectContaining({
      hermesAsOpenClawAgent: expect.objectContaining({
        enabled: true,
        attached: false,
        hermesInstalled: true,
        hermesHealthy: false,
        openclawRecognized: false,
        reasonCode: undefined,
      }),
    }));
    expect(sendJsonMock).toHaveBeenCalledWith(expect.anything(), 200, {
      success: true,
      mode: 'hermesclaw-both',
    });
  });

  it('clears stale persisted bridge state when runtime mode changes', async () => {
    parseJsonBodyMock.mockResolvedValue({ mode: 'openclaw' });
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
          openclawRecognized: false,
          reasonCode: 'openclaw_recognition_pending',
          lastSyncAt: 200,
          lastError: 'OpenClaw bridge reload/recognition is still pending',
        },
      },
    });

    const { handleRuntimeModeRoutes } = await import('@electron/api/routes/runtime-mode');
    const handled = await handleRuntimeModeRoutes(
      { method: 'PUT' } as IncomingMessage,
      {} as ServerResponse,
      new URL('http://127.0.0.1:13210/api/runtime/mode'),
      { gatewayManager: {} } as never,
    );

    expect(handled).toBe(true);
    expect(setSettingMock).toHaveBeenCalledWith('runtime', expect.objectContaining({
      mode: 'openclaw',
      installChoice: 'openclaw',
      installedKinds: ['openclaw'],
      lastStandaloneRuntime: 'openclaw',
    }));
    expect(setSettingMock).toHaveBeenCalledWith('bridge', expect.objectContaining({
      hermesAsOpenClawAgent: expect.objectContaining({
        enabled: false,
        attached: false,
        hermesInstalled: false,
        hermesHealthy: false,
        openclawRecognized: false,
        reasonCode: 'bridge_disabled',
        lastSyncAt: undefined,
        lastError: undefined,
      }),
    }));
    expect(sendJsonMock).toHaveBeenCalledWith(expect.anything(), 200, {
      success: true,
      mode: 'openclaw',
    });
  });

  it('returns runtime status snapshots with bridge reasonCode', async () => {
    getRuntimeFoundationSnapshotMock.mockResolvedValue({
      runtime: {
        installChoice: 'openclaw',
        mode: 'openclaw',
        installedKinds: ['openclaw'],
      },
      bridge: {
        enabled: false,
        attached: false,
        hermesInstalled: false,
        hermesHealthy: false,
        openclawRecognized: false,
        reasonCode: 'bridge_disabled',
        error: undefined,
      },
      runtimes: [],
    });

    const { handleRuntimeModeRoutes } = await import('@electron/api/routes/runtime-mode');
    const handled = await handleRuntimeModeRoutes(
      { method: 'GET' } as IncomingMessage,
      {} as ServerResponse,
      new URL('http://127.0.0.1:13210/api/runtime/status'),
      { gatewayManager: {} } as never,
    );

    expect(handled).toBe(true);
    expect(sendJsonMock).toHaveBeenCalledWith(expect.anything(), 200, expect.objectContaining({
      bridge: expect.objectContaining({
        reasonCode: 'bridge_disabled',
        error: undefined,
      }),
    }));
  });

  it('delegates runtime install requests to the installer orchestrator', async () => {
    parseJsonBodyMock.mockResolvedValue({ installChoice: 'both' });
    const eventBus = { emit: vi.fn() };
    runtimeInstallMock.mockResolvedValue({
      success: true,
      installChoice: 'both',
      steps: [
        { id: 'openclaw', kind: 'runtime', status: 'completed', label: 'OpenClaw runtime installation' },
      ],
      snapshot: {
        runtime: { installChoice: 'both', mode: 'openclaw-with-hermes-agent', installedKinds: ['openclaw', 'hermes'] },
        bridge: { enabled: true, attached: false, hermesInstalled: true, hermesHealthy: false, openclawRecognized: false },
        runtimes: [],
      },
    });

    const { handleRuntimeModeRoutes } = await import('@electron/api/routes/runtime-mode');
    const handled = await handleRuntimeModeRoutes(
      { method: 'POST' } as IncomingMessage,
      {} as ServerResponse,
      new URL('http://127.0.0.1:13210/api/runtime/install'),
      { gatewayManager: {}, eventBus } as never,
    );

    expect(handled).toBe(true);
    expect(installerConstructorMock).toHaveBeenCalledWith(
      {},
      undefined,
      undefined,
      undefined,
      expect.objectContaining({ emit: expect.any(Function) }),
    );
    expect(runtimeInstallMock).toHaveBeenCalledWith('both');
    expect(sendJsonMock).toHaveBeenCalledWith(expect.anything(), 200, expect.objectContaining({
      success: true,
      installChoice: 'both',
    }));
  });

  it('returns aggregated runtime health-check state', async () => {
    runRuntimeHealthCheckMock.mockResolvedValue({
      checkedAt: 123,
      runtime: {
        installChoice: 'openclaw',
        mode: 'openclaw',
        installedKinds: ['openclaw'],
      },
      bridge: {
        enabled: false,
        attached: false,
        hermesInstalled: false,
        hermesHealthy: false,
        openclawRecognized: false,
      },
      runtimes: [],
      summary: {
        primaryRuntimeKind: 'openclaw',
        primaryRuntimeHealthy: true,
        bridgeRequired: false,
        bridgeReady: true,
        issues: [],
      },
    });

    const { handleRuntimeModeRoutes } = await import('@electron/api/routes/runtime-mode');
    const handled = await handleRuntimeModeRoutes(
      { method: 'POST' } as IncomingMessage,
      {} as ServerResponse,
      new URL('http://127.0.0.1:13210/api/runtime/health-check'),
      { gatewayManager: {} } as never,
    );

    expect(handled).toBe(true);
    expect(sendJsonMock).toHaveBeenCalledWith(expect.anything(), 200, expect.objectContaining({
      checkedAt: 123,
      summary: expect.objectContaining({
        primaryRuntimeKind: 'openclaw',
        bridgeReady: true,
      }),
    }));
  });

  it('starts, stops, and restarts Hermes through main-owned lifecycle routes', async () => {
    const snapshot = {
      runtime: { installChoice: 'hermes', mode: 'hermes', installedKinds: ['hermes'] },
      bridge: { enabled: false, attached: false, hermesInstalled: true, hermesHealthy: true, openclawRecognized: false },
      runtimes: [{ kind: 'hermes', installed: true, running: true, healthy: true }],
    };
    getRuntimeFoundationSnapshotMock.mockResolvedValue(snapshot);

    const { handleRuntimeModeRoutes } = await import('@electron/api/routes/runtime-mode');
    for (const action of ['start', 'stop', 'restart'] as const) {
      const handled = await handleRuntimeModeRoutes(
        { method: 'POST' } as IncomingMessage,
        {} as ServerResponse,
        new URL(`http://127.0.0.1:13210/api/runtime/hermes/${action}`),
        { gatewayManager: { id: 'gateway' } } as never,
      );

      expect(handled).toBe(true);
      expect(sendJsonMock).toHaveBeenLastCalledWith(expect.anything(), 200, {
        success: true,
        action,
        snapshot,
      });
    }

    expect(hermesStartMock).toHaveBeenCalledTimes(1);
    expect(hermesStopMock).toHaveBeenCalledTimes(1);
    expect(hermesRestartMock).toHaveBeenCalledTimes(1);
  });

  it('returns a lifecycle error when Hermes start fails', async () => {
    hermesStartMock.mockRejectedValue(new Error('missing runtime manifest'));

    const { handleRuntimeModeRoutes } = await import('@electron/api/routes/runtime-mode');
    const handled = await handleRuntimeModeRoutes(
      { method: 'POST' } as IncomingMessage,
      {} as ServerResponse,
      new URL('http://127.0.0.1:13210/api/runtime/hermes/start'),
      { gatewayManager: {} } as never,
    );

    expect(handled).toBe(true);
    expect(sendJsonMock).toHaveBeenCalledWith(expect.anything(), 500, {
      success: false,
      action: 'start',
      error: 'missing runtime manifest',
    });
  });

  it('returns HermesClaw local status with manifest and three-layer paths', async () => {
    getHermesClawLocalStatusMock.mockResolvedValue({
      layout: {
        rootDir: 'userData/HermesClaw',
        packagedBaselineDir: 'node_modules/@hermesclaw',
        userRuntimesDir: 'userData/HermesClaw/runtimes',
        sharedConfigDir: 'userData/HermesClaw/shared-config',
        manifestPath: 'userData/HermesClaw/runtime-manifest.json',
      },
      manifest: { schemaVersion: 1, activeChannel: 'stable', channels: {}, rollbackStack: [] },
      installStatus: { installed: true, installMode: 'native', installPath: '~/.hermes' },
      bridge: { enabled: true, attached: false, hermesInstalled: true, hermesHealthy: false, openclawRecognized: false },
    });

    const { handleRuntimeModeRoutes } = await import('@electron/api/routes/runtime-mode');
    const handled = await handleRuntimeModeRoutes(
      { method: 'GET' } as IncomingMessage,
      {} as ServerResponse,
      new URL('http://127.0.0.1:13210/api/runtime/hermesclaw/status'),
      { gatewayManager: { id: 'gateway' } } as never,
    );

    expect(handled).toBe(true);
    expect(getHermesClawLocalStatusMock).toHaveBeenCalledWith({ id: 'gateway' });
    expect(sendJsonMock).toHaveBeenCalledWith(expect.anything(), 200, expect.objectContaining({
      layout: expect.objectContaining({ sharedConfigDir: 'userData/HermesClaw/shared-config' }),
      manifest: expect.objectContaining({ activeChannel: 'stable' }),
    }));
  });

  it('runs HermesClaw doctor through the main-owned runtime service', async () => {
    runHermesClawDoctorMock.mockResolvedValue({
      ok: false,
      checkedAt: 456,
      reportPath: 'userData/HermesClaw/logs/hermesclaw-doctor-456.json',
      repairPlan: ['Install Python or configure Hermes runtime'],
      checks: [
        { id: 'runtime-directories', status: 'pass', label: 'Runtime directories' },
        { id: 'python', status: 'warn', label: 'Python', detail: 'Python was not found' },
      ],
    });

    const { handleRuntimeModeRoutes } = await import('@electron/api/routes/runtime-mode');
    const handled = await handleRuntimeModeRoutes(
      { method: 'POST' } as IncomingMessage,
      {} as ServerResponse,
      new URL('http://127.0.0.1:13210/api/runtime/hermesclaw/doctor'),
      { gatewayManager: { id: 'gateway' } } as never,
    );

    expect(handled).toBe(true);
    expect(runHermesClawDoctorMock).toHaveBeenCalledWith({ id: 'gateway' });
    expect(sendJsonMock).toHaveBeenCalledWith(expect.anything(), 200, expect.objectContaining({
      ok: false,
      checks: expect.arrayContaining([expect.objectContaining({ id: 'python', status: 'warn' })]),
    }));
  });

  it('checks, applies, and rolls back HermesClaw runtime updates', async () => {
    parseJsonBodyMock
      .mockResolvedValueOnce({ channel: 'beta' })
      .mockResolvedValueOnce({ channel: 'beta', version: '0.4.0-beta.1' });
    checkHermesClawUpdateMock.mockResolvedValue({
      channel: 'beta',
      currentVersion: '0.3.10',
      latestVersion: '0.4.0-beta.1',
      updateAvailable: true,
    });
    applyHermesClawUpdateMock.mockResolvedValue({
      success: true,
      channel: 'beta',
      version: '0.4.0-beta.1',
      backupId: 'backup-1',
    });
    rollbackHermesClawRuntimeMock.mockResolvedValue({
      success: true,
      restoredVersion: '0.3.10',
      backupId: 'backup-1',
    });

    const { handleRuntimeModeRoutes } = await import('@electron/api/routes/runtime-mode');
    const checkHandled = await handleRuntimeModeRoutes(
      { method: 'POST' } as IncomingMessage,
      {} as ServerResponse,
      new URL('http://127.0.0.1:13210/api/runtime/hermesclaw/update/check'),
      { gatewayManager: {} } as never,
    );
    const applyHandled = await handleRuntimeModeRoutes(
      { method: 'POST' } as IncomingMessage,
      {} as ServerResponse,
      new URL('http://127.0.0.1:13210/api/runtime/hermesclaw/update/apply'),
      { gatewayManager: {} } as never,
    );
    const rollbackHandled = await handleRuntimeModeRoutes(
      { method: 'POST' } as IncomingMessage,
      {} as ServerResponse,
      new URL('http://127.0.0.1:13210/api/runtime/hermesclaw/rollback'),
      { gatewayManager: {} } as never,
    );

    expect(checkHandled).toBe(true);
    expect(applyHandled).toBe(true);
    expect(rollbackHandled).toBe(true);
    expect(checkHermesClawUpdateMock).toHaveBeenCalledWith('beta');
    expect(applyHermesClawUpdateMock).toHaveBeenCalledWith({ channel: 'beta', version: '0.4.0-beta.1' });
    expect(rollbackHermesClawRuntimeMock).toHaveBeenCalledTimes(1);
    expect(sendJsonMock).toHaveBeenCalledWith(expect.anything(), 200, expect.objectContaining({ updateAvailable: true }));
    expect(sendJsonMock).toHaveBeenCalledWith(expect.anything(), 200, expect.objectContaining({ success: true, version: '0.4.0-beta.1' }));
    expect(sendJsonMock).toHaveBeenCalledWith(expect.anything(), 200, expect.objectContaining({ success: true, restoredVersion: '0.3.10' }));
  });

  it('returns and dry-runs shared HermesClaw config synchronization', async () => {
    parseJsonBodyMock.mockResolvedValue({ dryRun: true, scope: 'startup' });
    getHermesClawSharedConfigMock.mockResolvedValue({
      schemaVersion: 1,
      skills: [{ id: 'skill-a', runtimeSupport: ['openclaw', 'hermes'] }],
      agents: [],
      rules: [],
    });
    syncHermesClawSharedConfigMock.mockResolvedValue({
      dryRun: true,
      scope: 'startup',
      changes: [],
      log: ['No shared-config changes required'],
    });

    const { handleRuntimeModeRoutes } = await import('@electron/api/routes/runtime-mode');
    const getHandled = await handleRuntimeModeRoutes(
      { method: 'GET' } as IncomingMessage,
      {} as ServerResponse,
      new URL('http://127.0.0.1:13210/api/runtime/hermesclaw/shared-config'),
      { gatewayManager: {} } as never,
    );
    const syncHandled = await handleRuntimeModeRoutes(
      { method: 'POST' } as IncomingMessage,
      {} as ServerResponse,
      new URL('http://127.0.0.1:13210/api/runtime/hermesclaw/shared-config/sync'),
      { gatewayManager: {} } as never,
    );

    expect(getHandled).toBe(true);
    expect(syncHandled).toBe(true);
    expect(getHermesClawSharedConfigMock).toHaveBeenCalledTimes(1);
    expect(syncHermesClawSharedConfigMock).toHaveBeenCalledWith({ dryRun: true, scope: 'startup' });
    expect(sendJsonMock).toHaveBeenCalledWith(expect.anything(), 200, expect.objectContaining({
      skills: expect.arrayContaining([expect.objectContaining({ id: 'skill-a' })]),
    }));
    expect(sendJsonMock).toHaveBeenCalledWith(expect.anything(), 200, expect.objectContaining({
      dryRun: true,
      log: ['No shared-config changes required'],
    }));
  });

  it('repairs HermesClaw installation and exposes the logs directory through host routes', async () => {
    const repairResult = {
      success: true,
      repaired: ['shared-config:openclaw-adapter.json', 'logs-directory'],
      doctor: {
        ok: true,
        checkedAt: 123,
        reportPath: 'C:\\HermesClaw\\HermesClaw\\logs\\hermesclaw-doctor-123.json',
        repairPlan: [],
        checks: [{ id: 'repair', status: 'pass', label: 'Repair readiness' }],
      },
    };
    repairHermesClawInstallationMock.mockResolvedValue(repairResult);
    getHermesClawLogsLocationMock.mockReturnValue({ dir: 'C:\\HermesClaw\\HermesClaw\\logs' });

    const { handleRuntimeModeRoutes } = await import('@electron/api/routes/runtime-mode');
    const repairHandled = await handleRuntimeModeRoutes(
      { method: 'POST' } as IncomingMessage,
      {} as ServerResponse,
      new URL('http://127.0.0.1:13210/api/runtime/hermesclaw/repair'),
      { gatewayManager: { id: 'gateway' } } as never,
    );
    const logsHandled = await handleRuntimeModeRoutes(
      { method: 'GET' } as IncomingMessage,
      {} as ServerResponse,
      new URL('http://127.0.0.1:13210/api/runtime/hermesclaw/logs'),
      { gatewayManager: { id: 'gateway' } } as never,
    );
    const openLogsHandled = await handleRuntimeModeRoutes(
      { method: 'POST' } as IncomingMessage,
      {} as ServerResponse,
      new URL('http://127.0.0.1:13210/api/runtime/hermesclaw/logs/open'),
      { gatewayManager: { id: 'gateway' } } as never,
    );

    expect(repairHandled).toBe(true);
    expect(logsHandled).toBe(true);
    expect(openLogsHandled).toBe(true);
    expect(repairHermesClawInstallationMock).toHaveBeenCalledWith({ id: 'gateway' });
    expect(getHermesClawLogsLocationMock).toHaveBeenCalledTimes(2);
    expect(sendJsonMock).toHaveBeenCalledWith(expect.anything(), 200, repairResult);
    expect(sendJsonMock).toHaveBeenCalledWith(expect.anything(), 200, { dir: 'C:\\HermesClaw\\HermesClaw\\logs' });
    expect(sendJsonMock).toHaveBeenCalledWith(expect.anything(), 200, {
      success: true,
      dir: 'C:\\HermesClaw\\HermesClaw\\logs',
      error: undefined,
    });
  });

  it('surfaces OpenClaw runtime update and rollback management through host routes', async () => {
    const snapshot = {
      runtime: {
        installChoice: 'both',
        mode: 'hermesclaw-both',
        installedKinds: ['openclaw', 'hermes'],
      },
      bridge: {
        enabled: true,
        attached: true,
        hermesInstalled: true,
        hermesHealthy: true,
        openclawRecognized: true,
      },
      runtimes: [
        {
          kind: 'openclaw',
          installed: true,
          running: true,
          healthy: true,
          version: '1.2.3',
          endpoint: 'http://127.0.0.1:18789',
        },
      ],
    };
    getRuntimeFoundationSnapshotMock.mockResolvedValue(snapshot);
    parseJsonBodyMock
      .mockResolvedValueOnce({ channel: 'beta' })
      .mockResolvedValueOnce({ channel: 'beta', version: '1.3.0-beta.1' });
    checkOpenClawRuntimeUpdateMock.mockResolvedValue({
      supported: true,
      runtime: 'openclaw',
      action: 'check-update',
      channel: 'beta',
      currentVersion: '1.2.3',
      latestVersion: '1.3.0-beta.1',
      updateAvailable: true,
      releaseNotes: 'Gateway runtime beta',
      risk: 'medium',
    });
    applyOpenClawRuntimeUpdateMock.mockResolvedValue({
      supported: true,
      success: true,
      runtime: 'openclaw',
      action: 'apply-update',
      channel: 'beta',
      version: '1.3.0-beta.1',
      backupId: 'openclaw-beta-1',
    });
    rollbackOpenClawRuntimeMock.mockResolvedValue({
      supported: true,
      success: true,
      runtime: 'openclaw',
      action: 'rollback',
      restoredVersion: '1.2.3',
      backupId: 'openclaw-beta-1',
    });
    const gatewayManager = {
      reload: vi.fn().mockResolvedValue(undefined),
      restart: vi.fn().mockResolvedValue(undefined),
      checkHealth: vi.fn().mockResolvedValue({ ok: true, uptime: 4 }),
      getStatus: vi.fn().mockReturnValue({ state: 'running', gatewayReady: true, pid: 1234, version: '1.3.0-beta.1' }),
      getDiagnostics: vi.fn().mockReturnValue({ consecutiveHeartbeatMisses: 0, consecutiveRpcFailures: 0 }),
    };

    const { handleRuntimeModeRoutes } = await import('@electron/api/routes/runtime-mode');
    const checkHandled = await handleRuntimeModeRoutes(
      { method: 'POST' } as IncomingMessage,
      {} as ServerResponse,
      new URL('http://127.0.0.1:13210/api/runtime/openclaw/update/check'),
      { gatewayManager } as never,
    );
    const applyHandled = await handleRuntimeModeRoutes(
      { method: 'POST' } as IncomingMessage,
      {} as ServerResponse,
      new URL('http://127.0.0.1:13210/api/runtime/openclaw/update/apply'),
      { gatewayManager } as never,
    );
    const rollbackHandled = await handleRuntimeModeRoutes(
      { method: 'POST' } as IncomingMessage,
      {} as ServerResponse,
      new URL('http://127.0.0.1:13210/api/runtime/openclaw/rollback'),
      { gatewayManager } as never,
    );

    expect(checkHandled).toBe(true);
    expect(applyHandled).toBe(true);
    expect(rollbackHandled).toBe(true);
    expect(checkOpenClawRuntimeUpdateMock).toHaveBeenCalledWith('beta');
    expect(applyOpenClawRuntimeUpdateMock).toHaveBeenCalledWith({ channel: 'beta', version: '1.3.0-beta.1' });
    expect(rollbackOpenClawRuntimeMock).toHaveBeenCalled();
    expect(gatewayManager.reload).toHaveBeenCalledTimes(2);
    expect(gatewayManager.restart).not.toHaveBeenCalled();
    expect(gatewayManager.checkHealth).toHaveBeenCalledTimes(2);
    expect(sendJsonMock).toHaveBeenCalledWith(expect.anything(), 200, expect.objectContaining({
      supported: true,
      runtime: 'openclaw',
      action: 'check-update',
      channel: 'beta',
      currentVersion: '1.2.3',
      latestVersion: '1.3.0-beta.1',
      updateAvailable: true,
      snapshot,
    }));
    expect(sendJsonMock).toHaveBeenCalledWith(expect.anything(), 200, expect.objectContaining({
      supported: true,
      success: true,
      runtime: 'openclaw',
      action: 'apply-update',
      version: '1.3.0-beta.1',
      backupId: 'openclaw-beta-1',
      gatewayRefreshAction: 'reload',
      gatewayReady: true,
      gatewayHealth: { ok: true, uptime: 4 },
      gatewayStatus: expect.objectContaining({ state: 'running', gatewayReady: true }),
      snapshot,
    }));
    expect(sendJsonMock).toHaveBeenCalledWith(expect.anything(), 200, expect.objectContaining({
      supported: true,
      success: true,
      runtime: 'openclaw',
      action: 'rollback',
      restoredVersion: '1.2.3',
      gatewayRefreshAction: 'reload',
      gatewayReady: true,
      snapshot,
    }));
  });

  it('falls back to Gateway restart when OpenClaw update reload fails', async () => {
    const snapshot = {
      runtime: { installChoice: 'openclaw', mode: 'openclaw', installedKinds: ['openclaw'] },
      bridge: { enabled: false, attached: false, hermesInstalled: false, hermesHealthy: false, openclawRecognized: false },
      runtimes: [{ kind: 'openclaw', installed: true, running: true, healthy: true, version: '1.3.0' }],
    };
    getRuntimeFoundationSnapshotMock.mockResolvedValue(snapshot);
    parseJsonBodyMock.mockResolvedValue({ channel: 'stable', version: '1.3.0' });
    applyOpenClawRuntimeUpdateMock.mockResolvedValue({
      supported: true,
      success: true,
      runtime: 'openclaw',
      action: 'apply-update',
      channel: 'stable',
      version: '1.3.0',
      backupId: 'openclaw-stable-1',
    });
    const gatewayManager = {
      reload: vi.fn().mockRejectedValue(new Error('SIGUSR1 unsupported')),
      restart: vi.fn().mockResolvedValue(undefined),
      checkHealth: vi.fn().mockResolvedValue({ ok: true, uptime: 1 }),
      getStatus: vi.fn().mockReturnValue({ state: 'running', gatewayReady: true, pid: 5678 }),
      getDiagnostics: vi.fn().mockReturnValue({ consecutiveHeartbeatMisses: 0, consecutiveRpcFailures: 0 }),
    };

    const { handleRuntimeModeRoutes } = await import('@electron/api/routes/runtime-mode');
    const handled = await handleRuntimeModeRoutes(
      { method: 'POST' } as IncomingMessage,
      {} as ServerResponse,
      new URL('http://127.0.0.1:13210/api/runtime/openclaw/update/apply'),
      { gatewayManager } as never,
    );

    expect(handled).toBe(true);
    expect(gatewayManager.reload).toHaveBeenCalledTimes(1);
    expect(gatewayManager.restart).toHaveBeenCalledTimes(1);
    expect(sendJsonMock).toHaveBeenCalledWith(expect.anything(), 200, expect.objectContaining({
      supported: true,
      success: true,
      runtime: 'openclaw',
      action: 'apply-update',
      gatewayRefreshAction: 'restart',
      gatewayReady: true,
      snapshot,
    }));
  });

  it('waits for Gateway restart to finish before rolling back OpenClaw update apply', async () => {
    const snapshot = {
      runtime: { installChoice: 'openclaw', mode: 'openclaw', installedKinds: ['openclaw'] },
      bridge: { enabled: false, attached: false, hermesInstalled: false, hermesHealthy: false, openclawRecognized: false },
      runtimes: [{ kind: 'openclaw', installed: true, running: true, healthy: true, version: '1.3.0' }],
    };
    getRuntimeFoundationSnapshotMock.mockResolvedValue(snapshot);
    parseJsonBodyMock.mockResolvedValue({ channel: 'stable', version: '1.3.0' });
    applyOpenClawRuntimeUpdateMock.mockResolvedValue({
      supported: true,
      success: true,
      runtime: 'openclaw',
      action: 'apply-update',
      channel: 'stable',
      version: '1.3.0',
      backupId: 'openclaw-stable-1',
    });
    const gatewayManager = {
      reload: vi.fn().mockResolvedValue(undefined),
      restart: vi.fn().mockResolvedValue(undefined),
      checkHealth: vi.fn().mockResolvedValue({ ok: true, uptime: 1 }),
      getStatus: vi.fn()
        .mockReturnValueOnce({ state: 'starting', gatewayReady: false })
        .mockReturnValueOnce({ state: 'starting', gatewayReady: false })
        .mockReturnValue({ state: 'running', gatewayReady: true, pid: 5678, version: '1.3.0' }),
      getDiagnostics: vi.fn().mockReturnValue({ consecutiveHeartbeatMisses: 0, consecutiveRpcFailures: 0 }),
    };

    const { handleRuntimeModeRoutes } = await import('@electron/api/routes/runtime-mode');
    const handled = await handleRuntimeModeRoutes(
      { method: 'POST' } as IncomingMessage,
      {} as ServerResponse,
      new URL('http://127.0.0.1:13210/api/runtime/openclaw/update/apply'),
      { gatewayManager } as never,
    );

    expect(handled).toBe(true);
    expect(rollbackOpenClawRuntimeMock).not.toHaveBeenCalled();
    expect(gatewayManager.reload).toHaveBeenCalledTimes(1);
    expect(gatewayManager.checkHealth).toHaveBeenCalledTimes(1);
    expect(sendJsonMock).toHaveBeenCalledWith(expect.anything(), 200, expect.objectContaining({
      supported: true,
      success: true,
      runtime: 'openclaw',
      action: 'apply-update',
      version: '1.3.0',
      backupId: 'openclaw-stable-1',
      gatewayRefreshAction: 'reload',
      gatewayReady: true,
      snapshot,
    }));
  });

  it('rolls back OpenClaw when Gateway never becomes ready after update apply', async () => {
    const snapshot = {
      runtime: { installChoice: 'openclaw', mode: 'openclaw', installedKinds: ['openclaw'] },
      bridge: { enabled: false, attached: false, hermesInstalled: false, hermesHealthy: false, openclawRecognized: false },
      runtimes: [{ kind: 'openclaw', installed: true, running: true, healthy: false, version: '1.2.3' }],
    };
    getRuntimeFoundationSnapshotMock.mockResolvedValue(snapshot);
    parseJsonBodyMock.mockResolvedValue({ channel: 'stable', version: '1.3.0' });
    applyOpenClawRuntimeUpdateMock.mockResolvedValue({
      supported: true,
      success: true,
      runtime: 'openclaw',
      action: 'apply-update',
      channel: 'stable',
      version: '1.3.0',
      backupId: 'openclaw-stable-1',
    });
    rollbackOpenClawRuntimeMock.mockResolvedValue({
      supported: true,
      success: true,
      runtime: 'openclaw',
      action: 'rollback',
      restoredVersion: '1.2.3',
      backupId: 'openclaw-stable-1',
    });
    const gatewayManager = {
      reload: vi.fn().mockResolvedValue(undefined),
      restart: vi.fn().mockResolvedValue(undefined),
      checkHealth: vi.fn()
        .mockResolvedValueOnce({ ok: false, error: 'connection refused' })
        .mockResolvedValueOnce({ ok: false, error: 'connection refused' })
        .mockResolvedValueOnce({ ok: false, error: 'connection refused' })
        .mockResolvedValueOnce({ ok: false, error: 'connection refused' })
        .mockResolvedValueOnce({ ok: false, error: 'connection refused' })
        .mockResolvedValueOnce({ ok: false, error: 'connection refused' })
        .mockResolvedValueOnce({ ok: false, error: 'connection refused' })
        .mockResolvedValueOnce({ ok: false, error: 'connection refused' })
        .mockResolvedValueOnce({ ok: false, error: 'connection refused' })
        .mockResolvedValueOnce({ ok: false, error: 'connection refused' })
        .mockResolvedValueOnce({ ok: false, error: 'connection refused' })
        .mockResolvedValueOnce({ ok: false, error: 'connection refused' })
        .mockResolvedValueOnce({ ok: false, error: 'connection refused' })
        .mockResolvedValue({ ok: true, uptime: 2 }),
      getStatus: vi.fn()
        .mockReturnValueOnce({ state: 'running', gatewayReady: false })
        .mockReturnValueOnce({ state: 'running', gatewayReady: false })
        .mockReturnValueOnce({ state: 'running', gatewayReady: false })
        .mockReturnValueOnce({ state: 'running', gatewayReady: false })
        .mockReturnValueOnce({ state: 'running', gatewayReady: false })
        .mockReturnValueOnce({ state: 'running', gatewayReady: false })
        .mockReturnValueOnce({ state: 'running', gatewayReady: false })
        .mockReturnValueOnce({ state: 'running', gatewayReady: false })
        .mockReturnValueOnce({ state: 'running', gatewayReady: false })
        .mockReturnValueOnce({ state: 'running', gatewayReady: false })
        .mockReturnValueOnce({ state: 'running', gatewayReady: false })
        .mockReturnValueOnce({ state: 'running', gatewayReady: false })
        .mockReturnValueOnce({ state: 'running', gatewayReady: false })
        .mockReturnValue({ state: 'running', gatewayReady: true, pid: 5678, version: '1.2.3' }),
      getDiagnostics: vi.fn().mockReturnValue({ consecutiveHeartbeatMisses: 0, consecutiveRpcFailures: 0 }),
    };

    const { handleRuntimeModeRoutes } = await import('@electron/api/routes/runtime-mode');
    const handled = await handleRuntimeModeRoutes(
      { method: 'POST' } as IncomingMessage,
      {} as ServerResponse,
      new URL('http://127.0.0.1:13210/api/runtime/openclaw/update/apply'),
      { gatewayManager } as never,
    );

    expect(handled).toBe(true);
    expect(rollbackOpenClawRuntimeMock).toHaveBeenCalledTimes(1);
    expect(gatewayManager.reload).toHaveBeenCalledTimes(2);
    expect(sendJsonMock).toHaveBeenCalledWith(expect.anything(), 200, expect.objectContaining({
      supported: true,
      success: false,
      runtime: 'openclaw',
      action: 'apply-update',
      version: '1.3.0',
      rolledBack: true,
      restoredVersion: '1.2.3',
      rollbackBackupId: 'openclaw-stable-1',
      gatewayRefreshAction: 'reload',
      gatewayReady: true,
      error: expect.stringContaining('Gateway readiness failed'),
      snapshot,
    }));
  });

  it('proxies Hermes compatibility status through runtime routes in Hermes mode', async () => {
    getRuntimeFoundationSnapshotMock.mockResolvedValue({
      runtime: {
        installChoice: 'hermes',
        mode: 'hermes',
        installedKinds: ['hermes'],
      },
      bridge: {
        enabled: false,
        attached: false,
        hermesInstalled: false,
        hermesHealthy: false,
        openclawRecognized: false,
      },
      runtimes: [
        {
          kind: 'hermes',
          installed: true,
          running: true,
          healthy: true,
          endpoint: 'http://127.0.0.1:8642',
        },
      ],
    });
    proxyAwareFetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ status: 'ok' }),
    });

    const { handleRuntimeModeRoutes } = await import('@electron/api/routes/runtime-mode');
    const handled = await handleRuntimeModeRoutes(
      { method: 'GET' } as IncomingMessage,
      {} as ServerResponse,
      new URL('http://127.0.0.1:13210/api/runtime/hermes/status'),
      { gatewayManager: {} } as never,
    );

    expect(handled).toBe(true);
    expect(proxyAwareFetchMock).toHaveBeenCalledWith('http://127.0.0.1:8642/status', expect.objectContaining({ method: 'GET' }));
    expect(sendJsonMock).toHaveBeenCalledWith(expect.anything(), 200, { status: 'ok' });
  });

  it('adds Hermes endpoint context when compatibility proxy fetch throws', async () => {
    getRuntimeFoundationSnapshotMock.mockResolvedValue({
      runtime: {
        installChoice: 'hermes',
        mode: 'hermes',
        installedKinds: ['hermes'],
      },
      bridge: {
        enabled: false,
        attached: false,
        hermesInstalled: false,
        hermesHealthy: false,
        openclawRecognized: false,
      },
      runtimes: [
        {
          kind: 'hermes',
          installed: true,
          running: false,
          healthy: false,
          endpoint: 'http://127.0.0.1:8642',
        },
      ],
    });
    proxyAwareFetchMock.mockRejectedValueOnce(new Error('fetch failed'));

    const { handleRuntimeModeRoutes } = await import('@electron/api/routes/runtime-mode');
    const handled = await handleRuntimeModeRoutes(
      { method: 'GET' } as IncomingMessage,
      {} as ServerResponse,
      new URL('http://127.0.0.1:13210/api/runtime/hermes/status'),
      { gatewayManager: {} } as never,
    );

    expect(handled).toBe(true);
    expect(sendJsonMock).toHaveBeenCalledWith(expect.anything(), 502, {
      success: false,
      error: 'Failed to reach Hermes endpoint http://127.0.0.1:8642: fetch failed',
    });
  });

  it('rejects Hermes compatibility requests when runtime mode is not Hermes', async () => {
    getRuntimeFoundationSnapshotMock.mockResolvedValue({
      runtime: {
        installChoice: 'openclaw',
        mode: 'openclaw',
        installedKinds: ['openclaw'],
      },
      bridge: {
        enabled: false,
        attached: false,
        hermesInstalled: false,
        hermesHealthy: false,
        openclawRecognized: false,
      },
      runtimes: [
        {
          kind: 'hermes',
          installed: false,
          running: false,
          healthy: false,
          endpoint: 'http://127.0.0.1:8642',
          error: 'Hermes on Windows requires a configured WSL2 distro',
        },
      ],
    });

    const { handleRuntimeModeRoutes } = await import('@electron/api/routes/runtime-mode');
    const handled = await handleRuntimeModeRoutes(
      { method: 'GET' } as IncomingMessage,
      {} as ServerResponse,
      new URL('http://127.0.0.1:13210/api/runtime/hermes/models'),
      { gatewayManager: {} } as never,
    );

    expect(handled).toBe(true);
    expect(proxyAwareFetchMock).not.toHaveBeenCalled();
    expect(sendJsonMock).toHaveBeenCalledWith(expect.anything(), 409, {
      success: false,
      error: 'Hermes compatibility proxy is only available in Hermes runtime mode',
    });
  });

  it('returns bridge status snapshot', async () => {
    bridgeGetStatusMock.mockResolvedValue({
      enabled: true,
      attached: false,
      hermesInstalled: true,
      hermesHealthy: false,
      openclawRecognized: false,
      reasonCode: 'bridge_config_missing',
    });

    const { handleBridgeRoutes } = await import('@electron/api/routes/bridges');
    const handled = await handleBridgeRoutes(
      { method: 'GET' } as IncomingMessage,
      {} as ServerResponse,
      new URL('http://127.0.0.1:13210/api/bridges/hermes-openclaw/status'),
      { gatewayManager: {} } as never,
    );

    expect(handled).toBe(true);
    expect(sendJsonMock).toHaveBeenCalledWith(expect.anything(), 200, expect.objectContaining({
      enabled: true,
      hermesInstalled: true,
      reasonCode: 'bridge_config_missing',
    }));
  });

  it('returns bridge attach state from the bridge service', async () => {
    bridgeAttachMock.mockResolvedValue({
      enabled: true,
      attached: true,
      hermesInstalled: true,
      hermesHealthy: true,
      openclawRecognized: true,
      reasonCode: undefined,
    });

    const { handleBridgeRoutes } = await import('@electron/api/routes/bridges');
    const handled = await handleBridgeRoutes(
      { method: 'POST' } as IncomingMessage,
      {} as ServerResponse,
      new URL('http://127.0.0.1:13210/api/bridges/hermes-openclaw/attach'),
      { gatewayManager: {} } as never,
    );

    expect(handled).toBe(true);
    expect(sendJsonMock).toHaveBeenCalledWith(expect.anything(), 200, {
      success: true,
      bridge: expect.objectContaining({
        enabled: true,
        attached: true,
        reasonCode: undefined,
      }),
    });
  });

  it('returns bridge recheck state with machine-readable reasonCode', async () => {
    bridgeRecheckMock.mockResolvedValue({
      enabled: true,
      attached: true,
      hermesInstalled: true,
      hermesHealthy: false,
      openclawRecognized: false,
      reasonCode: 'openclaw_recognition_pending',
      error: 'OpenClaw bridge reload/recognition is still pending',
    });

    const { handleBridgeRoutes } = await import('@electron/api/routes/bridges');
    const handled = await handleBridgeRoutes(
      { method: 'POST' } as IncomingMessage,
      {} as ServerResponse,
      new URL('http://127.0.0.1:13210/api/bridges/hermes-openclaw/recheck'),
      { gatewayManager: {} } as never,
    );

    expect(handled).toBe(true);
    expect(sendJsonMock).toHaveBeenCalledWith(expect.anything(), 200, {
      success: true,
      bridge: expect.objectContaining({
        attached: true,
        reasonCode: 'openclaw_recognition_pending',
        error: 'OpenClaw bridge reload/recognition is still pending',
      }),
    });
  });
});
