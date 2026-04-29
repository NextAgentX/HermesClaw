import { beforeEach, describe, expect, it, vi } from 'vitest';

const getAllSettingsMock = vi.fn();
const syncProxyConfigToOpenClawMock = vi.fn();
const sanitizeOpenClawConfigMock = vi.fn();
const cleanupDanglingWeChatPluginStateMock = vi.fn();
const readOpenClawConfigMock = vi.fn();
const writeOpenClawConfigMock = vi.fn();
const removePluginRegistrationMock = vi.fn();
const withConfigLockMock = vi.fn();
const listConfiguredChannelsFromConfigMock = vi.fn();
const batchSyncConfigFieldsMock = vi.fn();
const isOpenClawPresentMock = vi.fn();
const getOpenClawDirMock = vi.fn();
const getOpenClawEntryPathMock = vi.fn();
const getUvMirrorEnvMock = vi.fn();
const getDefaultProviderMock = vi.fn();
const getProviderMock = vi.fn();
const getApiKeyMock = vi.fn();

vi.mock('@electron/utils/store', () => ({
  getAllSettings: (...args: unknown[]) => getAllSettingsMock(...args),
}));

vi.mock('@electron/utils/secure-storage', () => ({
  getApiKey: (...args: unknown[]) => getApiKeyMock(...args),
  getDefaultProvider: (...args: unknown[]) => getDefaultProviderMock(...args),
  getProvider: (...args: unknown[]) => getProviderMock(...args),
}));

vi.mock('@electron/utils/provider-registry', () => ({
  getProviderEnvVar: vi.fn().mockReturnValue('OPENAI_API_KEY'),
  getKeyableProviderTypes: vi.fn().mockReturnValue([]),
}));

vi.mock('@electron/utils/paths', () => ({
  getOpenClawDir: (...args: unknown[]) => getOpenClawDirMock(...args),
  getOpenClawEntryPath: (...args: unknown[]) => getOpenClawEntryPathMock(...args),
  isOpenClawPresent: (...args: unknown[]) => isOpenClawPresentMock(...args),
}));

vi.mock('@electron/utils/uv-env', () => ({
  getUvMirrorEnv: (...args: unknown[]) => getUvMirrorEnvMock(...args),
}));

vi.mock('@electron/utils/channel-config', () => ({
  cleanupDanglingWeChatPluginState: (...args: unknown[]) => cleanupDanglingWeChatPluginStateMock(...args),
  listConfiguredChannelsFromConfig: (...args: unknown[]) => listConfiguredChannelsFromConfigMock(...args),
  readOpenClawConfig: (...args: unknown[]) => readOpenClawConfigMock(...args),
  removePluginRegistration: (...args: unknown[]) => removePluginRegistrationMock(...args),
  writeOpenClawConfig: (...args: unknown[]) => writeOpenClawConfigMock(...args),
}));

vi.mock('@electron/utils/openclaw-auth', () => ({
  sanitizeOpenClawConfig: (...args: unknown[]) => sanitizeOpenClawConfigMock(...args),
  batchSyncConfigFields: (...args: unknown[]) => batchSyncConfigFieldsMock(...args),
}));

vi.mock('@electron/utils/proxy', () => ({
  buildProxyEnv: vi.fn().mockReturnValue({}),
  resolveProxySettings: vi.fn().mockReturnValue({ httpProxy: '', httpsProxy: '', allProxy: '' }),
}));

vi.mock('@electron/utils/openclaw-proxy', () => ({
  syncProxyConfigToOpenClaw: (...args: unknown[]) => syncProxyConfigToOpenClawMock(...args),
}));

vi.mock('@electron/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@electron/utils/env-path', () => ({
  prependPathEntry: vi.fn().mockImplementation((env: Record<string, string | undefined>) => ({ env })),
}));

vi.mock('@electron/utils/plugin-install', () => ({
  copyPluginFromNodeModules: vi.fn(),
  fixupPluginManifest: vi.fn(),
  cpSyncSafe: vi.fn(),
}));

vi.mock('@electron/utils/config-mutex', () => ({
  withConfigLock: (fn: () => Promise<unknown>) => withConfigLockMock(fn),
}));

