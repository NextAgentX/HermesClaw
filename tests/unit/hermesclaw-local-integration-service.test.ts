import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';

const existsSyncMock = vi.fn();
const readFileSyncMock = vi.fn();
const writeFileSyncMock = vi.fn();
const execFileSyncMock = vi.fn();
const getAllSettingsMock = vi.fn();
const getHermesInstallStatusMock = vi.fn();
const bridgeGetStatusMock = vi.fn();
const hermesRestartMock = vi.fn();
const hermesCheckHealthMock = vi.fn();
const ensureDirMock = vi.fn();
const proxyAwareFetchMock = vi.fn();

const layout = {
  rootDir: 'C:\\HermesClaw\\HermesClaw',
  packagedBaselineDir: 'D:\\HermesClaw\\node_modules\\@hermesclaw',
  baselineRuntimesDir: 'C:\\HermesClaw\\HermesClaw\\runtimes\\baseline',
  userRuntimesDir: 'C:\\HermesClaw\\HermesClaw\\runtimes\\user',
  runtimeStateDir: 'C:\\HermesClaw\\HermesClaw\\runtime-state',
  activeRuntimesPath: 'C:\\HermesClaw\\HermesClaw\\runtime-state\\active-runtimes.json',
  compatibilityMatrixPath: 'C:\\HermesClaw\\HermesClaw\\runtime-state\\compatibility-matrix.json',
  installHistoryPath: 'C:\\HermesClaw\\HermesClaw\\runtime-state\\install-history.json',
  sharedConfigDir: 'C:\\HermesClaw\\HermesClaw\\shared-config',
  manifestPath: 'C:\\HermesClaw\\HermesClaw\\runtime-manifest.json',
  backupsDir: 'C:\\HermesClaw\\HermesClaw\\backups',
  logsDir: 'C:\\HermesClaw\\HermesClaw\\logs',
  cacheDir: 'C:\\HermesClaw\\HermesClaw\\cache',
};

const files = new Map<string, unknown>();
const activeOpenClawRuntimeDir = 'C:\\HermesClaw\\HermesClaw\\runtimes\\user\\openclaw\\1.2.0';
const activeHermesRuntimeDir = 'C:\\HermesClaw\\HermesClaw\\runtimes\\user\\hermes\\0.9.0';
const activeHermesRuntimeDescriptorPath = `${activeHermesRuntimeDir}\\runtime.json`;
const sharedRegistryPath = `${layout.sharedConfigDir}\\registry.json`;
const openClawAdapterPath = `${layout.sharedConfigDir}\\openclaw-adapter.json`;
const hermesAdapterPath = `${layout.sharedConfigDir}\\hermes-adapter.json`;

function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

vi.mock('node:fs', () => ({
  default: {
    existsSync: (...args: unknown[]) => existsSyncMock(...args),
    readFileSync: (...args: unknown[]) => readFileSyncMock(...args),
    writeFileSync: (...args: unknown[]) => writeFileSyncMock(...args),
  },
  existsSync: (...args: unknown[]) => existsSyncMock(...args),
  readFileSync: (...args: unknown[]) => readFileSyncMock(...args),
  writeFileSync: (...args: unknown[]) => writeFileSyncMock(...args),
}));

vi.mock('node:child_process', () => ({
  default: {
    execFileSync: (...args: unknown[]) => execFileSyncMock(...args),
  },
  execFileSync: (...args: unknown[]) => execFileSyncMock(...args),
}));

vi.mock('@electron/utils/paths', () => ({
  ensureDir: (...args: unknown[]) => ensureDirMock(...args),
  ensureHermesClawRuntimeLayout: () => layout,
  getHermesClawRuntimeLayout: () => layout,
  getHermesEndpoint: () => 'http://127.0.0.1:8642',
  getHermesInstallStatus: (...args: unknown[]) => getHermesInstallStatusMock(...args),
}));

vi.mock('@electron/utils/store', () => ({
  getAllSettings: (...args: unknown[]) => getAllSettingsMock(...args),
}));

vi.mock('@electron/runtime/services/hermes-openclaw-bridge-service', () => ({
  HermesOpenClawBridge: class {
    getStatus() {
      return bridgeGetStatusMock();
    }
  },
}));

vi.mock('@electron/runtime/services/hermes-standalone-manager', () => ({
  getHermesStandaloneManager: () => ({
    restart: (...args: unknown[]) => hermesRestartMock(...args),
    checkHealth: (...args: unknown[]) => hermesCheckHealthMock(...args),
  }),
}));

vi.mock('@electron/utils/proxy-fetch', () => ({
  proxyAwareFetch: (...args: unknown[]) => proxyAwareFetchMock(...args),
}));

function seed(path: string, value: unknown): void {
  files.set(path, value);
}

function readWritten(path: string): unknown {
  return files.get(path);
}

