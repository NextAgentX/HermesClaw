import type { ElectronApplication } from '@playwright/test';
import { completeSetup, expect, test } from './fixtures/electron';

async function installRuntimeBridgeMocks(app: ElectronApplication): Promise<void> {
  await app.evaluate(async ({ app: _app }) => {
    const { ipcMain } = process.mainModule!.require('electron') as typeof import('electron');

    let runtime = {
      installChoice: 'both',
      mode: 'openclaw-with-hermes-agent',
      installedKinds: ['openclaw', 'hermes'],
      windowsHermesPreferredMode: 'wsl2',
      windowsHermesNativePath: '',
      windowsHermesWslDistro: 'Ubuntu-24.04',
      lastStandaloneRuntime: 'openclaw',
    };

    let bridge = {
      enabled: true,
      attached: false,
      hermesInstalled: true,
      hermesHealthy: false,
      openclawRecognized: false,
      error: 'awaiting attach',
    };
    let openClawRuntime = {
      running: true,
      healthy: true,
      endpoint: 'http://127.0.0.1:18789' as string | undefined,
      error: undefined as string | undefined,
    };
    let hermesRuntime = {
      running: false,
      healthy: false,
      endpoint: undefined as string | undefined,
      error: 'Hermes home directory was not found at ~/.hermes' as string | undefined,
    };
    let openClawApplyAttempts = 0;

    const hermesClawStatus = {
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
      bridge,
    };

    const hermesClawSharedConfig = {
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
    };

    const buildHostApiResponse = (json: unknown) => ({
      ok: true,
      data: {
        status: 200,
        ok: true,
        json,
      },
    });
    const buildRuntimeStatus = () => ({
      runtime,
      bridge,
      runtimes: [
        {
          kind: 'openclaw',
          installed: true,
          running: openClawRuntime.running,
          healthy: openClawRuntime.healthy,
          version: '1.2.3',
          endpoint: openClawRuntime.endpoint,
          error: openClawRuntime.error,
        },
        {
          kind: 'hermes',
          installed: true,
          running: hermesRuntime.running,
          healthy: hermesRuntime.healthy,
          version: '0.9.0',
          endpoint: hermesRuntime.endpoint,
          error: hermesRuntime.error,
        },
      ],
    });

    ipcMain.removeHandler('hostapi:fetch');
    ipcMain.handle('hostapi:fetch', async (_event: unknown, request: { path?: string; method?: string; body?: string }) => {
      const path = request?.path ?? '';
      const method = request?.method ?? 'GET';

      if (path === '/api/runtime/status' && method === 'GET') {
        return buildHostApiResponse(buildRuntimeStatus());
      }

      if (path === '/api/gateway/control-ui' && method === 'GET') {
        return buildHostApiResponse({ success: false });
      }

      if (path === '/api/gateway/start' && method === 'POST') {
        openClawRuntime = {
          running: true,
          healthy: true,
          endpoint: 'http://127.0.0.1:18789',
          error: undefined,
        };
        return buildHostApiResponse({ success: true });
      }

      if (path === '/api/gateway/stop' && method === 'POST') {
        openClawRuntime = {
          running: false,
          healthy: false,
          endpoint: undefined,
          error: 'OpenClaw runtime is stopped',
        };
        return buildHostApiResponse({ success: true });
      }

      if (path === '/api/gateway/restart' && method === 'POST') {
        openClawRuntime = {
          running: true,
          healthy: true,
          endpoint: 'http://127.0.0.1:18789',
          error: undefined,
        };
        return buildHostApiResponse({ success: true });
      }

      if (path === '/api/runtime/openclaw/update/check' && method === 'POST') {
        return buildHostApiResponse({
          supported: true,
          runtime: 'openclaw',
          action: 'check-update',
          channel: 'stable',
          currentVersion: '1.2.3',
          latestVersion: '1.3.0',
          updateAvailable: true,
          releaseNotes: 'Gateway runtime refresh',
          risk: 'low',
          snapshot: buildRuntimeStatus(),
        });
      }

      if (path === '/api/runtime/openclaw/update/apply' && method === 'POST') {
        openClawApplyAttempts += 1;
        if (openClawApplyAttempts === 1) {
          return buildHostApiResponse({
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
            gatewayRefreshAction: 'reload',
            gatewayReady: true,
            gatewayHealth: { ok: true, uptime: 1 },
            error: 'Gateway readiness failed after update; automatically rolled back OpenClaw to 1.2.3',
            snapshot: buildRuntimeStatus(),
          });
        }

        return buildHostApiResponse({
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
          snapshot: buildRuntimeStatus(),
        });
      }

      if (path === '/api/runtime/openclaw/rollback' && method === 'POST') {
        return buildHostApiResponse({
          supported: true,
          success: true,
          runtime: 'openclaw',
          action: 'rollback',
          restoredVersion: '1.2.3',
          backupId: 'openclaw-stable-1',
          gatewayRefreshAction: 'reload',
          gatewayReady: true,
          gatewayHealth: { ok: true, uptime: 1 },
          snapshot: buildRuntimeStatus(),
        });
      }

      if (path === '/api/runtime/hermesclaw/status' && method === 'GET') {
        return buildHostApiResponse({
          ...hermesClawStatus,
          bridge,
        });
      }

      if (path === '/api/runtime/hermesclaw/shared-config' && method === 'GET') {
        return buildHostApiResponse(hermesClawSharedConfig);
      }

      if (path === '/api/runtime/hermesclaw/doctor' && method === 'POST') {
        return buildHostApiResponse({
          ok: true,
          checkedAt: 1,
          reportPath: 'C:\\Users\\Test\\AppData\\Roaming\\HermesClaw\\HermesClaw\\logs\\hermesclaw-doctor-1.json',
          repairPlan: [],
          checks: [
            { id: 'runtime-directories', status: 'pass', label: 'Runtime directories' },
            { id: 'python', status: 'pass', label: 'Python runtime', detail: 'Python 3.12.0' },
          ],
        });
      }

      if (path === '/api/runtime/hermesclaw/repair' && method === 'POST') {
        return buildHostApiResponse({
          success: true,
          repaired: ['shared-config:openclaw-adapter.json', 'logs-directory'],
          doctor: {
            ok: true,
            checkedAt: 2,
            reportPath: 'C:\\Users\\Test\\AppData\\Roaming\\HermesClaw\\HermesClaw\\logs\\hermesclaw-doctor-2.json',
            repairPlan: [],
            checks: [
              { id: 'repair', status: 'pass', label: 'Repair readiness' },
              { id: 'sync-status', status: 'pass', label: 'Shared config sync status' },
            ],
          },
        });
      }

      if (path === '/api/runtime/hermesclaw/logs' && method === 'GET') {
        return buildHostApiResponse({ dir: 'C:\\Users\\Test\\AppData\\Roaming\\HermesClaw\\HermesClaw\\logs' });
      }

      if (path === '/api/runtime/hermesclaw/logs/open' && method === 'POST') {
        return buildHostApiResponse({
          success: true,
          dir: 'C:\\Users\\Test\\AppData\\Roaming\\HermesClaw\\HermesClaw\\logs',
        });
      }

      if (path === '/api/runtime/hermesclaw/update/check' && method === 'POST') {
        return buildHostApiResponse({
          channel: 'stable',
          currentVersion: '0.9.0',
          latestVersion: '1.0.0',
          updateAvailable: true,
        });
      }

      if (path === '/api/runtime/hermesclaw/update/apply' && method === 'POST') {
        return buildHostApiResponse({
          success: true,
          channel: 'stable',
          version: '1.0.0',
          backupId: 'backup-1',
        });
      }

      if (path === '/api/runtime/hermesclaw/rollback' && method === 'POST') {
        return buildHostApiResponse({
          success: true,
          restoredVersion: '0.9.0',
          backupId: 'backup-1',
        });
      }

      if (path === '/api/runtime/hermesclaw/shared-config/sync' && method === 'POST') {
        return buildHostApiResponse({
          dryRun: true,
          scope: 'manual',
          changes: [],
          log: ['Dry-run completed'],
        });
      }

      if (path === '/api/runtime/hermes/start' && method === 'POST') {
        hermesRuntime = {
          running: true,
          healthy: true,
          endpoint: 'http://127.0.0.1:8642',
          error: undefined,
        };
        return buildHostApiResponse({ success: true, action: 'start', snapshot: buildRuntimeStatus() });
      }

      if (path === '/api/runtime/hermes/stop' && method === 'POST') {
        hermesRuntime = {
          running: false,
          healthy: false,
          endpoint: undefined,
          error: 'Hermes runtime is stopped',
        };
        return buildHostApiResponse({ success: true, action: 'stop', snapshot: buildRuntimeStatus() });
      }

      if (path === '/api/runtime/hermes/restart' && method === 'POST') {
        hermesRuntime = {
          running: true,
          healthy: true,
          endpoint: 'http://127.0.0.1:8642',
          error: undefined,
        };
        return buildHostApiResponse({ success: true, action: 'restart', snapshot: buildRuntimeStatus() });
      }

      if (path === '/api/settings/runtime' && method === 'PUT') {
        const parsed = request?.body ? JSON.parse(request.body) : {};
        runtime = {
          ...runtime,
          ...(parsed?.value ?? {}),
        };

        return buildHostApiResponse({ success: true });
      }

      if (path === '/api/bridges/hermes-openclaw/attach' && method === 'POST') {
        bridge = {
          enabled: true,
          attached: true,
          hermesInstalled: true,
          hermesHealthy: true,
          openclawRecognized: true,
          error: undefined,
        };

        return buildHostApiResponse({
          success: true,
          bridge,
        });
      }

      if (path === '/api/bridges/hermes-openclaw/recheck' && method === 'POST') {
        bridge = {
          enabled: true,
          attached: true,
          hermesInstalled: true,
          hermesHealthy: false,
          openclawRecognized: false,
          error: 'OpenClaw bridge reload/recognition is still pending',
        };

        return buildHostApiResponse({
          success: true,
          bridge: {
            ...bridge,
            reasonCode: 'openclaw_recognition_pending',
          },
        });
      }

      return buildHostApiResponse({});
    });
  });
}

