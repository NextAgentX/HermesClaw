/**
 * Zustand Stores Tests
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useSettingsStore } from '@/stores/settings';
import { useGatewayStore } from '@/stores/gateway';

describe('Settings Store', () => {
  beforeEach(() => {
    // Reset store to default state
    useSettingsStore.setState({
      theme: 'system',
      language: 'en',
      sidebarCollapsed: false,
      devModeUnlocked: false,
      gatewayAutoStart: true,
      gatewayPort: 18789,
      autoCheckUpdate: true,
      autoDownloadUpdate: false,
      startMinimized: false,
      launchAtStartup: false,
      updateChannel: 'stable',
      setupComplete: false,
      runtime: {
        installChoice: 'openclaw',
        mode: 'openclaw',
        installedKinds: ['openclaw'],
        windowsHermesPreferredMode: 'wsl2',
        lastStandaloneRuntime: 'openclaw',
      },
      bridge: {
        hermesAsOpenClawAgent: {
          enabled: false,
          attached: false,
        },
      },
    });
  });
  
  it('should have default values', () => {
    const state = useSettingsStore.getState();
    expect(state.theme).toBe('system');
    expect(state.sidebarCollapsed).toBe(false);
    expect(state.gatewayAutoStart).toBe(true);
    expect(state.runtime).toEqual({
      installChoice: 'openclaw',
      mode: 'openclaw',
      installedKinds: ['openclaw'],
      windowsHermesPreferredMode: 'wsl2',
      lastStandaloneRuntime: 'openclaw',
    });
    expect(state.bridge).toEqual({
      hermesAsOpenClawAgent: {
        enabled: false,
        attached: false,
      },
    });
  });

  it('should hydrate runtime and bridge settings from host api init', async () => {
    const invoke = vi.mocked(window.electron.ipcRenderer.invoke);
    invoke.mockResolvedValueOnce({
      ok: true,
      data: {
        status: 200,
        ok: true,
        json: {
          theme: 'dark',
          language: 'ja',
          runtime: {
            installChoice: 'both',
            mode: 'openclaw-with-hermes-agent',
            installedKinds: ['openclaw', 'hermes'],
            lastStandaloneRuntime: 'openclaw',
            windowsHermesPreferredMode: 'native',
            windowsHermesNativePath: 'C:\\Hermes\\.hermes',
            windowsHermesWslDistro: 'Ubuntu',
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
        },
      },
    });

    await useSettingsStore.getState().init();

    const state = useSettingsStore.getState();
    expect(state.theme).toBe('dark');
    expect(state.language).toBe('ja');
    expect(state.runtime).toEqual({
      installChoice: 'both',
      mode: 'openclaw-with-hermes-agent',
      installedKinds: ['openclaw', 'hermes'],
      lastStandaloneRuntime: 'openclaw',
      windowsHermesPreferredMode: 'native',
      windowsHermesNativePath: 'C:\\Hermes\\.hermes',
      windowsHermesWslDistro: 'Ubuntu',
    });
    expect(state.bridge).toEqual({
      hermesAsOpenClawAgent: {
        enabled: true,
        attached: true,
        hermesInstalled: true,
        hermesHealthy: true,
        openclawRecognized: true,
        reasonCode: undefined,
        lastSyncAt: 123,
      },
    });
    expect(invoke).toHaveBeenCalledWith(
      'hostapi:fetch',
      expect.objectContaining({
        path: '/api/settings',
        method: 'GET',
      }),
    );
  });
  
  it('should update theme', () => {
    const { setTheme } = useSettingsStore.getState();
    setTheme('dark');
    expect(useSettingsStore.getState().theme).toBe('dark');
  });
  
  it('should toggle sidebar collapsed state', () => {
    const { setSidebarCollapsed } = useSettingsStore.getState();
    setSidebarCollapsed(true);
    expect(useSettingsStore.getState().sidebarCollapsed).toBe(true);
  });
  
  it('should unlock dev mode', () => {
    const invoke = vi.mocked(window.electron.ipcRenderer.invoke);
    invoke.mockResolvedValueOnce({
      ok: true,
      data: {
        status: 200,
        ok: true,
        json: { success: true },
      },
    });

    const { setDevModeUnlocked } = useSettingsStore.getState();
    setDevModeUnlocked(true);

    expect(useSettingsStore.getState().devModeUnlocked).toBe(true);
    expect(invoke).toHaveBeenCalledWith(
      'hostapi:fetch',
      expect.objectContaining({
        path: '/api/settings/devModeUnlocked',
        method: 'PUT',
      }),
    );
  });

  it('should persist launch-at-startup setting through host api', () => {
    const invoke = vi.mocked(window.electron.ipcRenderer.invoke);
    invoke.mockResolvedValueOnce({
      ok: true,
      data: {
        status: 200,
        ok: true,
        json: { success: true },
      },
    });

    const { setLaunchAtStartup } = useSettingsStore.getState();
    setLaunchAtStartup(true);

    expect(useSettingsStore.getState().launchAtStartup).toBe(true);
    expect(invoke).toHaveBeenCalledWith(
      'hostapi:fetch',
      expect.objectContaining({
        path: '/api/settings/launchAtStartup',
        method: 'PUT',
      }),
    );
  });
});

describe('Gateway Store', () => {
  beforeEach(() => {
    // Reset store
    useGatewayStore.setState({
      status: { state: 'stopped', port: 18789 },
      isInitialized: false,
    });
  });
  
  it('should have default status', () => {
    const state = useGatewayStore.getState();
    expect(state.status.state).toBe('stopped');
    expect(state.status.port).toBe(18789);
  });
  
  it('should update status', () => {
    const { setStatus } = useGatewayStore.getState();
    setStatus({ state: 'running', port: 18789, pid: 12345 });
    
    const state = useGatewayStore.getState();
    expect(state.status.state).toBe('running');
    expect(state.status.pid).toBe(12345);
  });

  it('should proxy gateway rpc through ipc', async () => {
    const invoke = vi.mocked(window.electron.ipcRenderer.invoke);
    invoke.mockResolvedValueOnce({ success: true, result: { ok: true } });

    const result = await useGatewayStore.getState().rpc<{ ok: boolean }>('chat.history', { limit: 10 }, 5000);

    expect(result.ok).toBe(true);
    expect(invoke).toHaveBeenCalledWith('gateway:rpc', 'chat.history', { limit: 10 }, 5000);
  });
});
