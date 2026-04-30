import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { Settings } from '../../src/pages/Settings/index';

const hostApiFetchMock = vi.fn();
const getRuntimeStatusMock = vi.fn();
const getHermesClawLocalStatusMock = vi.fn();
const runHermesClawDoctorMock = vi.fn();
const repairHermesClawInstallationMock = vi.fn();
const openHermesClawLogsLocationMock = vi.fn();
const checkHermesClawUpdateMock = vi.fn();
const applyHermesClawUpdateMock = vi.fn();
const rollbackHermesClawRuntimeMock = vi.fn();
const getHermesClawSharedConfigMock = vi.fn();
const syncHermesClawSharedConfigMock = vi.fn();
const startOpenClawRuntimeMock = vi.fn();
const stopOpenClawRuntimeMock = vi.fn();
const restartOpenClawRuntimeMock = vi.fn();
const checkOpenClawUpdateMock = vi.fn();
const applyOpenClawUpdateMock = vi.fn();
const rollbackOpenClawRuntimeMock = vi.fn();
const installRuntimeMock = vi.fn();
const startHermesRuntimeMock = vi.fn();
const stopHermesRuntimeMock = vi.fn();
const restartHermesRuntimeMock = vi.fn();
const attachHermesOpenClawBridgeMock = vi.fn();
const recheckHermesOpenClawBridgeMock = vi.fn();
const invokeIpcMock = vi.fn();
const getGatewayWsDiagnosticEnabledMock = vi.fn();
const setGatewayWsDiagnosticEnabledMock = vi.fn();
const toastSuccessMock = vi.fn();
const toastErrorMock = vi.fn();

const { settingsState, gatewayState, updateStoreState, tMock } = vi.hoisted(() => ({
  settingsState: {
    theme: 'system' as const,
    setTheme: vi.fn(),
    language: 'en',
    setLanguage: vi.fn(),
    launchAtStartup: false,
    setLaunchAtStartup: vi.fn(),
    gatewayAutoStart: true,
    setGatewayAutoStart: vi.fn(),
    proxyEnabled: false,
    proxyServer: '',
    proxyHttpServer: '',
    proxyHttpsServer: '',
    proxyAllServer: '',
    proxyBypassRules: '',
    setProxyEnabled: vi.fn(),
    setProxyServer: vi.fn(),
    setProxyHttpServer: vi.fn(),
    setProxyHttpsServer: vi.fn(),
    setProxyAllServer: vi.fn(),
    setProxyBypassRules: vi.fn(),
    autoCheckUpdate: true,
    setAutoCheckUpdate: vi.fn(),
    autoDownloadUpdate: false,
    setAutoDownloadUpdate: vi.fn(),
    devModeUnlocked: false,
    setDevModeUnlocked: vi.fn(),
    telemetryEnabled: false,
    setTelemetryEnabled: vi.fn(),
    runtime: {
      installChoice: 'both' as const,
      mode: 'openclaw-with-hermes-agent' as const,
      installedKinds: ['openclaw', 'hermes'] as const,
      windowsHermesPreferredMode: 'wsl2' as const,
      windowsHermesNativePath: '',
      windowsHermesWslDistro: 'Ubuntu-24.04',
      lastStandaloneRuntime: 'openclaw' as const,
    },
  },
  gatewayState: {
    status: { state: 'running', port: 18789 },
    restart: vi.fn(),
  },
  updateStoreState: {
    currentVersion: '0.3.10-test',
    setAutoDownload: vi.fn(),
  },
  tMock: vi.fn((key: string) => key),
}));

vi.mock('@/stores/settings', () => {
  const useSettingsStore = ((selector?: (state: typeof settingsState) => unknown) =>
    selector ? selector(settingsState) : settingsState) as
    ((selector?: (state: typeof settingsState) => unknown) => unknown) & { getState: () => typeof settingsState };
  useSettingsStore.getState = () => settingsState;
  return { useSettingsStore };
});

vi.mock('@/stores/gateway', () => ({
  useGatewayStore: (selector?: (state: typeof gatewayState) => unknown) =>
    selector ? selector(gatewayState) : gatewayState,
}));

vi.mock('@/stores/update', () => ({
  useUpdateStore: (selector: (state: typeof updateStoreState) => unknown) => selector(updateStoreState),
}));

vi.mock('@/components/settings/UpdateSettings', () => ({
  UpdateSettings: () => <div data-testid="update-settings" />,
}));

vi.mock('@/lib/api-client', () => ({
  invokeIpc: (...args: unknown[]) => invokeIpcMock(...args),
  getGatewayWsDiagnosticEnabled: () => getGatewayWsDiagnosticEnabledMock(),
  setGatewayWsDiagnosticEnabled: (...args: unknown[]) => setGatewayWsDiagnosticEnabledMock(...args),
  toUserMessage: (error: unknown) => String(error),
}));