test.describe('Settings runtime bridge actions', () => {
  test('surfaces degraded both-mode bridge startup while OpenClaw remains available', async ({ electronApp, page }) => {
    await installRuntimeBridgeMocks(electronApp);
    await completeSetup(page);

    await page.getByTestId('sidebar-nav-settings').click();
    await expect(page.getByTestId('settings-page')).toBeVisible();
    await expect(page.getByTestId('settings-runtime-panel')).toBeVisible();
    await expect(page.getByTestId('settings-hermesclaw-panel')).toBeVisible();

    await expect(page.getByTestId('settings-runtime-mode-value')).toContainText(/OpenClaw/i);
    await expect(page.getByTestId('settings-installed-runtime-openclaw')).toContainText('OpenClaw');
    await expect(page.getByTestId('settings-installed-runtime-hermes')).toContainText('Hermes');

    const openclawEntry = page.getByTestId('settings-runtime-entry-openclaw');
    await expect(openclawEntry).toContainText('OpenClaw');
    await expect(openclawEntry).toContainText(/running/i);
    await expect(openclawEntry).toContainText('1.2.3');
    await expect(openclawEntry).toContainText('http://127.0.0.1:18789');
    await expect(page.getByTestId('settings-runtime-openclaw-start-button')).toBeDisabled();
    await expect(page.getByTestId('settings-runtime-openclaw-stop-button')).toBeEnabled();
    await expect(page.getByTestId('settings-runtime-openclaw-restart-button')).toBeEnabled();
    await expect(page.getByTestId('settings-runtime-openclaw-update-check-button')).toBeEnabled();
    await expect(page.getByTestId('settings-runtime-openclaw-update-apply-button')).toBeEnabled();
    await expect(page.getByTestId('settings-runtime-openclaw-rollback-button')).toBeEnabled();

    await page.getByTestId('settings-runtime-openclaw-update-check-button').click();
    await expect(page.getByTestId('settings-runtime-openclaw-update-result')).toContainText('stable: 1.3.0 update available');
    await expect(page.getByTestId('settings-runtime-openclaw-update-result')).toContainText('Gateway runtime refresh');

    const bridgeBadge = page.getByTestId('settings-runtime-bridge-badge');
    const bridgeError = page.getByTestId('settings-runtime-bridge-error');
    await expect(bridgeBadge).not.toHaveText('');
    await expect(bridgeError).toContainText('awaiting attach');
    await expect(page.getByTestId('settings-runtime-bridge-attach-button')).toBeVisible();
    await expect(page.getByTestId('settings-runtime-bridge-recheck-button')).toBeVisible();
    await expect(page.getByTestId('settings-runtime-hermes-start-button')).toBeEnabled();
    await expect(page.getByTestId('settings-runtime-hermes-stop-button')).toBeDisabled();
    await expect(page.getByTestId('settings-runtime-hermes-restart-button')).toBeEnabled();
    await expect(page.getByTestId('settings-hermesclaw-channel')).toContainText('stable');
    await expect(page.getByTestId('settings-hermesclaw-version')).toContainText('0.9.0');
    await expect(page.getByTestId('settings-hermesclaw-shared-config-count')).toContainText('4 entries');
    await expect(page.getByTestId('settings-hermesclaw-repair-button')).toBeVisible();
    await expect(page.getByTestId('settings-hermesclaw-open-logs-button')).toBeVisible();
    await page.getByTestId('settings-runtime-openclaw-update-apply-button').click();
    await expect(page.getByTestId('settings-runtime-openclaw-update-result')).toContainText('automatically rolled back OpenClaw to 1.2.3');
    await page.getByTestId('settings-hermesclaw-repair-button').click();
    await expect(page.getByTestId('settings-hermesclaw-doctor-result')).toContainText('Repair readiness: pass');
    await expect(page.getByTestId('settings-hermesclaw-report-path')).toContainText('hermesclaw-doctor-2.json');
    await page.getByTestId('settings-hermesclaw-sync-button').click();
    await expect(page.getByTestId('settings-hermesclaw-sync-log')).toContainText('Dry-run completed');
    await page.getByTestId('settings-hermesclaw-open-logs-button').click();

    await page.getByTestId('sidebar-new-chat').click();
    await expect(page.getByTestId('main-layout')).toBeVisible();
  });

  test('attaches and rechecks the Hermes bridge from settings', async ({ electronApp, page }) => {
    await installRuntimeBridgeMocks(electronApp);
    await completeSetup(page);

    await page.getByTestId('sidebar-nav-settings').click();
    await expect(page.getByTestId('settings-page')).toBeVisible();
    await expect(page.getByTestId('settings-runtime-panel')).toBeVisible();
    await expect(page.getByTestId('settings-runtime-entry-openclaw')).toContainText('OpenClaw');
    await expect(page.getByTestId('settings-runtime-entry-hermes')).toContainText('Hermes');

    const bridgeBadge = page.getByTestId('settings-runtime-bridge-badge');
    const bridgeError = page.locator('[data-testid="settings-runtime-bridge-error"]');

    await expect(page.getByTestId('settings-runtime-bridge-attach-button')).toBeVisible();
    await expect(page.getByTestId('settings-runtime-bridge-recheck-button')).toBeVisible();
    await expect(bridgeError).toContainText('awaiting attach');

    const initialBadgeText = (await bridgeBadge.textContent())?.trim() ?? '';

    await page.getByTestId('settings-runtime-bridge-attach-button').click();
    await expect(bridgeError).toHaveCount(0);

    const attachedBadgeText = (await bridgeBadge.textContent())?.trim() ?? '';
    expect(attachedBadgeText).not.toBe('');
    expect(attachedBadgeText).not.toBe(initialBadgeText);

    await page.getByTestId('settings-runtime-bridge-recheck-button').click();
    await expect(bridgeError).toContainText('OpenClaw bridge reload/recognition is still pending');
    await expect(bridgeBadge).toHaveText(attachedBadgeText);
  });

  test('persists Windows Hermes runtime configuration from settings', async ({ electronApp, page }) => {
    await installRuntimeBridgeMocks(electronApp);
    await completeSetup(page);

    await page.getByTestId('sidebar-nav-settings').click();
    await expect(page.getByTestId('settings-page')).toBeVisible();
    await expect(page.getByTestId('settings-runtime-panel')).toBeVisible();
    await expect(page.getByTestId('settings-runtime-config-panel')).toBeVisible();

    await page.getByTestId('settings-runtime-mode-native').click();
    await page.getByTestId('settings-runtime-native-path').fill('C:\\Hermes\\.hermes');
    await page.getByTestId('settings-runtime-wsl-distro').fill('Ubuntu-24.04');
    await page.getByTestId('settings-runtime-save-button').click();

    await expect(page.getByTestId('settings-runtime-native-path')).toHaveValue('C:\\Hermes\\.hermes');
    await expect(page.getByTestId('settings-runtime-wsl-distro')).toHaveValue('Ubuntu-24.04');
    await expect(page.getByTestId('settings-runtime-save-button')).toBeDisabled();
  });
});
