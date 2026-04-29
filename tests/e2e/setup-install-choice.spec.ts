import type { ElectronApplication, Page } from '@playwright/test';
import { expect, installIpcMocks, test } from './fixtures/electron';

type SetupMockConfig = {
  gatewayStatus: Record<string, unknown>;
  openclawStatus: {
    packageExists: boolean;
    isBuilt: boolean;
    dir: string;
    version?: string;
  };
  platform?: 'win32' | 'darwin' | 'linux';
  windowsHermesPreferredMode?: 'native' | 'wsl2';
  windowsHermesNativePath?: string;
  windowsHermesWslDistro?: string;
};

async function installSetupMocks(app: ElectronApplication, config: SetupMockConfig): Promise<void> {
  await installIpcMocks(app, {
    gatewayStatus: config.gatewayStatus,
    hostApi: {
      '["/api/gateway/status","GET"]': {
        ok: true,
        data: {
          status: 200,
          ok: true,
          json: config.gatewayStatus,
        },
      },
      '["/api/settings","GET"]': {
        ok: true,
        data: {
          status: 200,
          ok: true,
            json: {
              runtime: {
                windowsHermesPreferredMode: config.windowsHermesPreferredMode,
                windowsHermesNativePath: config.windowsHermesNativePath,
                windowsHermesWslDistro: config.windowsHermesWslDistro,
              },
            },
        },
      },
      '["/api/runtime/install","POST"]': {
        ok: true,
        data: {
          status: 200,
          ok: true,
          json: { success: true },
        },
      },
    },
  });

  await app.evaluate(async ({ app: _app }, runtimeConfig) => {
    const { ipcMain } = process.mainModule!.require('electron') as typeof import('electron');

    const state = {
      installCalls: [] as Array<{ installChoice?: string }>,
    };
    (globalThis as Record<string, unknown>).__hermesclawSetupChoiceE2E = state;

    ipcMain.removeHandler('openclaw:status');
    ipcMain.handle('openclaw:status', async () => runtimeConfig.openclawStatus);

    ipcMain.removeHandler('app:platform');
    ipcMain.handle('app:platform', async () => runtimeConfig.platform ?? process.platform);

    ipcMain.removeHandler('wsl:list');
    ipcMain.handle('wsl:list', async () => {
      return runtimeConfig.windowsHermesWslDistro ? [runtimeConfig.windowsHermesWslDistro] : [];
    });

    ipcMain.removeHandler('app:request');
    ipcMain.handle(
      'app:request',
      async (
        _event: unknown,
        request: { id?: string; module?: string; action?: string },
      ) => {
        if (request?.module === 'app' && request?.action === 'platform') {
          return {
            id: request.id,
            ok: true,
            data: runtimeConfig.platform ?? process.platform,
          };
        }

        return {
          id: request?.id,
          ok: false,
          error: {
            code: 'APP_REQUEST_UNSUPPORTED',
            message: `APP_REQUEST_UNSUPPORTED:${request?.module ?? 'unknown'}:${request?.action ?? 'unknown'}`,
          },
        };
      },
    );

    ipcMain.removeHandler('hostapi:fetch');
    ipcMain.handle(
      'hostapi:fetch',
      async (
        _event: unknown,
        request: { path?: string; method?: string; body?: string | null },
      ) => {
        if (request?.path === '/api/runtime/install' && (request?.method ?? 'GET') === 'POST') {
          const payload = request.body ? JSON.parse(request.body) as { installChoice?: string } : {};
          state.installCalls.push(payload ?? {});
          return {
            ok: true,
            data: {
              status: 200,
              ok: true,
              json: { success: true },
            },
          };
        }

        if (request?.path === '/api/gateway/status' && (request?.method ?? 'GET') === 'GET') {
          return {
            ok: true,
            data: {
              status: 200,
              ok: true,
              json: runtimeConfig.gatewayStatus,
            },
          };
        }

        if (request?.path === '/api/settings' && (request?.method ?? 'GET') === 'GET') {
          return {
            ok: true,
            data: {
              status: 200,
              ok: true,
                json: {
                  runtime: {
                    windowsHermesPreferredMode: runtimeConfig.windowsHermesPreferredMode,
                    windowsHermesNativePath: runtimeConfig.windowsHermesNativePath,
                    windowsHermesWslDistro: runtimeConfig.windowsHermesWslDistro,
                  },
                },
            },
          };
        }

        return {
          ok: true,
          data: {
            status: 200,
            ok: true,
            json: {},
          },
        };
      },
    );
  }, config);
}

