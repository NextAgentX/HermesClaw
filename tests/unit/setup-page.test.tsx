import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { Setup } from '../../src/pages/Setup/index';

const navigateMock = vi.fn();
const invokeIpcMock = vi.fn();
const hostApiFetchMock = vi.fn();
const installRuntimeMock = vi.fn();
const setRuntimeInstallChoiceMock = vi.fn();
const subscribeHostEventMock = vi.fn();
const toastSuccessMock = vi.fn();

const { gatewayState, settingsState, tMock } = vi.hoisted(() => ({
  gatewayState: {
    status: { state: 'running', port: 18789 },
    start: vi.fn(),
  },
  settingsState: {
    markSetupComplete: vi.fn(),
    language: 'en',
    setLanguage: vi.fn(),
    runtime: {
      installChoice: 'both' as const,
      mode: 'hermesclaw-both' as const,
      installedKinds: ['openclaw', 'hermes'] as const,
      lastStandaloneRuntime: 'hermes' as const,
      windowsHermesPreferredMode: 'wsl2' as const,
      windowsHermesNativePath: undefined as string | undefined,
      windowsHermesWslDistro: undefined as string | undefined,
    },
  },
  tMock: vi.fn((key: string) => key),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  },
}));

vi.mock('@/components/layout/TitleBar', () => ({
  TitleBar: () => <div data-testid="title-bar" />,
}));

vi.mock('@/i18n', () => ({
  SUPPORTED_LANGUAGES: [
    { code: 'en', label: 'English' },
    { code: 'zh-CN', label: '简体中文' },
  ],
}));

vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/stores/gateway', () => {
  const useGatewayStore = ((selector: (state: typeof gatewayState) => unknown) => selector(gatewayState)) as
    ((selector: (state: typeof gatewayState) => unknown) => unknown) & { getState: () => typeof gatewayState };
  useGatewayStore.getState = () => gatewayState;
  return { useGatewayStore };
});

vi.mock('@/stores/settings', () => {
  const useSettingsStore = ((selector?: (state: typeof settingsState) => unknown) =>
    selector ? selector(settingsState) : settingsState) as
    ((selector?: (state: typeof settingsState) => unknown) => unknown) & { getState: () => typeof settingsState };
  useSettingsStore.getState = () => settingsState;
  return { useSettingsStore };
});

vi.mock('@/lib/api-client', () => ({
  invokeIpc: (...args: unknown[]) => invokeIpcMock(...args),
}));

vi.mock('@/lib/host-api', () => ({
  hostApiFetch: (...args: unknown[]) => hostApiFetchMock(...args),
  installRuntime: (...args: unknown[]) => installRuntimeMock(...args),
  setRuntimeInstallChoice: (...args: unknown[]) => setRuntimeInstallChoiceMock(...args),
}));

vi.mock('@/lib/host-events', () => ({
  subscribeHostEvent: (...args: unknown[]) => subscribeHostEventMock(...args),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: tMock,
  }),
}));

vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccessMock(...args),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