function seedBaseState(): void {
  seed(layout.manifestPath, {
    schemaVersion: 1,
    activeChannel: 'stable',
    channels: {
      stable: {
        version: '0.9.0',
        runtimeDir: activeHermesRuntimeDir,
      },
    },
    rollbackStack: [],
  });
  seed(layout.activeRuntimesPath, {
    schemaVersion: 1,
    runtimes: {
      openclaw: {
        runtime: 'openclaw',
        channel: 'stable',
        version: '1.2.0',
        runtimeDir: activeOpenClawRuntimeDir,
        status: 'ready',
        lastKnownGoodVersion: '1.2.0',
        lastKnownGoodRuntimeDir: activeOpenClawRuntimeDir,
        updatedAt: 1,
      },
      hermes: {
        runtime: 'hermes',
        channel: 'stable',
        version: '0.9.0',
        runtimeDir: activeHermesRuntimeDir,
        status: 'ready',
        lastKnownGoodVersion: '0.9.0',
        lastKnownGoodRuntimeDir: activeHermesRuntimeDir,
        updatedAt: 1,
      },
    },
  });
  seed(layout.compatibilityMatrixPath, {
    schemaVersion: 1,
    hermes: {
      latestVersion: '1.0.0',
      versions: [{ version: '1.0.0', channel: 'stable' }],
    },
    openclaw: {
      latestVersion: '1.3.0',
      trustedSignatures: ['openclaw-sig-1'],
      versions: [{ version: '1.3.0', channel: 'stable', signature: 'openclaw-sig-1' }],
    },
    updatedAt: 1,
  });
  seed(layout.installHistoryPath, { schemaVersion: 1, entries: [] });
}