async function readInstallChoices(app: ElectronApplication): Promise<string[]> {
  return await app.evaluate(async ({ app: _app }) => {
    const state = (globalThis as Record<string, unknown>).__hermesclawSetupChoiceE2E as
      | { installCalls?: Array<{ installChoice?: string }> }
      | undefined;
    return (state?.installCalls ?? []).map((entry) => entry.installChoice ?? '');
  });
}

async function openRuntimeStep(page: Page): Promise<void> {
  await expect(page.getByTestId('setup-page')).toBeVisible();
  await page.getByTestId('setup-next-button').click();
  await expect(page.getByTestId('setup-install-choice-openclaw')).toBeVisible();
}

async function reloadIntoMockedSetup(page: Page): Promise<void> {
  await page.evaluate(() => {
    try {
      window.localStorage.removeItem('hermesclaw-settings');
      window.sessionStorage.clear();
    } catch {
      // ignore storage cleanup failures in e2e harness
    }
  });

  await page.reload();
}

async function waitForRuntimeReady(page: Page): Promise<void> {
  await expect(page.getByTestId('setup-next-button')).toBeEnabled();
}

test.describe('Setup install choice flow', () => {
  test('uses openclaw as the default install choice', async ({ electronApp, page }) => {
    await installSetupMocks(electronApp, {
      gatewayStatus: { state: 'running', port: 18789 },
      openclawStatus: {
        packageExists: true,
        isBuilt: true,
        dir: '/tmp/openclaw',
        version: '2026.4.15',
      },
      platform: 'linux',
    });

    await reloadIntoMockedSetup(page);
    await openRuntimeStep(page);

    const nextButton = page.getByTestId('setup-next-button');
    await expect(page.getByTestId('setup-install-choice-openclaw')).toHaveAttribute('aria-pressed', 'true');
    await waitForRuntimeReady(page);

    await nextButton.click();

    await expect.poll(async () => await readInstallChoices(electronApp)).toEqual(['openclaw']);
  });

  test('passes the both choice into install orchestration', async ({ electronApp, page }) => {
    await installSetupMocks(electronApp, {
      gatewayStatus: { state: 'running', port: 18789 },
      openclawStatus: {
        packageExists: true,
        isBuilt: true,
        dir: '/tmp/openclaw',
        version: '2026.4.15',
      },
      platform: 'linux',
    });

    await reloadIntoMockedSetup(page);
    await openRuntimeStep(page);

    await waitForRuntimeReady(page);
    await expect(page.getByTestId('setup-install-choice-both')).toBeEnabled();

    await page.getByTestId('setup-install-choice-both').click();
    await expect(page.getByTestId('setup-install-choice-both')).toHaveAttribute('aria-pressed', 'true');

    const nextButton = page.getByTestId('setup-next-button');
    await waitForRuntimeReady(page);
    await nextButton.click();

    await expect.poll(async () => await readInstallChoices(electronApp)).toEqual(['both']);
  });

  test('allows hermes-only selection when openclaw readiness is unavailable', async ({ electronApp, page }) => {
    await installSetupMocks(electronApp, {
      gatewayStatus: { state: 'stopped', port: 18789 },
      openclawStatus: {
        packageExists: false,
        isBuilt: false,
        dir: '/tmp/openclaw',
      },
      platform: 'linux',
    });

    await reloadIntoMockedSetup(page);
    await openRuntimeStep(page);

    const nextButton = page.getByTestId('setup-next-button');
    await expect(nextButton).toBeDisabled();
    await expect(page.getByTestId('setup-install-choice-hermes')).toBeEnabled();

    await page.getByTestId('setup-install-choice-hermes').click();
    await expect(page.getByTestId('setup-install-choice-hermes')).toHaveAttribute('aria-pressed', 'true');
    await expect(nextButton).toBeEnabled();

    await nextButton.click();

    await expect.poll(async () => await readInstallChoices(electronApp)).toEqual(['hermes']);
  });

  test('blocks hermes and both on Windows when neither native Hermes nor WSL is configured', async ({ electronApp, page }) => {
    await installSetupMocks(electronApp, {
      gatewayStatus: { state: 'running', port: 18789 },
      openclawStatus: {
        packageExists: true,
        isBuilt: true,
        dir: '/tmp/openclaw',
        version: '2026.4.15',
      },
      platform: 'win32',
    });

    await reloadIntoMockedSetup(page);
    await openRuntimeStep(page);

    await expect(page.getByTestId('setup-runtime-wsl2-notice')).toBeVisible();
    await expect(page.getByTestId('setup-install-choice-openclaw')).toBeEnabled();
    await expect(page.getByTestId('setup-install-choice-hermes')).toBeDisabled();
    await expect(page.getByTestId('setup-install-choice-both')).toBeDisabled();

    await page.getByTestId('setup-next-button').click();

    await expect.poll(async () => await readInstallChoices(electronApp)).toEqual(['openclaw']);
  });

  test('allows hermes on Windows when a native Hermes path is configured without WSL', async ({ electronApp, page }) => {
    await installSetupMocks(electronApp, {
      gatewayStatus: { state: 'stopped', port: 18789 },
      openclawStatus: {
        packageExists: false,
        isBuilt: false,
        dir: '/tmp/openclaw',
      },
      platform: 'win32',
      windowsHermesPreferredMode: 'native',
      windowsHermesNativePath: 'C:\\Hermes\\.hermes',
    });

    await reloadIntoMockedSetup(page);
    await openRuntimeStep(page);

    const nextButton = page.getByTestId('setup-next-button');
    await expect(nextButton).toBeDisabled();
    await expect(page.getByTestId('setup-runtime-wsl2-notice')).toBeVisible();
    await expect(page.getByTestId('setup-install-choice-hermes')).toBeEnabled();
    await expect(page.getByTestId('setup-install-choice-both')).toBeEnabled();

    await page.getByTestId('setup-install-choice-hermes').click();
    await expect(page.getByTestId('setup-install-choice-hermes')).toHaveAttribute('aria-pressed', 'true');
    await expect(nextButton).toBeEnabled();

    await nextButton.click();

    await expect.poll(async () => await readInstallChoices(electronApp)).toEqual(['hermes']);
  });

  test('allows hermes on Windows when a WSL distro is configured', async ({ electronApp, page }) => {
    await installSetupMocks(electronApp, {
      gatewayStatus: { state: 'stopped', port: 18789 },
      openclawStatus: {
        packageExists: false,
        isBuilt: false,
        dir: '/tmp/openclaw',
      },
      platform: 'win32',
      windowsHermesPreferredMode: 'wsl2',
      windowsHermesWslDistro: 'Ubuntu-24.04',
    });

    await reloadIntoMockedSetup(page);
    await openRuntimeStep(page);

    const nextButton = page.getByTestId('setup-next-button');
    await expect(nextButton).toBeDisabled();
    await expect(page.getByTestId('setup-runtime-wsl2-notice')).toBeVisible();
    await expect(page.getByTestId('setup-install-choice-hermes')).toBeEnabled();

    await page.getByTestId('setup-install-choice-hermes').click();
    await expect(page.getByTestId('setup-install-choice-hermes')).toHaveAttribute('aria-pressed', 'true');
    await expect(nextButton).toBeEnabled();

    await nextButton.click();

    await expect.poll(async () => await readInstallChoices(electronApp)).toEqual(['hermes']);
  });
});