vi.mock('@/lib/host-api', () => ({
  hostApiFetch: (...args: unknown[]) => hostApiFetchMock(...args),
  getRuntimeStatus: (...args: unknown[]) => getRuntimeStatusMock(...args),
  getHermesClawLocalStatus: (...args: unknown[]) => getHermesClawLocalStatusMock(...args),
  runHermesClawDoctor: (...args: unknown[]) => runHermesClawDoctorMock(...args),
  repairHermesClawInstallation: (...args: unknown[]) => repairHermesClawInstallationMock(...args),
  openHermesClawLogsLocation: (...args: unknown[]) => openHermesClawLogsLocationMock(...args),
  checkHermesClawUpdate: (...args: unknown[]) => checkHermesClawUpdateMock(...args),
  applyHermesClawUpdate: (...args: unknown[]) => applyHermesClawUpdateMock(...args),
  rollbackHermesClawRuntime: (...args: unknown[]) => rollbackHermesClawRuntimeMock(...args),
  getHermesClawSharedConfig: (...args: unknown[]) => getHermesClawSharedConfigMock(...args),
  syncHermesClawSharedConfig: (...args: unknown[]) => syncHermesClawSharedConfigMock(...args),
  startOpenClawRuntime: (...args: unknown[]) => startOpenClawRuntimeMock(...args),
  stopOpenClawRuntime: (...args: unknown[]) => stopOpenClawRuntimeMock(...args),
  restartOpenClawRuntime: (...args: unknown[]) => restartOpenClawRuntimeMock(...args),
  checkOpenClawUpdate: (...args: unknown[]) => checkOpenClawUpdateMock(...args),
  applyOpenClawUpdate: (...args: unknown[]) => applyOpenClawUpdateMock(...args),
  rollbackOpenClawRuntime: (...args: unknown[]) => rollbackOpenClawRuntimeMock(...args),
  installRuntime: (...args: unknown[]) => installRuntimeMock(...args),
  startHermesRuntime: (...args: unknown[]) => startHermesRuntimeMock(...args),
  stopHermesRuntime: (...args: unknown[]) => stopHermesRuntimeMock(...args),
  restartHermesRuntime: (...args: unknown[]) => restartHermesRuntimeMock(...args),
  attachHermesOpenClawBridge: (...args: unknown[]) => attachHermesOpenClawBridgeMock(...args),
  recheckHermesOpenClawBridge: (...args: unknown[]) => recheckHermesOpenClawBridgeMock(...args),
}));

vi.mock('@/lib/telemetry', () => ({
  clearUiTelemetry: vi.fn(),
  getUiTelemetrySnapshot: vi.fn(() => []),
  subscribeUiTelemetry: vi.fn(() => vi.fn()),
  trackUiEvent: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: tMock,
  }),
}));

vi.mock('@/i18n', () => ({
  SUPPORTED_LANGUAGES: [{ code: 'en', label: 'English' }],
}));

vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccessMock(...args),
    error: (...args: unknown[]) => toastErrorMock(...args),
    warning: vi.fn(),
  },
}));