describe('config-sync', () => {
  beforeEach(() => {
    vi.resetAllMocks();

    withConfigLockMock.mockImplementation(async (fn: () => Promise<unknown>) => fn());
    syncProxyConfigToOpenClawMock.mockResolvedValue(undefined);
    sanitizeOpenClawConfigMock.mockResolvedValue(undefined);
    cleanupDanglingWeChatPluginStateMock.mockResolvedValue(undefined);
    listConfiguredChannelsFromConfigMock.mockResolvedValue([]);
    batchSyncConfigFieldsMock.mockResolvedValue(undefined);
    readOpenClawConfigMock.mockResolvedValue({});
    writeOpenClawConfigMock.mockResolvedValue(undefined);
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

    getAllSettingsMock.mockResolvedValue({
      theme: 'system',
      language: 'en',
      startMinimized: false,
      launchAtStartup: false,
      telemetryEnabled: true,
      machineId: '',
      hasReportedInstall: false,
      gatewayAutoStart: true,
      gatewayPort: 18789,
      gatewayToken: 'token',
      proxyEnabled: false,
      proxyServer: '',
      proxyHttpServer: '',
      proxyHttpsServer: '',
      proxyAllServer: '',
      proxyBypassRules: '<local>',
      updateChannel: 'stable',
      autoCheckUpdate: true,
      autoDownloadUpdate: false,
      skippedVersions: [],
      sidebarCollapsed: false,
      devModeUnlocked: false,
      selectedBundles: [],
      enabledSkills: [],
      disabledSkills: [],
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
        },
      },
    });

    isOpenClawPresentMock.mockReturnValue(true);
    getOpenClawDirMock.mockReturnValue('/tmp/openclaw');
    getOpenClawEntryPathMock.mockReturnValue('/tmp/openclaw/openclaw.mjs');
    getUvMirrorEnvMock.mockResolvedValue({});
    getDefaultProviderMock.mockResolvedValue(undefined);
    getProviderMock.mockResolvedValue(undefined);
    getApiKeyMock.mockResolvedValue(undefined);
  });

  it('removes systemd supervisor marker env vars', async () => {
    const { stripSystemdSupervisorEnv } = await import('@electron/gateway/config-sync-env');

    const env = {
      PATH: '/usr/bin:/bin',
      OPENCLAW_SYSTEMD_UNIT: 'openclaw-gateway.service',
      INVOCATION_ID: 'abc123',
      SYSTEMD_EXEC_PID: '777',
      JOURNAL_STREAM: '8:12345',
      OTHER: 'keep-me',
    };

    const result = stripSystemdSupervisorEnv(env);

    expect(result).toEqual({
      PATH: '/usr/bin:/bin',
      OTHER: 'keep-me',
    });
  });

  it('keeps unrelated variables unchanged', async () => {
    const { stripSystemdSupervisorEnv } = await import('@electron/gateway/config-sync-env');

    const env = {
      NODE_ENV: 'production',
      OPENCLAW_GATEWAY_TOKEN: 'token',
      CLAWDBOT_SKIP_CHANNELS: '0',
    };

    expect(stripSystemdSupervisorEnv(env)).toEqual(env);
  });

  it('does not mutate source env object', async () => {
    const { stripSystemdSupervisorEnv } = await import('@electron/gateway/config-sync-env');

    const env = {
      OPENCLAW_SYSTEMD_UNIT: 'openclaw-gateway.service',
      VALUE: '1',
    };
    const before = { ...env };

    const result = stripSystemdSupervisorEnv(env);

    expect(env).toEqual(before);
    expect(result).toEqual({ VALUE: '1' });
  });

  it('adds the Hermes bridge plugin config before launch in both mode', async () => {
    getAllSettingsMock.mockResolvedValue({
      ...(await getAllSettingsMock()),
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
        },
      },
    });
    readOpenClawConfigMock.mockResolvedValue({});

    const { syncGatewayConfigBeforeLaunch } = await import('@electron/gateway/config-sync');

    await syncGatewayConfigBeforeLaunch(await getAllSettingsMock());

    expect(writeOpenClawConfigMock).toHaveBeenCalledWith(expect.objectContaining({
      plugins: expect.objectContaining({
        enabled: true,
        allow: expect.arrayContaining(['hermesclaw-bridge']),
        entries: expect.objectContaining({
          'hermesclaw-bridge': expect.objectContaining({ enabled: true }),
        }),
      }),
    }));
  });

  it('removes the Hermes bridge plugin config before launch outside both mode', async () => {
    const config = {
      plugins: {
        allow: ['hermesclaw-bridge', 'hermesclaw-hermes-bridge'],
        entries: {
          'hermesclaw-bridge': { enabled: true },
          'hermesclaw-hermes-bridge': { enabled: true },
        },
      },
    };
    readOpenClawConfigMock.mockResolvedValue(config);

    const { syncGatewayConfigBeforeLaunch } = await import('@electron/gateway/config-sync');

    await syncGatewayConfigBeforeLaunch(await getAllSettingsMock());

    expect(removePluginRegistrationMock).toHaveBeenCalledWith(config, 'hermesclaw-bridge');
    expect(removePluginRegistrationMock).toHaveBeenCalledWith(config, 'hermesclaw-hermes-bridge');
    expect(writeOpenClawConfigMock).toHaveBeenCalledWith(expect.not.objectContaining({
      plugins: expect.objectContaining({
        allow: expect.arrayContaining(['hermesclaw-bridge']),
      }),
    }));
  });
});