describe('hermesclaw local integration runtime state', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.resetModules();
    files.clear();

    existsSyncMock.mockImplementation((path: unknown) => files.has(String(path)));
    readFileSyncMock.mockImplementation((path: unknown) => JSON.stringify(files.get(String(path))));
    writeFileSyncMock.mockImplementation((path: unknown, contents: unknown) => {
      files.set(String(path), JSON.parse(String(contents)));
    });
    getAllSettingsMock.mockResolvedValue({
      runtime: {
        installedKinds: ['hermes'],
        windowsHermesPreferredMode: 'native',
      },
    });
    getHermesInstallStatusMock.mockReturnValue({ installed: true, installMode: 'native', installPath: 'C:\\Hermes', endpoint: 'http://127.0.0.1:8642' });
    bridgeGetStatusMock.mockResolvedValue({ enabled: true, attached: true, hermesInstalled: true, hermesHealthy: true, openclawRecognized: true });
    hermesRestartMock.mockResolvedValue(undefined);
    hermesCheckHealthMock.mockResolvedValue({ ok: true });
    execFileSyncMock.mockReturnValue(Buffer.from('Python 3.12.0'));
    proxyAwareFetchMock.mockResolvedValue({ ok: true, status: 200 });
  });

  it('reports available updates from compatibility matrix and records the check', async () => {
    seedBaseState();

    const { checkHermesClawUpdate } = await import('@electron/runtime/services/hermesclaw-local-integration-service');
    const result = await checkHermesClawUpdate('stable');

    expect(result).toEqual({
      channel: 'stable',
      currentVersion: '0.9.0',
      latestVersion: '1.0.0',
      updateAvailable: true,
    });
    expect(readWritten(layout.installHistoryPath)).toMatchObject({
      entries: [expect.objectContaining({ action: 'check', status: 'success', version: '1.0.0' })],
    });
  });

  it('reports available OpenClaw runtime updates from userData runtime state and records the check', async () => {
    seedBaseState();

    const { checkOpenClawRuntimeUpdate } = await import('@electron/runtime/services/hermesclaw-local-integration-service');
    const result = await checkOpenClawRuntimeUpdate('stable');

    expect(result).toEqual({
      supported: true,
      runtime: 'openclaw',
      action: 'check-update',
      channel: 'stable',
      currentVersion: '1.2.0',
      latestVersion: '1.3.0',
      updateAvailable: true,
    });
    expect(readWritten(layout.installHistoryPath)).toMatchObject({
      entries: [expect.objectContaining({ runtime: 'openclaw', action: 'check', status: 'success', version: '1.3.0' })],
    });
  });

  it('fetches a remote update manifest with release notes and risk metadata', async () => {
    seedBaseState();
    seed(layout.compatibilityMatrixPath, {
      schemaVersion: 1,
      hermes: {
        manifestUrl: 'https://updates.example/hermesclaw.json',
        trustedSignatures: ['sig-1'],
        versions: [],
      },
    });
    const payload = JSON.stringify({ runtimeDescriptor: { entry: { command: 'python', args: ['-m', 'hermes.gateway.run'] } } });
    proxyAwareFetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        schemaVersion: 1,
        hermes: {
          latestVersion: '1.1.0',
          trustedSignatures: ['sig-1'],
          versions: [{
            version: '1.1.0',
            channel: 'stable',
            downloadUrl: 'https://updates.example/hermes-1.1.0.json',
            checksum: sha256Hex(payload),
            signature: 'sig-1',
            releaseNotes: 'Remote release notes',
            risk: 'medium',
          }],
        },
      }),
    });

    const { checkHermesClawUpdate } = await import('@electron/runtime/services/hermesclaw-local-integration-service');
    const result = await checkHermesClawUpdate('stable');

    expect(proxyAwareFetchMock).toHaveBeenCalledWith('https://updates.example/hermesclaw.json', { method: 'GET' });
    expect(result).toEqual({
      channel: 'stable',
      currentVersion: '0.9.0',
      latestVersion: '1.1.0',
      updateAvailable: true,
      releaseNotes: 'Remote release notes',
      risk: 'medium',
    });
    expect(readWritten(layout.compatibilityMatrixPath)).toMatchObject({
      hermes: {
        manifestUrl: 'https://updates.example/hermesclaw.json',
        latestVersion: '1.1.0',
        trustedSignatures: ['sig-1'],
      },
    });
  });

  it('applies an update, marks the runtime ready, and records last-known-good state', async () => {
    seedBaseState();

    const { applyHermesClawUpdate } = await import('@electron/runtime/services/hermesclaw-local-integration-service');
    const result = await applyHermesClawUpdate({ channel: 'stable', version: '1.0.0' });

    expect(result).toMatchObject({ success: true, channel: 'stable', version: '1.0.0' });
    expect(hermesRestartMock).toHaveBeenCalledTimes(1);
    expect(hermesCheckHealthMock).toHaveBeenCalledTimes(1);
    expect(readWritten(layout.activeRuntimesPath)).toMatchObject({
      runtimes: {
        hermes: expect.objectContaining({
          version: '1.0.0',
          status: 'ready',
          lastKnownGoodVersion: '1.0.0',
        }),
      },
    });
    expect(readWritten(layout.installHistoryPath)).toMatchObject({
      entries: [expect.objectContaining({ action: 'apply', status: 'success', version: '1.0.0' })],
    });
  });

  it('downloads, verifies, applies, and records an OpenClaw runtime update in userData', async () => {
    seedBaseState();
    const payload = JSON.stringify({
      runtimeDescriptor: {
        schemaVersion: 1,
        version: '1.3.0',
        entry: { command: 'node', args: ['dist/gateway.js'] },
      },
    });
    seed(layout.compatibilityMatrixPath, {
      schemaVersion: 1,
      hermes: { versions: [] },
      openclaw: {
        latestVersion: '1.3.0',
        trustedSignatures: ['openclaw-sig-1'],
        versions: [{
          version: '1.3.0',
          channel: 'stable',
          downloadUrl: 'https://updates.example/openclaw-1.3.0.json',
          checksum: sha256Hex(payload),
          signature: 'openclaw-sig-1',
          releaseNotes: 'OpenClaw runtime notes',
          risk: 'medium',
        }],
      },
    });
    proxyAwareFetchMock.mockResolvedValueOnce({ ok: true, status: 200, text: async () => payload });

    const { applyOpenClawRuntimeUpdate } = await import('@electron/runtime/services/hermesclaw-local-integration-service');
    const result = await applyOpenClawRuntimeUpdate({ channel: 'stable', version: '1.3.0' });

    const runtimeDir = `${layout.userRuntimesDir}\\openclaw\\1.3.0`;
    expect(result).toMatchObject({ supported: true, success: true, runtime: 'openclaw', action: 'apply-update', channel: 'stable', version: '1.3.0' });
    expect(proxyAwareFetchMock).toHaveBeenCalledWith('https://updates.example/openclaw-1.3.0.json', { method: 'GET' });
    expect(readWritten(`${runtimeDir}\\downloaded-runtime.json`)).toEqual(JSON.parse(payload));
    expect(readWritten(`${runtimeDir}\\runtime.json`)).toMatchObject({ version: '1.3.0', entry: { command: 'node', args: ['dist/gateway.js'] } });
    expect(readWritten(layout.activeRuntimesPath)).toMatchObject({
      runtimes: {
        openclaw: expect.objectContaining({
          version: '1.3.0',
          runtimeDir,
          status: 'ready',
          lastKnownGoodVersion: '1.3.0',
        }),
        hermes: expect.objectContaining({ version: '0.9.0', status: 'ready' }),
      },
    });
    expect(readWritten(layout.installHistoryPath)).toMatchObject({
      entries: [expect.objectContaining({ runtime: 'openclaw', action: 'apply', status: 'success', version: '1.3.0' })],
    });
  });

  it('rolls OpenClaw back to the previous active userData runtime', async () => {
    seedBaseState();

    const { applyOpenClawRuntimeUpdate, rollbackOpenClawRuntime } = await import('@electron/runtime/services/hermesclaw-local-integration-service');
    const applyResult = await applyOpenClawRuntimeUpdate({ channel: 'stable', version: '1.3.0' });
    const rollbackResult = await rollbackOpenClawRuntime();
    const runtimeDir = `${layout.userRuntimesDir}\\openclaw\\1.3.0`;

    expect(applyResult).toMatchObject({ success: true, version: '1.3.0' });
    expect(readWritten(`${runtimeDir}\\runtime.json`)).toMatchObject({
      version: '1.3.0',
      entry: { command: 'node', args: ['dist/entry.js'] },
    });
    expect(rollbackResult).toMatchObject({ supported: true, success: true, runtime: 'openclaw', action: 'rollback', restoredVersion: '1.2.0' });
    expect(readWritten(layout.activeRuntimesPath)).toMatchObject({
      runtimes: {
        openclaw: expect.objectContaining({ version: '1.2.0', runtimeDir: activeOpenClawRuntimeDir, status: 'ready' }),
      },
    });
    expect(readWritten(layout.installHistoryPath)).toMatchObject({
      entries: expect.arrayContaining([
        expect.objectContaining({ runtime: 'openclaw', action: 'apply', status: 'success', version: '1.3.0' }),
        expect.objectContaining({ runtime: 'openclaw', action: 'rollback', status: 'success', version: '1.2.0' }),
      ]),
    });
  });

  it('downloads and verifies a signed Hermes runtime before health-gated apply', async () => {
    seedBaseState();
    const payload = JSON.stringify({
      runtimeDescriptor: {
        schemaVersion: 1,
        version: '1.1.0',
        entry: { command: 'python', args: ['-m', 'hermes.gateway.run'] },
      },
    });
    seed(layout.compatibilityMatrixPath, {
      schemaVersion: 1,
      hermes: {
        latestVersion: '1.1.0',
        trustedSignatures: ['sig-1'],
        versions: [{
          version: '1.1.0',
          channel: 'stable',
          downloadUrl: 'https://updates.example/hermes-1.1.0.json',
          checksum: sha256Hex(payload),
          signature: 'sig-1',
          releaseNotes: 'Remote release notes',
          risk: 'low',
        }],
      },
    });
    proxyAwareFetchMock.mockResolvedValueOnce({ ok: true, status: 200, text: async () => payload });

    const { applyHermesClawUpdate } = await import('@electron/runtime/services/hermesclaw-local-integration-service');
    const result = await applyHermesClawUpdate({ channel: 'stable', version: '1.1.0' });

    const runtimeDir = `${layout.userRuntimesDir}\\hermes\\1.1.0`;
    expect(result).toMatchObject({ success: true, channel: 'stable', version: '1.1.0' });
    expect(proxyAwareFetchMock).toHaveBeenCalledWith('https://updates.example/hermes-1.1.0.json', { method: 'GET' });
    expect(readWritten(`${runtimeDir}\\downloaded-runtime.json`)).toEqual(JSON.parse(payload));
    expect(readWritten(`${runtimeDir}\\runtime.json`)).toMatchObject({
      version: '1.1.0',
      entry: { command: 'python', args: ['-m', 'hermes.gateway.run'] },
    });
    expect(hermesRestartMock).toHaveBeenCalledTimes(1);
    expect(hermesCheckHealthMock).toHaveBeenCalledTimes(1);
  });

  it('rejects Hermes runtime updates that require a different active OpenClaw version', async () => {
    seedBaseState();
    seed(layout.compatibilityMatrixPath, {
      schemaVersion: 1,
      bridgeProtocol: 'hermesclaw.v1',
      hermes: {
        latestVersion: '1.2.0',
        versions: [{
          version: '1.2.0',
          channel: 'stable',
          compatibleOpenClaw: '>=1.3.0',
          bridgeProtocol: 'hermesclaw.v1',
        }],
      },
      openclaw: {
        latestVersion: '1.3.0',
        versions: [{ version: '1.3.0', channel: 'stable' }],
      },
    });

    const { applyHermesClawUpdate } = await import('@electron/runtime/services/hermesclaw-local-integration-service');
    await expect(applyHermesClawUpdate({ channel: 'stable', version: '1.2.0' })).rejects.toThrow('requires OpenClaw >=1.3.0');

    expect(hermesRestartMock).not.toHaveBeenCalled();
    expect(readWritten(layout.activeRuntimesPath)).toMatchObject({
      runtimes: { hermes: expect.objectContaining({ version: '0.9.0', status: 'ready' }) },
    });
  });

  it('rejects Hermes runtime updates with an incompatible bridge protocol', async () => {
    seedBaseState();
    seed(layout.compatibilityMatrixPath, {
      schemaVersion: 1,
      bridgeProtocol: 'hermesclaw.v1',
      hermes: {
        latestVersion: '1.2.0',
        versions: [{ version: '1.2.0', channel: 'stable', bridgeProtocol: 'hermesclaw.v2' }],
      },
      openclaw: { versions: [] },
    });

    const { applyHermesClawUpdate } = await import('@electron/runtime/services/hermesclaw-local-integration-service');
    await expect(applyHermesClawUpdate({ channel: 'stable', version: '1.2.0' })).rejects.toThrow('requires bridge protocol hermesclaw.v2');

    expect(hermesRestartMock).not.toHaveBeenCalled();
  });

  it('rejects downloaded Hermes runtimes with checksum mismatches before restart', async () => {
    seedBaseState();
    seed(layout.compatibilityMatrixPath, {
      schemaVersion: 1,
      hermes: {
        latestVersion: '1.1.0',
        trustedSignatures: ['sig-1'],
        versions: [{
          version: '1.1.0',
          channel: 'stable',
          downloadUrl: 'https://updates.example/hermes-1.1.0.json',
          checksum: 'not-the-real-checksum',
          signature: 'sig-1',
        }],
      },
    });
    proxyAwareFetchMock.mockResolvedValueOnce({ ok: true, status: 200, text: async () => '{"runtimeDescriptor":{}}' });

    const { applyHermesClawUpdate } = await import('@electron/runtime/services/hermesclaw-local-integration-service');
    await expect(applyHermesClawUpdate({ channel: 'stable', version: '1.1.0' })).rejects.toThrow('Checksum mismatch');

    expect(hermesRestartMock).not.toHaveBeenCalled();
    expect(readWritten(layout.activeRuntimesPath)).toMatchObject({
      runtimes: { hermes: expect.objectContaining({ version: '0.9.0', status: 'ready' }) },
    });
  });

  it('rejects downloaded Hermes runtimes without a trusted signature', async () => {
    seedBaseState();
    seed(layout.compatibilityMatrixPath, {
      schemaVersion: 1,
      hermes: {
        latestVersion: '1.1.0',
        trustedSignatures: ['sig-1'],
        versions: [{
          version: '1.1.0',
          channel: 'stable',
          downloadUrl: 'https://updates.example/hermes-1.1.0.json',
          checksum: sha256Hex('{"runtimeDescriptor":{}}'),
          signature: 'untrusted-sig',
        }],
      },
    });

    const { applyHermesClawUpdate } = await import('@electron/runtime/services/hermesclaw-local-integration-service');
    await expect(applyHermesClawUpdate({ channel: 'stable', version: '1.1.0' })).rejects.toThrow('trusted signature');

    expect(proxyAwareFetchMock).not.toHaveBeenCalledWith('https://updates.example/hermes-1.1.0.json', { method: 'GET' });
    expect(hermesRestartMock).not.toHaveBeenCalled();
  });

  it('auto-rolls back to last-known-good when updated Hermes health fails', async () => {
    seedBaseState();
    hermesCheckHealthMock
      .mockResolvedValueOnce({ ok: false, error: 'new runtime unhealthy' })
      .mockResolvedValueOnce({ ok: true });

    const { applyHermesClawUpdate } = await import('@electron/runtime/services/hermesclaw-local-integration-service');
    const result = await applyHermesClawUpdate({ channel: 'stable', version: '1.0.0' });

    expect(result).toMatchObject({
      success: false,
      rolledBack: true,
      restoredVersion: '0.9.0',
      error: 'new runtime unhealthy',
    });
    expect(hermesRestartMock).toHaveBeenCalledTimes(2);
    expect(readWritten(layout.activeRuntimesPath)).toMatchObject({
      runtimes: {
        hermes: expect.objectContaining({ version: '0.9.0', status: 'ready' }),
      },
    });
    expect(readWritten(layout.installHistoryPath)).toMatchObject({
      entries: [
        expect.objectContaining({ action: 'failed-update', status: 'failure', version: '1.0.0' }),
        expect.objectContaining({ action: 'auto-rollback', status: 'success', version: '0.9.0' }),
      ],
    });
  });

  it('marks rollback-required when rollback health check fails', async () => {
    seedBaseState();
    hermesCheckHealthMock
      .mockResolvedValueOnce({ ok: false, error: 'new runtime unhealthy' })
      .mockResolvedValueOnce({ ok: false, error: 'old runtime unhealthy' });

    const { applyHermesClawUpdate } = await import('@electron/runtime/services/hermesclaw-local-integration-service');
    const result = await applyHermesClawUpdate({ channel: 'stable', version: '1.0.0' });

    expect(result).toMatchObject({
      success: false,
      rolledBack: false,
      rollbackRequired: true,
      restoredVersion: '0.9.0',
      error: 'old runtime unhealthy',
    });
    expect(readWritten(layout.activeRuntimesPath)).toMatchObject({
      runtimes: {
        hermes: expect.objectContaining({
          version: '0.9.0',
          status: 'rollback-required',
          lastError: 'old runtime unhealthy',
        }),
      },
    });
  });

  it('dry-runs shared config adapter output for OpenClaw and Hermes', async () => {
    seed(sharedRegistryPath, {
      schemaVersion: 1,
      skills: [
        {
          id: 'dual-skill',
          name: 'Dual Skill',
          description: 'Works everywhere',
          runtimeSupport: ['both'],
          entry: { type: 'python', path: 'skills/dual.py' },
          permissions: ['fs.read'],
          schemaVersion: 1,
        },
        {
          id: 'hermes-only',
          runtimeSupport: ['hermes'],
          entry: 'skills/hermes.py',
        },
      ],
      agents: [
        {
          id: 'auto-agent',
          name: 'Auto Agent',
          providerRef: 'provider:main',
          model: 'gpt-test',
          systemPrompt: 'Be useful',
          skills: ['dual-skill', 'hermes-only'],
          rules: ['global-rule'],
          runtimePreference: 'auto',
        },
      ],
      rules: [
        { id: 'global-rule', scope: 'global', priority: 10, enabled: true, content: 'Use shared rules.' },
      ],
      providers: [
        { id: 'provider:main', provider: 'openai', configRef: 'keychain:openai', baseUrlRef: 'env:OPENAI_BASE_URL' },
      ],
      tools: [
        { id: 'shell-tool', command: 'shell', runtimeSupport: ['both'], permissions: ['process.exec'] },
      ],
      hooks: [
        { id: 'session-start', event: 'session:start', command: 'hooks/session-start.js', runtimeSupport: ['both'] },
      ],
    });

    const { syncHermesClawSharedConfig } = await import('@electron/runtime/services/hermesclaw-local-integration-service');
    const result = await syncHermesClawSharedConfig({ dryRun: true, scope: 'manual' });

    expect(result.validation.ok).toBe(true);
    expect(result.conflicts).toEqual([]);
    expect(result.changes).toEqual([
      { type: 'create', path: 'openclaw-adapter.json' },
      { type: 'create', path: 'hermes-adapter.json' },
    ]);
    expect(result.adapters.openclaw.skills).toEqual([
      expect.objectContaining({ id: 'dual-skill', plugin: { type: 'python', path: 'skills/dual.py' } }),
    ]);
    expect(result.adapters.hermes.skills).toEqual([
      expect.objectContaining({ id: 'dual-skill', entry: { type: 'python', path: 'skills/dual.py' } }),
      expect.objectContaining({ id: 'hermes-only', entry: { path: 'skills/hermes.py' } }),
    ]);
    expect(result.adapters.openclaw.agents).toEqual([
      expect.objectContaining({ id: 'auto-agent', providerRef: 'provider:main', skills: ['dual-skill'] }),
    ]);
    expect(result.adapters.hermes.agents).toEqual([
      expect.objectContaining({ id: 'auto-agent', providerRef: 'provider:main', skills: ['dual-skill', 'hermes-only'] }),
    ]);
    expect(result.adapters.openclaw.rules).toEqual([
      expect.objectContaining({ id: 'global-rule', instruction: 'Use shared rules.' }),
    ]);
    expect(result.adapters.hermes.rules).toEqual([
      expect.objectContaining({ id: 'global-rule', role: 'system', content: 'Use shared rules.' }),
    ]);
    expect(result.adapters.openclaw.providers).toEqual([
      expect.objectContaining({ id: 'provider:main', provider: 'openai', configRef: 'keychain:openai' }),
    ]);
    expect(result.adapters.hermes.providers).toEqual([
      expect.objectContaining({ id: 'provider:main', provider: 'openai', configRef: 'keychain:openai' }),
    ]);
    expect(result.adapters.openclaw.tools).toEqual([
      expect.objectContaining({ id: 'shell-tool', command: 'shell', permissions: ['process.exec'] }),
    ]);
    expect(result.adapters.hermes.tools).toEqual([
      expect.objectContaining({ id: 'shell-tool', command: 'shell', permissions: ['process.exec'] }),
    ]);
    expect(result.adapters.openclaw.hooks).toEqual([
      expect.objectContaining({ id: 'session-start', event: 'session:start', command: 'hooks/session-start.js' }),
    ]);
    expect(result.adapters.hermes.hooks).toEqual([
      expect.objectContaining({ id: 'session-start', event: 'session:start', command: 'hooks/session-start.js' }),
    ]);
    expect(readWritten(openClawAdapterPath)).toBeUndefined();
    expect(readWritten(hermesAdapterPath)).toBeUndefined();
  });

  it('writes shared config adapter files when sync is not a dry run', async () => {
    seed(sharedRegistryPath, {
      schemaVersion: 1,
      skills: [{ id: 'dual-skill', runtimeSupport: ['both'], entry: 'skills/dual.py' }],
      agents: [],
      rules: [],
    });

    const { syncHermesClawSharedConfig } = await import('@electron/runtime/services/hermesclaw-local-integration-service');
    const result = await syncHermesClawSharedConfig({ dryRun: false, scope: 'startup' });

    expect(result.scope).toBe('startup');
    expect(result.log).toEqual(['Wrote openclaw-adapter.json', 'Wrote hermes-adapter.json']);
    expect(readWritten(openClawAdapterPath)).toMatchObject({
      skills: [expect.objectContaining({ id: 'dual-skill' })],
    });
    expect(readWritten(hermesAdapterPath)).toMatchObject({
      skills: [expect.objectContaining({ id: 'dual-skill' })],
    });
  });

  it('blocks shared config sync when validation errors or conflicts exist', async () => {
    seed(sharedRegistryPath, {
      schemaVersion: 1,
      skills: [
        { id: 'dup-skill', runtimeSupport: ['openclaw'] },
        { id: 'dup-skill', runtimeSupport: ['hermes'] },
      ],
      agents: [{ id: 'agent-one', skills: ['missing-skill'], rules: ['rule-one'] }],
      rules: [
        { id: 'rule-one', scope: 'global', priority: 1, enabled: true, content: 'First' },
        { id: 'rule-two', scope: 'global', priority: 1, enabled: true, content: 'Second' },
      ],
    });

    const { syncHermesClawSharedConfig } = await import('@electron/runtime/services/hermesclaw-local-integration-service');
    const result = await syncHermesClawSharedConfig({ dryRun: false, scope: 'manual' });

    expect(result.validation.ok).toBe(false);
    expect(result.validation.issues).toEqual([
      expect.objectContaining({ code: 'agent_unknown_skill', severity: 'error' }),
    ]);
    expect(result.conflicts).toEqual([
      expect.objectContaining({ code: 'skill_duplicate_id', ids: ['dup-skill'] }),
      expect.objectContaining({ code: 'rule_priority_conflict', ids: ['rule-one', 'rule-two'] }),
    ]);
    expect(result.log.join('\n')).toContain('Blocked shared-config sync');
    expect(readWritten(openClawAdapterPath)).toBeUndefined();
    expect(readWritten(hermesAdapterPath)).toBeUndefined();
  });

  it('reports registry creation when shared config is missing', async () => {
    const { syncHermesClawSharedConfig } = await import('@electron/runtime/services/hermesclaw-local-integration-service');
    const result = await syncHermesClawSharedConfig({ dryRun: true, scope: 'repair' });

    expect(result.scope).toBe('repair');
    expect(result.changes).toEqual([
      { type: 'create', path: 'registry.json' },
      { type: 'create', path: 'openclaw-adapter.json' },
      { type: 'create', path: 'hermes-adapter.json' },
    ]);
    expect(result.validation.ok).toBe(true);
    expect(result.conflicts).toEqual([]);
  });

  it('runs a full HermesClaw doctor report with executable, port, runtime-state, compatibility, and sync checks', async () => {
    seedBaseState();
    seed(layout.rootDir, {});
    seed(layout.userRuntimesDir, {});
    seed(layout.sharedConfigDir, {});
    seed(activeHermesRuntimeDescriptorPath, {
      entry: { command: 'python', args: ['-m', 'hermes.gateway.run'] },
    });
    seed(sharedRegistryPath, {
      schemaVersion: 1,
      skills: [{ id: 'dual-skill', runtimeSupport: ['both'] }],
      agents: [],
      rules: [],
    });
    seed(openClawAdapterPath, { skills: [], agents: [], rules: [] });
    seed(hermesAdapterPath, { skills: [], agents: [], rules: [] });

    const { runHermesClawDoctor } = await import('@electron/runtime/services/hermesclaw-local-integration-service');
    const result = await runHermesClawDoctor();

    expect(result.ok).toBe(true);
    expect(result.repairPlan).toEqual([]);
    expect(result.reportPath).toContain(`${layout.logsDir}\\hermesclaw-doctor-`);
    expect(result.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'executable', status: 'pass' }),
      expect.objectContaining({ id: 'port', status: 'pass' }),
      expect.objectContaining({
        id: 'runtime-state',
        status: 'pass',
        detail: 'OpenClaw 1.2.0 is ready; Hermes 0.9.0 is ready',
      }),
      expect.objectContaining({
        id: 'compatibility',
        status: 'pass',
        detail: 'Latest OpenClaw 1.3.0; Latest Hermes 1.0.0',
      }),
      expect.objectContaining({ id: 'sync-status', status: 'pass' }),
    ]));
    expect(proxyAwareFetchMock).toHaveBeenCalledWith('http://127.0.0.1:8642/health', { method: 'GET' });
    expect(readWritten(result.reportPath)).toMatchObject({
      ok: true,
      checks: expect.arrayContaining([expect.objectContaining({ id: 'sync-status', status: 'pass' })]),
    });
  });

  it('returns repair actions when doctor finds runtime-state, compatibility, port, executable, and sync issues', async () => {
    seedBaseState();
    seed(layout.rootDir, {});
    seed(layout.userRuntimesDir, {});
    seed(layout.sharedConfigDir, {});
    seed(layout.activeRuntimesPath, {
      schemaVersion: 1,
      runtimes: {
        hermes: {
          runtime: 'hermes',
          channel: 'stable',
          version: '0.9.0',
          runtimeDir: activeHermesRuntimeDir,
          status: 'rollback-required',
          lastError: 'rollback health failed',
          updatedAt: 1,
        },
      },
    });
    seed(layout.compatibilityMatrixPath, { schemaVersion: 1, hermes: { versions: [] }, openclaw: { versions: [] } });
    seed(sharedRegistryPath, {
      schemaVersion: 1,
      skills: [{ id: 'dup-skill', runtimeSupport: ['openclaw'] }, { id: 'dup-skill', runtimeSupport: ['hermes'] }],
      agents: [{ id: 'agent-one', skills: ['missing-skill'] }],
      rules: [],
    });
    getHermesInstallStatusMock.mockReturnValueOnce({ installed: false, error: 'Hermes missing' });
    proxyAwareFetchMock.mockRejectedValueOnce(new Error('port closed'));

    const { runHermesClawDoctor } = await import('@electron/runtime/services/hermesclaw-local-integration-service');
    const result = await runHermesClawDoctor();

    expect(result.ok).toBe(false);
    expect(result.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'install-status', status: 'warn' }),
      expect.objectContaining({ id: 'executable', status: 'fail' }),
      expect.objectContaining({ id: 'port', status: 'warn' }),
      expect.objectContaining({ id: 'runtime-state', status: 'fail' }),
      expect.objectContaining({ id: 'compatibility', status: 'warn' }),
      expect.objectContaining({ id: 'sync-status', status: 'fail' }),
    ]));
    expect(result.repairPlan.length).toBeGreaterThanOrEqual(4);
    expect(result.repairPlan.join('\n')).toContain('Resolve shared config validation errors');
    expect(readWritten(result.reportPath)).toMatchObject({
      ok: false,
      repairPlan: expect.arrayContaining([expect.stringContaining('rollback or repair the active Hermes runtime')]),
    });
  });

  it('fails doctor runtime-state when OpenClaw requires rollback before Hermes startup', async () => {
    seedBaseState();
    seed(layout.rootDir, {});
    seed(layout.userRuntimesDir, {});
    seed(layout.sharedConfigDir, {});
    seed(activeHermesRuntimeDescriptorPath, {
      entry: { command: 'python', args: ['-m', 'hermes.gateway.run'] },
    });
    seed(sharedRegistryPath, { schemaVersion: 1, skills: [], agents: [], rules: [] });
    seed(openClawAdapterPath, { skills: [], agents: [], rules: [] });
    seed(hermesAdapterPath, { skills: [], agents: [], rules: [] });
    seed(layout.activeRuntimesPath, {
      schemaVersion: 1,
      runtimes: {
        openclaw: {
          runtime: 'openclaw',
          channel: 'stable',
          version: '1.2.0',
          runtimeDir: activeOpenClawRuntimeDir,
          status: 'rollback-required',
          lastError: 'gateway reload failed',
          updatedAt: 1,
        },
        hermes: {
          runtime: 'hermes',
          channel: 'stable',
          version: '0.9.0',
          runtimeDir: activeHermesRuntimeDir,
          status: 'ready',
          updatedAt: 1,
        },
      },
    });

    const { runHermesClawDoctor } = await import('@electron/runtime/services/hermesclaw-local-integration-service');
    const result = await runHermesClawDoctor();

    expect(result.ok).toBe(false);
    expect(result.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'runtime-state',
        status: 'fail',
        detail: 'OpenClaw 1.2.0 is rollback-required: gateway reload failed',
      }),
    ]));
    expect(result.repairPlan.join('\n')).toContain('Run rollback or repair the active OpenClaw runtime');
  });

  it('warns when compatibility matrix is missing OpenClaw or Hermes update metadata', async () => {
    seedBaseState();
    seed(layout.rootDir, {});
    seed(layout.userRuntimesDir, {});
    seed(layout.sharedConfigDir, {});
    seed(activeHermesRuntimeDescriptorPath, {
      entry: { command: 'python', args: ['-m', 'hermes.gateway.run'] },
    });
    seed(sharedRegistryPath, { schemaVersion: 1, skills: [], agents: [], rules: [] });
    seed(openClawAdapterPath, { skills: [], agents: [], rules: [] });
    seed(hermesAdapterPath, { skills: [], agents: [], rules: [] });
    seed(layout.compatibilityMatrixPath, {
      schemaVersion: 1,
      hermes: { latestVersion: '1.0.0', versions: [{ version: '1.0.0', channel: 'stable' }] },
      openclaw: { versions: [] },
    });

    const { runHermesClawDoctor } = await import('@electron/runtime/services/hermesclaw-local-integration-service');
    const result = await runHermesClawDoctor();

    expect(result.ok).toBe(true);
    expect(result.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'compatibility',
        status: 'warn',
        detail: 'Missing latest OpenClaw metadata for stable',
      }),
    ]));
    expect(result.repairPlan.join('\n')).toContain('Refresh or repair compatibility-matrix.json');
  });

  it('returns HermesClaw logs location and ensures the logs directory exists', async () => {
    const { getHermesClawLogsLocation } = await import('@electron/runtime/services/hermesclaw-local-integration-service');

    const location = getHermesClawLogsLocation();

    expect(location).toEqual({ dir: layout.logsDir });
    expect(ensureDirMock).toHaveBeenCalledWith(layout.logsDir);
  });

  it('repairs missing HermesClaw artifacts, writes adapters, and reruns doctor', async () => {
    seedBaseState();
    seed(layout.rootDir, {});
    seed(layout.userRuntimesDir, {});
    seed(layout.sharedConfigDir, {});
    seed(activeHermesRuntimeDescriptorPath, {
      entry: { command: 'python', args: ['-m', 'hermes.gateway.run'] },
    });
    seed(sharedRegistryPath, {
      schemaVersion: 1,
      skills: [{ id: 'dual-skill', runtimeSupport: ['both'], entry: { path: 'skills/dual.js' } }],
      agents: [],
      rules: [],
      updatedAt: 1,
    });

    const { repairHermesClawInstallation } = await import('@electron/runtime/services/hermesclaw-local-integration-service');
    const result = await repairHermesClawInstallation({ id: 'gateway' } as never);

    expect(result.success).toBe(true);
    expect(result.repaired).toEqual(expect.arrayContaining([
      'shared-config:openclaw-adapter.json',
      'shared-config:hermes-adapter.json',
      'logs-directory',
    ]));
    expect(readWritten(openClawAdapterPath)).toBeDefined();
    expect(readWritten(hermesAdapterPath)).toBeDefined();
    expect(result.doctor.reportPath).toContain(`${layout.logsDir}\\hermesclaw-doctor-`);
    expect(result.doctor.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'sync-status', status: 'pass' }),
      expect.objectContaining({ id: 'repair', status: 'pass' }),
    ]));
  });
});
