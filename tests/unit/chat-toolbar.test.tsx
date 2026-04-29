import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const refreshMock = vi.fn();

const { chatState, agentsState, settingsState } = vi.hoisted(() => ({
  chatState: {
    refresh: vi.fn(),
    loading: false,
    currentAgentId: 'main',
  },
  agentsState: {
    agents: [{ id: 'main', name: 'Main Agent' }] as Array<Record<string, unknown>>,
  },
  settingsState: {
    runtime: {
      installChoice: 'openclaw' as const,
      mode: 'openclaw' as const,
      installedKinds: ['openclaw'] as const,
      lastStandaloneRuntime: 'openclaw' as const,
    },
  },
}));

vi.mock('@/stores/chat', () => ({
  useChatStore: (selector: (state: typeof chatState) => unknown) => selector(chatState),
}));

vi.mock('@/stores/agents', () => ({
  useAgentsStore: (selector: (state: typeof agentsState) => unknown) => selector(agentsState),
}));

vi.mock('@/stores/settings', () => {
  const useSettingsStore = ((selector?: (state: typeof settingsState) => unknown) =>
    selector ? selector(settingsState) : settingsState) as
    ((selector?: (state: typeof settingsState) => unknown) => unknown) & { getState: () => typeof settingsState };
  useSettingsStore.getState = () => settingsState;
  return { useSettingsStore };
});

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      if (key === 'toolbar.currentAgent') {
        return `Current agent: ${String(params?.agent ?? '')}`;
      }
      return key;
    },
  }),
}));

vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: unknown }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: unknown }) => <>{children}</>,
  TooltipContent: ({ children }: { children: unknown }) => <>{children}</>,
}));

describe('ChatToolbar', () => {
  beforeEach(() => {
    refreshMock.mockReset();
    chatState.refresh = refreshMock;
    chatState.loading = false;
    chatState.currentAgentId = 'main';
    settingsState.runtime = {
      installChoice: 'openclaw',
      mode: 'openclaw',
      installedKinds: ['openclaw'],
      lastStandaloneRuntime: 'openclaw',
    };
  });

  it('disables refresh in hermes mode', async () => {
    settingsState.runtime = {
      installChoice: 'hermes',
      mode: 'hermes',
      installedKinds: ['hermes'],
      lastStandaloneRuntime: 'hermes',
    };

    const { ChatToolbar } = await import('@/pages/Chat/ChatToolbar');

    render(<ChatToolbar />);

    expect(screen.getByRole('button')).toBeDisabled();
  });
});