describe('Settings runtime panel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tMock.mockImplementation((key: string) => key);
    window.electron.platform = 'win32';
    window.electron.ipcRenderer.invoke = vi.fn();
    window.electron.ipcRenderer.on = vi.fn(() => vi.fn());
    getGatewayWsDiagnosticEnabledMock.mockReturnValue(false);
    invokeIpcMock.mockImplementation((channel: string) => {
      if (channel === 'openclaw:getCliCommand') {
        return Promise.resolve({ success: true, command: 'openclaw --help' });
      }

      if (channel === 'shell:showItemInFolder') {
        return Promise.resolve(undefined);
      }

      return Promise.resolve(undefined);
    });

    getRuntimeStatusMock.mockResolvedValue({
      runtime: {
        installChoice: 'both',
        mode: 'openclaw-with-hermes-agent',
        installedKinds: ['openclaw', 'hermes'],
        windowsHermesPreferredMode: 'wsl2',
        windowsHermesNativePath: '',
        windowsHermesWslDistro: 'Ubuntu-24.04',
        lastStandaloneRuntime: 'openclaw',
      },
      bridge: {
        enabled: true,
        attached: false,
        hermesInstalled: true,
        hermesHealthy: false,
        openclawRecognized: false,
        error: 'awaiting attach',
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
        {
          kind: 'hermes',
          installed: true,
          running: false,
          healthy: false,
          version: '0.9.0',
          error: 'Hermes home directory was not found at ~/.hermes',
        },
      ],
    });

    attachHermesOpenClawBridgeMock.mockResolvedValue(undefined);
    recheckHermesOpenClawBridgeMock.mockResolvedValue(undefined);
    const stoppedOpenClawSnapshot = {
      runtime: {
        installChoice: 'both',
        mode: 'openclaw-with-hermes-agent',
        installedKinds: ['openclaw', 'hermes'],
        lastStandaloneRuntime: 'openclaw',
      },
      bridge: {
        enabled: true,
        attached: false,
        hermesInstalled: true,
        hermesHealthy: false,
        openclawRecognized: false,
        error: 'awaiting attach',
      },
      runtimes: [
        { kind: 'openclaw', installed: true, running: false, healthy: false, version: '1.2.3' },
        { kind: 'hermes', installed: true, running: false, healthy: false, version: '0.9.0' },
      ],
    };
    const runningOpenClawSnapshot = {
      ...stoppedOpenClawSnapshot,
      runtimes: [
        { kind: 'openclaw', installed: true, running: true, healthy: true, version: '1.2.3', endpoint: 'http://127.0.0.1:18789' },
        { kind: 'hermes', installed: true, running: false, healthy: false, version: '0.9.0' },
      ],
    };
    const openClawUpdateCheckResult = {
      supported: true,
      runtime: 'openclaw',
      action: 'check-update',
      channel: 'stable',
      currentVersion: '1.2.3',
      latestVersion: '1.3.0',
      updateAvailable: true,
      releaseNotes: 'Gateway runtime refresh',
      risk: 'low',
      snapshot: runningOpenClawSnapshot,
    };
    startOpenClawRuntimeMock.mockResolvedValue({ success: true, action: 'start', snapshot: runningOpenClawSnapshot });
    stopOpenClawRuntimeMock.mockResolvedValue({ success: true, action: 'stop', snapshot: stoppedOpenClawSnapshot });
    restartOpenClawRuntimeMock.mockResolvedValue({ success: true, action: 'restart', snapshot: runningOpenClawSnapshot });
    installRuntimeMock.mockResolvedValue({
      success: true,
      installChoice: 'both',
      steps: [
        { id: 'openclaw', kind: 'runtime', status: 'completed', label: 'Install OpenClaw runtime' },
        { id: 'hermes', kind: 'runtime', status: 'completed', label: 'Install Hermes runtime' },
      ],
      snapshot: runningOpenClawSnapshot,
    });
    checkOpenClawUpdateMock.mockResolvedValue(openClawUpdateCheckResult);
    applyOpenClawUpdateMock.mockResolvedValue({
      supported: true,
      success: true,
      runtime: 'openclaw',
      action: 'apply-update',
      channel: 'stable',
      version: '1.3.0',
      backupId: 'openclaw-stable-1',
      gatewayRefreshAction: 'reload',
      gatewayReady: true,
      gatewayHealth: { ok: true, uptime: 1 },
      snapshot: runningOpenClawSnapshot,
    });
    rollbackOpenClawRuntimeMock.mockResolvedValue({
      supported: true,
      success: true,
      runtime: 'openclaw',
      action: 'rollback',
      restoredVersion: '1.2.3',
      backupId: 'openclaw-stable-1',
      gatewayRefreshAction: 'reload',
      gatewayReady: true,
      gatewayHealth: { ok: true, uptime: 1 },
      snapshot: runningOpenClawSnapshot,
    });
    const runningHermesSnapshot = {
      runtime: {
        installChoice: 'both',
        mode: 'openclaw-with-hermes-agent',
        installedKinds: ['openclaw', 'hermes'],
        lastStandaloneRuntime: 'openclaw',
      },
      bridge: {
        enabled: true,
        attached: false,
        hermesInstalled: true,
        hermesHealthy: true,
        openclawRecognized: false,
        error: 'awaiting attach',
      },
      runtimes: [
        { kind: 'openclaw', installed: true, running: true, healthy: true, version: '1.2.3' },
        { kind: 'hermes', installed: true, running: true, healthy: true, version: '0.9.0', endpoint: 'http://127.0.0.1:8642' },
      ],
    };
    const stoppedHermesSnapshot = {
      ...runningHermesSnapshot,
      bridge: {
        ...runningHermesSnapshot.bridge,
        hermesHealthy: false,
      },
      runtimes: [
        { kind: 'openclaw', installed: true, running: true, healthy: true, version: '1.2.3' },
        { kind: 'hermes', installed: true, running: false, healthy: false, version: '0.9.0' },
      ],
    };
    startHermesRuntimeMock.mockResolvedValue({ success: true, action: 'start', snapshot: runningHermesSnapshot });
    stopHermesRuntimeMock.mockResolvedValue({ success: true, action: 'stop', snapshot: stoppedHermesSnapshot });
    restartHermesRuntimeMock.mockResolvedValue({ success: true, action: 'restart', snapshot: runningHermesSnapshot });
    getHermesClawLocalStatusMock.mockResolvedValue({
      layout: {
        rootDir: 'C:\\Users\\Test\\AppData\\Roaming\\HermesClaw\\HermesClaw',
        packagedBaselineDir: 'D:\\HermesClaw\\node_modules\\@hermesclaw',
        baselineRuntimesDir: 'C:\\Users\\Test\\AppData\\Roaming\\HermesClaw\\HermesClaw\\runtimes\\baseline',
        userRuntimesDir: 'C:\\Users\\Test\\AppData\\Roaming\\HermesClaw\\HermesClaw\\runtimes\\user',
        runtimeStateDir: 'C:\\Users\\Test\\AppData\\Roaming\\HermesClaw\\HermesClaw\\runtime-state',
        activeRuntimesPath: 'C:\\Users\\Test\\AppData\\Roaming\\HermesClaw\\HermesClaw\\runtime-state\\active-runtimes.json',
        compatibilityMatrixPath: 'C:\\Users\\Test\\AppData\\Roaming\\HermesClaw\\HermesClaw\\runtime-state\\compatibility-matrix.json',
        installHistoryPath: 'C:\\Users\\Test\\AppData\\Roaming\\HermesClaw\\HermesClaw\\runtime-state\\install-history.json',
        sharedConfigDir: 'C:\\Users\\Test\\AppData\\Roaming\\HermesClaw\\HermesClaw\\shared-config',
        manifestPath: 'C:\\Users\\Test\\AppData\\Roaming\\HermesClaw\\HermesClaw\\runtime-manifest.json',
        backupsDir: 'C:\\Users\\Test\\AppData\\Roaming\\HermesClaw\\HermesClaw\\backups',
        logsDir: 'C:\\Users\\Test\\AppData\\Roaming\\HermesClaw\\HermesClaw\\logs',
        cacheDir: 'C:\\Users\\Test\\AppData\\Roaming\\HermesClaw\\HermesClaw\\cache',
      },
      manifest: {
        schemaVersion: 1,
        activeChannel: 'stable',
        channels: {
          stable: {
            version: '0.9.0',
            runtimeDir: 'C:\\Users\\Test\\AppData\\Roaming\\HermesClaw\\HermesClaw\\runtimes\\user\\stable\\0.9.0',
            updatedAt: 1,
          },
        },
        rollbackStack: [],
      },
      runtimeState: {
        schemaVersion: 1,
        runtimes: {
          hermes: {
            runtime: 'hermes',
            channel: 'stable',
            version: '0.9.0',
            runtimeDir: 'C:\\Users\\Test\\AppData\\Roaming\\HermesClaw\\HermesClaw\\runtimes\\user\\hermes\\0.9.0',
            status: 'ready',
            lastKnownGoodVersion: '0.9.0',
            lastKnownGoodRuntimeDir: 'C:\\Users\\Test\\AppData\\Roaming\\HermesClaw\\HermesClaw\\runtimes\\user\\hermes\\0.9.0',
            updatedAt: 1,
          },
        },
      },
      compatibilityMatrix: {
        schemaVersion: 1,
        hermes: {
          latestVersion: '1.0.0',
          versions: [{ version: '1.0.0', channel: 'stable' }],
        },
        updatedAt: 1,
      },
      installHistory: {
        schemaVersion: 1,
        entries: [],
      },
      installStatus: {
        installed: true,
        installPath: 'C:\\Users\\Test\\.hermes',
        version: '0.9.0',
      },
      bridge: {
        enabled: true,
        attached: false,
        hermesInstalled: true,
        hermesHealthy: false,
        openclawRecognized: false,
        error: 'awaiting attach',
      },
    });
    getHermesClawSharedConfigMock.mockResolvedValue({
      schemaVersion: 1,
      skills: [
        {
          id: 'shared-skill',
          name: 'Shared Skill',
          runtimeSupport: ['both'],
        },
      ],
      agents: [],
      rules: [],
      providers: [{ id: 'provider:main', provider: 'openai', configRef: 'keychain:openai' }],
      tools: [{ id: 'shell-tool', command: 'shell', runtimeSupport: ['both'], permissions: ['process.exec'] }],
      hooks: [{ id: 'session-start', event: 'session:start', command: 'hooks/session-start.js', runtimeSupport: ['both'] }],
      updatedAt: 1,
    });
    runHermesClawDoctorMock.mockResolvedValue({
      ok: false,
      checkedAt: 1,
      reportPath: 'C:\\HermesClaw\\HermesClaw\\logs\\hermesclaw-doctor-1.json',
      repairPlan: ['Install Python or configure Hermes runtime'],
      checks: [
        { id: 'runtime-directories', status: 'pass', label: 'Runtime directories' },
        { id: 'python', status: 'warn', label: 'Python runtime', detail: 'not found' },
      ],
    });
    repairHermesClawInstallationMock.mockResolvedValue({
      success: true,
      repaired: ['shared-config:openclaw-adapter.json', 'logs-directory'],
      doctor: {
        ok: true,
        checkedAt: 2,
        reportPath: 'C:\\HermesClaw\\HermesClaw\\logs\\hermesclaw-doctor-2.json',
        repairPlan: [],
        checks: [
          { id: 'repair', status: 'pass', label: 'Repair readiness' },
          { id: 'sync-status', status: 'pass', label: 'Shared config sync status' },
        ],
      },
    });
    openHermesClawLogsLocationMock.mockResolvedValue({
      success: true,
      dir: 'C:\\HermesClaw\\HermesClaw\\logs',
    });
    checkHermesClawUpdateMock.mockResolvedValue({
      channel: 'stable',
      currentVersion: '0.9.0',
      latestVersion: '1.0.0',
      updateAvailable: true,
    });
    applyHermesClawUpdateMock.mockResolvedValue({
      success: true,
      channel: 'stable',
      version: '1.0.0',
      backupId: 'backup-1',
    });
    rollbackHermesClawRuntimeMock.mockResolvedValue({
      success: true,
      restoredVersion: '0.9.0',
      backupId: 'backup-1',
    });
    syncHermesClawSharedConfigMock.mockResolvedValue({
      dryRun: true,
      scope: 'manual',
      changes: [{ type: 'create', path: 'shared-config/registry.json' }],
      log: ['Dry-run completed'],
    });

    hostApiFetchMock.mockImplementation((path: string) => {
      if (path === '/api/gateway/control-ui') {
        return Promise.resolve({ success: false });
      }

      return Promise.resolve({});
    });
  });

  it('renders runtime mode, installed runtimes, per-runtime status, and bridge state from runtime status', async () => {
    render(<Settings />);
    fireEvent.click(screen.getByText('Runtime'));

    await waitFor(() => {
      expect(getRuntimeStatusMock).toHaveBeenCalled();
    });

    expect(await screen.findByTestId('settings-runtime-panel')).toBeInTheDocument();
    expect(screen.getByTestId('settings-runtime-mode-value')).toHaveTextContent(
      'gateway.runtimeModeOptions.openclawWithHermesAgent',
    );
    expect(screen.getByTestId('settings-runtime-hint')).toHaveTextContent(
      'gateway.runtimeModeHints.openclawWithHermesAgent',
    );
    expect(screen.getByTestId('settings-installed-runtime-openclaw')).toBeInTheDocument();
    expect(screen.getByTestId('settings-installed-runtime-hermes')).toBeInTheDocument();
    expect(screen.getByTestId('settings-runtime-bridge-badge')).toHaveTextContent(
      'gateway.bridgeStates.detached',
    );
    expect(screen.getByTestId('settings-runtime-entry-openclaw')).toHaveTextContent('gateway.runtimeLabels.openclaw');
    expect(screen.getByTestId('settings-runtime-entry-openclaw')).toHaveTextContent('common:running');
    expect(screen.getByTestId('settings-runtime-entry-openclaw')).toHaveTextContent('gateway.runtimeHealthStates.healthy');
    expect(screen.getByTestId('settings-runtime-entry-openclaw')).toHaveTextContent('1.2.3');
    expect(screen.getByTestId('settings-runtime-entry-openclaw')).toHaveTextContent('http://127.0.0.1:18789');
    expect(screen.getByTestId('settings-runtime-openclaw-start-button')).toBeDisabled();
    expect(screen.getByTestId('settings-runtime-openclaw-stop-button')).toBeEnabled();
    expect(screen.getByTestId('settings-runtime-openclaw-restart-button')).toBeEnabled();
    expect(screen.getByTestId('settings-runtime-entry-hermes')).toHaveTextContent('gateway.runtimeLabels.hermes');
    expect(screen.getByTestId('settings-runtime-entry-hermes')).toHaveTextContent('common:stopped');
    expect(screen.getByTestId('settings-runtime-entry-hermes')).toHaveTextContent('gateway.runtimeHealthStates.degraded');
    expect(screen.getByTestId('settings-runtime-entry-hermes')).toHaveTextContent('Hermes home directory was not found at ~/.hermes');
    expect(screen.getByTestId('settings-runtime-hermes-start-button')).toBeEnabled();
    expect(screen.getByTestId('settings-runtime-hermes-stop-button')).toBeDisabled();
    expect(screen.getByTestId('settings-runtime-hermes-restart-button')).toBeEnabled();
    expect(screen.getByTestId('settings-runtime-bridge-error')).toHaveTextContent('awaiting attach');
    expect(screen.getByTestId('settings-runtime-config-panel')).toBeInTheDocument();
    fireEvent.click(screen.getByText('HermesClaw Integration'));
    expect(screen.getByTestId('settings-hermesclaw-panel')).toBeInTheDocument();
    expect(screen.getByTestId('settings-hermesclaw-channel')).toHaveTextContent('stable');
    expect(screen.getByTestId('settings-hermesclaw-version')).toHaveTextContent('0.9.0');
    expect(screen.getByTestId('settings-hermesclaw-shared-config-count')).toHaveTextContent('4 entries');
    expect(screen.getByTestId('settings-hermesclaw-install-status')).toHaveTextContent('Installed');
  });

  it('refreshes runtime status when the refresh button is clicked', async () => {
    render(<Settings />);
    fireEvent.click(screen.getByText('Runtime'));

    await waitFor(() => {
      expect(getRuntimeStatusMock).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByTestId('settings-runtime-refresh-button'));

    await waitFor(() => {
      expect(getRuntimeStatusMock).toHaveBeenCalledTimes(2);
    });
  });

  it('refreshes runtime status when gatewayReady changes while gateway state stays running', async () => {
    const { rerender } = render(<Settings />);
    fireEvent.click(screen.getByText('Runtime'));

    await waitFor(() => {
      expect(getRuntimeStatusMock).toHaveBeenCalledTimes(1);
    });

    gatewayState.status = { state: 'running', port: 18789, gatewayReady: true };
    rerender(<Settings />);
    fireEvent.click(screen.getByText('Runtime'));

    await waitFor(() => {
      expect(getRuntimeStatusMock).toHaveBeenCalledTimes(2);
    });
  });

  it('attaches the bridge and refreshes runtime status from the settings panel', async () => {
    let runtimeStatusCallCount = 0;

    getRuntimeStatusMock.mockImplementation(() => {
        runtimeStatusCallCount += 1;
        return Promise.resolve({
          runtime: {
            installChoice: 'both',
            mode: 'openclaw-with-hermes-agent',
            installedKinds: ['openclaw', 'hermes'],
            lastStandaloneRuntime: 'openclaw',
          },
          bridge: runtimeStatusCallCount > 1 ? {
            enabled: true,
            attached: true,
            hermesInstalled: true,
            hermesHealthy: true,
            openclawRecognized: true,
            error: undefined,
          } : {
            enabled: true,
            attached: false,
            hermesInstalled: true,
            hermesHealthy: false,
            openclawRecognized: false,
            error: 'awaiting attach',
          },
          runtimes: [],
        });
    });

    attachHermesOpenClawBridgeMock.mockResolvedValue(undefined);

    render(<Settings />);
    fireEvent.click(screen.getByText('Runtime'));

    await waitFor(() => {
      expect(getRuntimeStatusMock).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByTestId('settings-runtime-bridge-attach-button'));

    await waitFor(() => {
      expect(attachHermesOpenClawBridgeMock).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(getRuntimeStatusMock).toHaveBeenCalledTimes(2);
    });

    expect(screen.getByTestId('settings-runtime-bridge-badge')).toHaveTextContent('gateway.bridgeStates.attached');
    expect(screen.queryByTestId('settings-runtime-bridge-error')).toBeNull();
    expect(toastSuccessMock).toHaveBeenCalledWith('gateway.bridgeAttachSucceeded');
  });

  it('rechecks the bridge and refreshes runtime status from the settings panel', async () => {
    let runtimeStatusCallCount = 0;

    getRuntimeStatusMock.mockImplementation(() => {
        runtimeStatusCallCount += 1;
        return Promise.resolve({
          runtime: {
            installChoice: 'both',
            mode: 'openclaw-with-hermes-agent',
            installedKinds: ['openclaw', 'hermes'],
            lastStandaloneRuntime: 'openclaw',
          },
          bridge: runtimeStatusCallCount > 1 ? {
            enabled: true,
            attached: true,
            hermesInstalled: true,
            hermesHealthy: false,
            openclawRecognized: false,
            error: 'OpenClaw bridge reload/recognition is still pending',
          } : {
            enabled: true,
            attached: true,
            hermesInstalled: true,
            hermesHealthy: true,
            openclawRecognized: true,
            error: undefined,
          },
          runtimes: [],
        });
    });

    recheckHermesOpenClawBridgeMock.mockResolvedValue(undefined);

    render(<Settings />);
    fireEvent.click(screen.getByText('Runtime'));

    await waitFor(() => {
      expect(getRuntimeStatusMock).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByTestId('settings-runtime-bridge-recheck-button'));

    await waitFor(() => {
      expect(recheckHermesOpenClawBridgeMock).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(getRuntimeStatusMock).toHaveBeenCalledTimes(2);
    });

    expect(screen.getByTestId('settings-runtime-bridge-badge')).toHaveTextContent('gateway.bridgeStates.attached');
    expect(screen.getByTestId('settings-runtime-bridge-error')).toHaveTextContent(
      'OpenClaw bridge reload/recognition is still pending',
    );
    expect(toastSuccessMock).toHaveBeenCalledWith('gateway.bridgeRecheckSucceeded');
  });

  it('persists Windows Hermes runtime configuration from the settings panel', async () => {
    render(<Settings />);
    fireEvent.click(screen.getByText('Runtime'));

    await waitFor(() => {
      expect(getRuntimeStatusMock).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByText('Runtime'));

    await waitFor(() => {
      expect(screen.getByTestId('settings-runtime-mode-native')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('settings-runtime-mode-native'));
    fireEvent.change(screen.getByTestId('settings-runtime-native-path'), {
      target: { value: 'C:\\Hermes\\.hermes' },
    });
    fireEvent.change(screen.getByTestId('settings-runtime-wsl-distro'), {
      target: { value: 'Ubuntu-24.04' },
    });

    hostApiFetchMock.mockResolvedValueOnce({ success: true });

    fireEvent.click(screen.getByTestId('settings-runtime-save-button'));

    await waitFor(() => {
      expect(hostApiFetchMock).toHaveBeenCalledWith(
        '/api/settings/runtime',
        expect.objectContaining({ method: 'PUT' }),
      );
    });

    const runtimeSaveCall = hostApiFetchMock.mock.calls.find(
      ([path]) => path === '/api/settings/runtime',
    );

    expect(runtimeSaveCall).toBeDefined();

    const runtimeSavePayload = JSON.parse(String(runtimeSaveCall?.[1]?.body));
    expect(runtimeSavePayload.value).toEqual(
      expect.objectContaining({
        installChoice: 'both',
        mode: 'openclaw-with-hermes-agent',
        installedKinds: ['openclaw', 'hermes'],
        windowsHermesPreferredMode: 'native',
        windowsHermesNativePath: 'C:\\Hermes\\.hermes',
        windowsHermesWslDistro: 'Ubuntu-24.04',
        lastStandaloneRuntime: 'openclaw',
      }),
    );

    await waitFor(() => {
      expect(toastSuccessMock).toHaveBeenCalledWith('gateway.runtimeWindowsConfigSaved');
    });
  });

  it('runs HermesClaw local doctor, repair, logs, update, rollback, and dry-run sync actions', async () => {
    render(<Settings />);
    fireEvent.click(screen.getByText('Advanced & Diagnostics'));

    await waitFor(() => {
      expect(getHermesClawLocalStatusMock).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByTestId('settings-hermesclaw-doctor-button'));
    await waitFor(() => {
      expect(runHermesClawDoctorMock).toHaveBeenCalled();
    });
    expect(await screen.findByTestId('settings-hermesclaw-doctor-result')).toHaveTextContent(
      'Runtime directories: pass',
    );
    expect(screen.getByTestId('settings-hermesclaw-doctor-result')).toHaveTextContent('Python runtime: warn');
    expect(screen.getByTestId('settings-hermesclaw-report-path')).toHaveTextContent(
      'C:\\HermesClaw\\HermesClaw\\logs\\hermesclaw-doctor-1.json',
    );

    fireEvent.click(screen.getByTestId('settings-hermesclaw-repair-button'));
    await waitFor(() => {
      expect(repairHermesClawInstallationMock).toHaveBeenCalled();
    });
    expect(await screen.findByTestId('settings-hermesclaw-doctor-result')).toHaveTextContent('Repair readiness: pass');
    expect(screen.getByTestId('settings-hermesclaw-report-path')).toHaveTextContent(
      'C:\\HermesClaw\\HermesClaw\\logs\\hermesclaw-doctor-2.json',
    );

    fireEvent.click(screen.getByText('HermesClaw Integration'));

    expect(screen.getByTestId('settings-hermes-agent-version')).toHaveTextContent('0.9.0');
    expect(screen.getByTestId('settings-hermes-agent-status')).toHaveTextContent(
      'Awaiting attach · awaiting attach',
    );

    fireEvent.click(screen.getByTestId('settings-hermesclaw-open-logs-button'));
    await waitFor(() => {
      expect(openHermesClawLogsLocationMock).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByText('Updates'));

    fireEvent.click(screen.getByTestId('settings-hermesclaw-update-check-button'));
    await waitFor(() => {
      expect(checkHermesClawUpdateMock).toHaveBeenCalledWith('stable');
    });
    expect(await screen.findByTestId('settings-hermesclaw-update-result')).toHaveTextContent(
      'stable: 0.9.0 → 1.0.0 update available',
    );

    fireEvent.click(screen.getByTestId('settings-hermesclaw-update-check-button'));
    await waitFor(() => {
      expect(checkHermesClawUpdateMock).toHaveBeenCalledWith('stable');
    });

    fireEvent.click(screen.getByTestId('settings-hermesclaw-update-apply-button'));
    await waitFor(() => {
      expect(applyHermesClawUpdateMock).toHaveBeenCalledWith({ channel: 'stable', version: '1.0.0' });
    });

    fireEvent.click(screen.getByTestId('settings-hermesclaw-update-apply-button'));
    await waitFor(() => {
      expect(applyHermesClawUpdateMock).toHaveBeenCalledWith({ channel: 'stable', version: '1.0.0' });
    });

    fireEvent.click(screen.getByTestId('settings-hermesclaw-rollback-button'));
    await waitFor(() => {
      expect(rollbackHermesClawRuntimeMock).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByTestId('settings-hermesclaw-rollback-button'));
    await waitFor(() => {
      expect(rollbackHermesClawRuntimeMock).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByText('HermesClaw Integration'));

    fireEvent.click(screen.getByTestId('settings-hermesclaw-sync-button'));
    await waitFor(() => {
      expect(syncHermesClawSharedConfigMock).toHaveBeenCalledWith({ dryRun: true, scope: 'manual' });
    });
    expect(await screen.findByTestId('settings-hermesclaw-sync-log')).toHaveTextContent('Dry-run completed');
  });

  it('offers runtime installation when OpenClaw or Hermes is missing', async () => {
    const missingRuntimeStatus = {
      runtime: {
        installChoice: 'both',
        mode: 'openclaw-with-hermes-agent',
        installedKinds: [],
        windowsHermesPreferredMode: 'wsl2',
        windowsHermesNativePath: '',
        windowsHermesWslDistro: 'Ubuntu-24.04',
        lastStandaloneRuntime: 'openclaw',
      },
      bridge: {
        enabled: true,
        attached: false,
        hermesInstalled: false,
        hermesHealthy: false,
        openclawRecognized: false,
      },
      runtimes: [
        { kind: 'openclaw', installed: false, running: false, healthy: false, error: 'OpenClaw runtime missing' },
        { kind: 'hermes', installed: false, running: false, healthy: false, error: 'Hermes runtime missing' },
      ],
    };
    getRuntimeStatusMock.mockResolvedValueOnce(missingRuntimeStatus);
    installRuntimeMock.mockResolvedValue({
      success: true,
      installChoice: 'both',
      steps: [
        { id: 'openclaw', kind: 'runtime', status: 'completed', label: 'Install OpenClaw runtime' },
        { id: 'hermes', kind: 'runtime', status: 'completed', label: 'Install Hermes runtime' },
        { id: 'bridge', kind: 'bridge', status: 'completed', label: 'Attach Hermes bridge' },
      ],
      snapshot: missingRuntimeStatus,
    });

    render(<Settings />);
    fireEvent.click(screen.getByText('Runtime'));

    expect(await screen.findByTestId('settings-runtime-openclaw-install-button')).toBeEnabled();
    expect(screen.getByTestId('settings-runtime-hermes-install-button')).toBeEnabled();

    fireEvent.click(screen.getByTestId('settings-runtime-openclaw-install-button'));
    await waitFor(() => {
      expect(installRuntimeMock).toHaveBeenCalledWith('both');
    });

    fireEvent.click(screen.getByTestId('settings-runtime-hermes-install-button'));
    await waitFor(() => {
      expect(installRuntimeMock).toHaveBeenCalledWith('both');
    });
  });

  it('starts, stops, and restarts Hermes from the runtime card', async () => {
    render(<Settings />);
    fireEvent.click(screen.getByText('Runtime'));

    await waitFor(() => {
      expect(screen.getByTestId('settings-runtime-hermes-start-button')).toBeEnabled();
    });

    fireEvent.click(screen.getByTestId('settings-runtime-hermes-start-button'));
    await waitFor(() => {
      expect(startHermesRuntimeMock).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByTestId('settings-runtime-entry-hermes')).toHaveTextContent('common:running');

    fireEvent.click(screen.getByTestId('settings-runtime-hermes-stop-button'));
    await waitFor(() => {
      expect(stopHermesRuntimeMock).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByTestId('settings-runtime-entry-hermes')).toHaveTextContent('common:stopped');

    fireEvent.click(screen.getByTestId('settings-runtime-hermes-restart-button'));
    await waitFor(() => {
      expect(restartHermesRuntimeMock).toHaveBeenCalledTimes(1);
    });
  });

  it('starts, stops, restarts, and surfaces OpenClaw update actions', async () => {
    render(<Settings />);
    fireEvent.click(screen.getByText('Runtime'));

    await waitFor(() => {
      expect(screen.getByTestId('settings-runtime-openclaw-stop-button')).toBeEnabled();
    });

    fireEvent.click(screen.getByTestId('settings-runtime-openclaw-stop-button'));
    await waitFor(() => {
      expect(stopOpenClawRuntimeMock).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByTestId('settings-runtime-entry-openclaw')).toHaveTextContent('common:stopped');

    fireEvent.click(screen.getByTestId('settings-runtime-openclaw-start-button'));
    await waitFor(() => {
      expect(startOpenClawRuntimeMock).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByTestId('settings-runtime-entry-openclaw')).toHaveTextContent('common:running');

    fireEvent.click(screen.getByTestId('settings-runtime-openclaw-restart-button'));
    await waitFor(() => {
      expect(restartOpenClawRuntimeMock).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByText('Updates'));

    fireEvent.click(screen.getByTestId('settings-runtime-openclaw-update-check-button'));
    await waitFor(() => {
      expect(checkOpenClawUpdateMock).toHaveBeenCalledTimes(1);
    });
    expect(await screen.findByTestId('settings-runtime-openclaw-update-result')).toHaveTextContent(
      'stable: 1.3.0 update available · risk low · Gateway runtime refresh',
    );

    fireEvent.click(screen.getByTestId('settings-runtime-openclaw-update-apply-button'));
    await waitFor(() => {
      expect(applyOpenClawUpdateMock).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByTestId('settings-runtime-openclaw-update-result')).toHaveTextContent(
      'Applied OpenClaw 1.3.0 · backup openclaw-stable-1 · Gateway reload ready',
    );

    fireEvent.click(screen.getByTestId('settings-runtime-openclaw-rollback-button'));
    await waitFor(() => {
      expect(rollbackOpenClawRuntimeMock).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByTestId('settings-runtime-openclaw-update-result')).toHaveTextContent(
      'Rolled back OpenClaw to 1.2.3 · backup openclaw-stable-1 · Gateway reload ready',
    );
  });

  it('surfaces OpenClaw update auto-rollback failures instead of showing a successful apply', async () => {
    applyOpenClawUpdateMock.mockResolvedValueOnce({
      supported: true,
      success: false,
      runtime: 'openclaw',
      action: 'apply-update',
      channel: 'stable',
      version: '1.3.0',
      backupId: 'openclaw-stable-1',
      rolledBack: true,
      restoredVersion: '1.2.3',
      rollbackBackupId: 'openclaw-stable-1',
      error: 'Gateway readiness failed after update; automatically rolled back OpenClaw to 1.2.3',
      gatewayRefreshAction: 'reload',
      gatewayReady: true,
      snapshot: {
        runtime: {
          installChoice: 'both',
          mode: 'openclaw-with-hermes-agent',
          installedKinds: ['openclaw', 'hermes'],
          lastStandaloneRuntime: 'openclaw',
        },
        bridge: {
          enabled: true,
          attached: false,
          hermesInstalled: true,
          hermesHealthy: false,
          openclawRecognized: false,
        },
        runtimes: [
          { kind: 'openclaw', installed: true, running: true, healthy: true, version: '1.2.3' },
          { kind: 'hermes', installed: true, running: false, healthy: false, version: '0.9.0' },
        ],
      },
    });

    render(<Settings />);
    fireEvent.click(screen.getByText('Updates'));

    await waitFor(() => {
      expect(screen.getByTestId('settings-runtime-openclaw-update-apply-button')).toBeEnabled();
    });

    fireEvent.click(screen.getByTestId('settings-runtime-openclaw-update-apply-button'));

    expect(await screen.findByTestId('settings-runtime-openclaw-update-result')).toHaveTextContent(
      'Gateway readiness failed after update; automatically rolled back OpenClaw to 1.2.3 · rolled back to 1.2.3',
    );
  });
});