describe('Setup runtime selection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    gatewayState.status = { state: 'running', port: 18789 };
    gatewayState.start = vi.fn();
    settingsState.markSetupComplete = vi.fn();
    settingsState.language = 'en';
    settingsState.setLanguage = vi.fn();
    settingsState.runtime = {
      installChoice: 'both',
      mode: 'hermesclaw-both',
      installedKinds: ['openclaw', 'hermes'],
      lastStandaloneRuntime: 'hermes',
      windowsHermesPreferredMode: 'wsl2',
      windowsHermesNativePath: undefined,
      windowsHermesWslDistro: undefined,
    };
    tMock.mockImplementation((key: string) => key);
    setRuntimeInstallChoiceMock.mockResolvedValue({ success: true, installChoice: 'both' });
    invokeIpcMock.mockImplementation((channel: string, _payload?: unknown) => {
      if (channel === 'openclaw:status') {
        return Promise.resolve({
          packageExists: true,
          isBuilt: true,
          dir: '/tmp/openclaw',
          version: '2026.4.15',
        });
      }

      if (channel === 'shell:showItemInFolder') {
        return Promise.resolve(undefined);
      }

      if (channel === 'app:platform') {
        return Promise.resolve('linux');
      }

      return Promise.resolve(undefined);
    });
    hostApiFetchMock.mockResolvedValue({ dir: '/tmp/logs', content: '' });
    subscribeHostEventMock.mockImplementation(() => vi.fn());
    installRuntimeMock.mockImplementation(async (installChoice: string) => ({
      success: true,
      installChoice,
        steps:
          installChoice === 'both'
          ? [
              { id: 'openclaw', kind: 'runtime', status: 'completed', label: 'OpenClaw runtime' },
              { id: 'hermes', kind: 'runtime', status: 'completed', label: 'Hermes runtime' },
              { id: 'bridge', kind: 'bridge', status: 'completed', label: 'Hermes bridge' },
            ]
          : installChoice === 'hermes'
            ? [{ id: 'hermes', kind: 'runtime', status: 'completed', label: 'Hermes runtime' }]
            : [{ id: 'openclaw', kind: 'runtime', status: 'completed', label: 'OpenClaw runtime' }],
      snapshot: {
        runtime: {
          installChoice,
          mode: installChoice === 'hermes' ? 'hermes' : installChoice === 'both' ? 'openclaw-with-hermes-agent' : 'openclaw',
          installedKinds: installChoice === 'both' ? ['openclaw', 'hermes'] : [installChoice],
        },
        bridge: {
          enabled: installChoice === 'both',
          attached: false,
          hermesInstalled: installChoice !== 'openclaw',
          hermesHealthy: false,
          openclawRecognized: false,
        },
        runtimes: [],
      },
    }));
  });

  it('only exposes the combined choice and passes it into runtime install orchestration', async () => {
    render(<Setup />);

    fireEvent.click(screen.getByTestId('setup-next-button'));

    await waitFor(() => {
      expect(invokeIpcMock).toHaveBeenCalledWith('openclaw:status');
      expect(screen.getByTestId('setup-install-choice-both')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('setup-install-choice-openclaw')).not.toBeInTheDocument();
    expect(screen.queryByTestId('setup-install-choice-hermes')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('setup-install-choice-both'));
    expect(screen.getByTestId('setup-install-choice-both')).toHaveAttribute('aria-pressed', 'true');
    await waitFor(() => {
      expect(setRuntimeInstallChoiceMock).toHaveBeenCalledWith('both');
    });

    await waitFor(() => {
      expect(screen.getByTestId('setup-next-button')).not.toBeDisabled();
    });
    fireEvent.click(screen.getByTestId('setup-next-button'));

    await waitFor(() => {
      expect(installRuntimeMock).toHaveBeenCalledWith('both');
    });
  });

  it('requires OpenClaw readiness because setup only installs the combined runtime', async () => {
    gatewayState.status = { state: 'stopped', port: 18789 };
    invokeIpcMock.mockImplementation((channel: string, _payload?: unknown) => {
      if (channel === 'openclaw:status') {
        return Promise.resolve({
          packageExists: true,
          isBuilt: true,
          dir: '/tmp/openclaw',
          version: '2026.4.15',
        });
      }

      return Promise.resolve(undefined);
    });

    render(<Setup />);
    fireEvent.click(screen.getByTestId('setup-next-button'));

    const nextButton = await screen.findByTestId('setup-next-button');
    await waitFor(() => {
      expect(nextButton).toBeDisabled();
    });
    expect(screen.getByTestId('setup-install-choice-both')).toBeInTheDocument();
    expect(screen.queryByTestId('setup-install-choice-hermes')).not.toBeInTheDocument();
    expect(screen.queryByTestId('setup-install-choice-openclaw')).not.toBeInTheDocument();
    expect(installRuntimeMock).not.toHaveBeenCalled();
  });

  it('blocks the combined runtime on Windows when neither native Hermes nor WSL is configured', async () => {
    invokeIpcMock.mockImplementation((channel: string) => {
      if (channel === 'openclaw:status') {
        return Promise.resolve({
          packageExists: true,
          isBuilt: true,
          dir: '/tmp/openclaw',
          version: '2026.4.15',
        });
      }

      if (channel === 'app:platform') {
        return Promise.resolve('win32');
      }

      if (channel === 'wsl:list') {
        return Promise.resolve([]);
      }

      return Promise.resolve(undefined);
    });

    render(<Setup />);
    fireEvent.click(screen.getByTestId('setup-next-button'));

    const bothButton = await screen.findByTestId('setup-install-choice-both');
    const nextButton = screen.getByTestId('setup-next-button');

    await waitFor(() => {
      expect(screen.getByTestId('setup-runtime-wsl2-notice')).toBeInTheDocument();
      expect(bothButton).toBeDisabled();
      expect(nextButton).toBeDisabled();
    });
    expect(screen.queryByTestId('setup-install-choice-openclaw')).not.toBeInTheDocument();
    expect(screen.queryByTestId('setup-install-choice-hermes')).not.toBeInTheDocument();
  });

  it('allows the combined runtime on Windows when a WSL distro is already configured', async () => {
    settingsState.runtime.windowsHermesWslDistro = 'Ubuntu-24.04';
    invokeIpcMock.mockImplementation((channel: string) => {
      if (channel === 'openclaw:status') {
        return Promise.resolve({
          packageExists: true,
          isBuilt: true,
          dir: '/tmp/openclaw',
          version: '2026.4.15',
        });
      }

      if (channel === 'app:platform') {
        return Promise.resolve('win32');
      }

      return Promise.resolve(undefined);
    });

    render(<Setup />);
    fireEvent.click(screen.getByTestId('setup-next-button'));

    const bothButton = await screen.findByTestId('setup-install-choice-both');
    const nextButton = screen.getByTestId('setup-next-button');

    await waitFor(() => {
      expect(screen.getByTestId('setup-runtime-wsl2-notice')).toBeInTheDocument();
      expect(bothButton).not.toBeDisabled();
    });

    fireEvent.click(bothButton);
    await waitFor(() => {
      expect(setRuntimeInstallChoiceMock).toHaveBeenCalledWith('both');
    });

    await waitFor(() => {
      expect(nextButton).not.toBeDisabled();
    });

    fireEvent.click(nextButton);

    await waitFor(() => {
      expect(installRuntimeMock).toHaveBeenCalledWith('both');
    });
  });

  it('allows the combined runtime on Windows when a native Hermes path is configured without WSL', async () => {
    settingsState.runtime.windowsHermesPreferredMode = 'native';
    settingsState.runtime.windowsHermesNativePath = 'C:\\Hermes\\.hermes';
    invokeIpcMock.mockImplementation((channel: string) => {
      if (channel === 'openclaw:status') {
        return Promise.resolve({
          packageExists: true,
          isBuilt: true,
          dir: '/tmp/openclaw',
          version: '2026.4.15',
        });
      }

      if (channel === 'app:platform') {
        return Promise.resolve('win32');
      }

      if (channel === 'wsl:list') {
        return Promise.resolve([]);
      }

      return Promise.resolve(undefined);
    });

    render(<Setup />);
    fireEvent.click(screen.getByTestId('setup-next-button'));

    const bothButton = await screen.findByTestId('setup-install-choice-both');
    const nextButton = screen.getByTestId('setup-next-button');

    await waitFor(() => {
      expect(screen.getByTestId('setup-runtime-wsl2-notice')).toBeInTheDocument();
      expect(bothButton).not.toBeDisabled();
    });

    fireEvent.click(bothButton);
    await waitFor(() => {
      expect(setRuntimeInstallChoiceMock).toHaveBeenCalledWith('both');
      expect(nextButton).not.toBeDisabled();
    });
  });

  it('discovers and persists a Windows WSL distro when one is available', async () => {
    invokeIpcMock.mockImplementation((channel: string) => {
      if (channel === 'openclaw:status') {
        return Promise.resolve({
          packageExists: true,
          isBuilt: true,
          dir: '/tmp/openclaw',
          version: '2026.4.15',
        });
      }

      if (channel === 'app:platform') {
        return Promise.resolve('win32');
      }

      if (channel === 'wsl:list') {
        return Promise.resolve(['Ubuntu-24.04']);
      }

      return Promise.resolve(undefined);
    });
    hostApiFetchMock.mockResolvedValue({ success: true });

    render(<Setup />);
    fireEvent.click(screen.getByTestId('setup-next-button'));

    const bothButton = await screen.findByTestId('setup-install-choice-both');

    await waitFor(() => {
      expect(invokeIpcMock).toHaveBeenCalledWith('wsl:list');
      expect(bothButton).not.toBeDisabled();
    });

    const persistCall = hostApiFetchMock.mock.calls.find(([path]) => path === '/api/settings/runtime');
    expect(persistCall).toBeDefined();
    expect(persistCall?.[1]).toMatchObject({ method: 'PUT' });
    expect(JSON.parse(String(persistCall?.[1]?.body))).toEqual({
      value: expect.objectContaining({
        installChoice: 'both',
        mode: 'hermesclaw-both',
        installedKinds: ['openclaw', 'hermes'],
        lastStandaloneRuntime: 'hermes',
        windowsHermesPreferredMode: 'wsl2',
        windowsHermesWslDistro: 'Ubuntu-24.04',
      }),
    });
  });

  it('shows install progress steps for the selected runtimes', async () => {
    installRuntimeMock.mockResolvedValueOnce({
      success: true,
      installChoice: 'both',
      steps: [
        { id: 'openclaw', kind: 'runtime', status: 'completed', label: 'OpenClaw runtime' },
        { id: 'hermes', kind: 'runtime', status: 'completed', label: 'Hermes runtime' },
        { id: 'bridge', kind: 'bridge', status: 'completed', label: 'Hermes bridge' },
      ],
      snapshot: {
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
      },
    });

    render(<Setup />);
    fireEvent.click(screen.getByTestId('setup-next-button'));
    await screen.findByTestId('setup-install-choice-both');
    fireEvent.click(screen.getByTestId('setup-install-choice-both'));
    await waitFor(() => {
      expect(screen.getByTestId('setup-next-button')).not.toBeDisabled();
    });
    fireEvent.click(screen.getByTestId('setup-next-button'));

    await waitFor(() => {
      expect(screen.getByTestId('setup-install-summary')).toBeInTheDocument();
      expect(screen.getByTestId('setup-install-step-openclaw')).toHaveAttribute('data-status', 'completed');
      expect(screen.getByTestId('setup-install-step-hermes')).toHaveAttribute('data-status', 'completed');
      expect(screen.getByTestId('setup-install-step-bridge')).toHaveAttribute('data-status', 'completed');
    });
  });

  it('subscribes to runtime install progress and reflects live step updates', async () => {
    let progressHandler: ((payload: {
      installChoice: 'openclaw' | 'hermes' | 'both';
      activeStepId: 'openclaw' | 'hermes' | 'bridge';
      steps: Array<{ id: 'openclaw' | 'hermes' | 'bridge'; status: 'pending' | 'installing' | 'completed' | 'failed' | 'skipped' }>;
    }) => void) | undefined;
    subscribeHostEventMock.mockImplementation((eventName: string, handler: typeof progressHandler) => {
      if (eventName === 'runtime:install:progress') {
        progressHandler = handler;
      }
      return vi.fn();
    });
    installRuntimeMock.mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
      return {
        success: true,
        installChoice: 'both',
        steps: [
          { id: 'openclaw', kind: 'runtime', status: 'completed', label: 'OpenClaw runtime' },
          { id: 'hermes', kind: 'runtime', status: 'completed', label: 'Hermes runtime' },
          { id: 'bridge', kind: 'bridge', status: 'completed', label: 'Hermes bridge' },
        ],
        snapshot: {
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
        },
      };
    });

    render(<Setup />);
    fireEvent.click(screen.getByTestId('setup-next-button'));
    await screen.findByTestId('setup-install-choice-both');
    fireEvent.click(screen.getByTestId('setup-install-choice-both'));
    await waitFor(() => {
      expect(screen.getByTestId('setup-next-button')).not.toBeDisabled();
    });
    fireEvent.click(screen.getByTestId('setup-next-button'));

    await waitFor(() => {
      expect(subscribeHostEventMock).toHaveBeenCalledWith('runtime:install:progress', expect.any(Function));
    });

    expect(progressHandler).toBeDefined();

    progressHandler?.({
      installChoice: 'both',
      activeStepId: 'hermes',
      steps: [
        { id: 'openclaw', status: 'completed' },
        { id: 'hermes', status: 'installing' },
        { id: 'bridge', status: 'pending' },
      ],
    });

    await waitFor(() => {
      expect(screen.getByTestId('setup-install-step-openclaw')).toHaveAttribute('data-status', 'completed');
      expect(screen.getByTestId('setup-install-step-hermes')).toHaveAttribute('data-status', 'installing');
      expect(screen.getByTestId('setup-install-step-bridge')).toHaveAttribute('data-status', 'pending');
    });
  });

  it('surfaces failure source and retry guidance when install fails', async () => {
    installRuntimeMock.mockRejectedValueOnce(new Error('Hermes WSL environment failed'));
    installRuntimeMock.mockResolvedValueOnce({
      success: true,
      installChoice: 'both',
      steps: [{ id: 'hermes', kind: 'runtime', status: 'completed', label: 'Hermes runtime' }],
      snapshot: {
        runtime: {
          installChoice: 'both',
          mode: 'openclaw-with-hermes-agent',
          installedKinds: ['openclaw', 'hermes'],
        },
        bridge: {
          enabled: false,
          attached: false,
          hermesInstalled: true,
          hermesHealthy: false,
          openclawRecognized: false,
        },
        runtimes: [],
      },
    });

    render(<Setup />);
    fireEvent.click(screen.getByTestId('setup-next-button'));
    await screen.findByTestId('setup-install-choice-both');
    fireEvent.click(screen.getByTestId('setup-install-choice-both'));
    await waitFor(() => {
      expect(screen.getByTestId('setup-next-button')).not.toBeDisabled();
    });
    fireEvent.click(screen.getByTestId('setup-next-button'));

    await waitFor(() => {
      expect(screen.getByTestId('setup-install-error-source')).toHaveTextContent('installing.failureSource.hermes');
      expect(screen.getByTestId('setup-install-step-hermes')).toHaveAttribute('data-status', 'failed');
      expect(screen.getByTestId('setup-install-retry-button')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('setup-install-retry-button'));

    await waitFor(() => {
      expect(installRuntimeMock).toHaveBeenCalledTimes(2);
      expect(screen.queryByTestId('setup-install-error-source')).not.toBeInTheDocument();
      expect(screen.getByTestId('setup-install-step-hermes')).toHaveAttribute('data-status', 'completed');
    });
  });

  it('prefers failed backend step as the failure source over a generic fetch error message', async () => {
    installRuntimeMock.mockResolvedValueOnce({
      success: false,
      installChoice: 'both',
      error: 'fetch failed',
      steps: [
        { id: 'openclaw', kind: 'runtime', status: 'completed', label: 'OpenClaw runtime' },
        { id: 'hermes', kind: 'runtime', status: 'failed', label: 'Hermes runtime', error: 'fetch failed' },
        { id: 'bridge', kind: 'bridge', status: 'pending', label: 'Hermes bridge' },
      ],
      snapshot: {
        runtime: {
          installChoice: 'both',
          mode: 'openclaw-with-hermes-agent',
          installedKinds: ['openclaw', 'hermes'],
        },
        bridge: {
          enabled: true,
          attached: false,
          hermesInstalled: false,
          hermesHealthy: false,
          openclawRecognized: false,
        },
        runtimes: [],
      },
    });

    render(<Setup />);
    fireEvent.click(screen.getByTestId('setup-next-button'));
    await screen.findByTestId('setup-install-choice-both');
    fireEvent.click(screen.getByTestId('setup-install-choice-both'));
    await waitFor(() => {
      expect(screen.getByTestId('setup-next-button')).not.toBeDisabled();
    });
    fireEvent.click(screen.getByTestId('setup-next-button'));

    await waitFor(() => {
      expect(screen.getByTestId('setup-install-error-source')).toHaveTextContent('installing.failureSource.hermes');
      expect(screen.getByTestId('setup-install-step-openclaw')).toHaveAttribute('data-status', 'completed');
      expect(screen.getByTestId('setup-install-step-hermes')).toHaveAttribute('data-status', 'failed');
      expect(screen.getByTestId('setup-install-step-bridge')).toHaveAttribute('data-status', 'pending');
    });
  });
});
