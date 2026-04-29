import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

const hostApiFetchMock = vi.fn();
const chatInputMock = vi.fn();

const { gatewayState, agentsState, settingsState } = vi.hoisted(() => ({
  gatewayState: {
    status: { state: 'running', port: 18789 },
  },
  agentsState: {
    agents: [{ id: 'main', name: 'main' }] as Array<Record<string, unknown>>,
    fetchAgents: vi.fn(),
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

vi.mock('@/stores/gateway', () => ({
  useGatewayStore: (selector: (state: typeof gatewayState) => unknown) => selector(gatewayState),
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

vi.mock('@/lib/host-api', () => ({
  hostApiFetch: (...args: unknown[]) => hostApiFetchMock(...args),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      if (key === 'executionGraph.collapsedSummary') {
        return `collapsed ${String(params?.toolCount ?? '')} ${String(params?.processCount ?? '')}`.trim();
      }
      if (key === 'executionGraph.agentRun') {
        return `Main execution`;
      }
      if (key === 'executionGraph.title') {
        return 'Execution Graph';
      }
      if (key === 'executionGraph.collapseAction') {
        return 'Collapse';
      }
      if (key === 'executionGraph.thinkingLabel') {
        return 'Thinking';
      }
      if (key.startsWith('taskPanel.stepStatus.')) {
        return key.split('.').at(-1) ?? key;
      }
      return key;
    },
  }),
}));

vi.mock('@/hooks/use-stick-to-bottom-instant', () => ({
  useStickToBottomInstant: () => ({
    contentRef: { current: null },
    scrollRef: { current: null },
  }),
}));

vi.mock('@/hooks/use-min-loading', () => ({
  useMinLoading: () => false,
}));

vi.mock('@/pages/Chat/ChatToolbar', () => ({
  ChatToolbar: () => null,
}));

vi.mock('@/pages/Chat/ChatInput', () => ({
  ChatInput: (props: unknown) => {
    chatInputMock(props);
    return null;
  },
}));

describe('Chat execution graph lifecycle', () => {
  beforeEach(async () => {
    vi.resetModules();
    hostApiFetchMock.mockReset();
    hostApiFetchMock.mockResolvedValue({ success: true, messages: [] });
    chatInputMock.mockReset();
    agentsState.fetchAgents.mockReset();
    gatewayState.status = { state: 'running', port: 18789 };
    settingsState.runtime = {
      installChoice: 'openclaw',
      mode: 'openclaw',
      installedKinds: ['openclaw'],
      lastStandaloneRuntime: 'openclaw',
    };

    const { useChatStore } = await import('@/stores/chat');
    useChatStore.setState({
      messages: [
        {
          role: 'user',
          content: 'Check semiconductor chatter',
        },
        {
          role: 'assistant',
          id: 'tool-turn',
          content: [
            { type: 'text', text: 'Checked X.' },
            { type: 'tool_use', id: 'browser-search', name: 'browser', input: { action: 'search', query: 'semiconductor' } },
          ],
        },
      ],
      loading: false,
      error: null,
      sending: true,
      activeRunId: 'run-live',
      streamingText: '',
      streamingMessage: {
        role: 'assistant',
        id: 'final-stream',
        content: [
          { type: 'text', text: 'Checked X.' },
          { type: 'text', text: 'Checked X. Here is the summary.' },
        ],
      },
      streamingTools: [
        {
          toolCallId: 'browser-search',
          name: 'browser',
          status: 'completed',
          updatedAt: Date.now(),
        },
      ],
      pendingFinal: true,
      lastUserMessageAt: Date.now(),
      pendingToolImages: [],
      sessions: [{ key: 'agent:main:main' }],
      currentSessionKey: 'agent:main:main',
      currentAgentId: 'main',
      sessionLabels: {},
      sessionLastActivity: {},
      thinkingLevel: null,
    });
  });

  it('keeps the execution graph expanded while the reply is still streaming and shows only the reply suffix in the bubble', async () => {
    const { Chat } = await import('@/pages/Chat/index');

    render(<Chat />);

    await waitFor(() => {
      expect(screen.getByTestId('chat-execution-graph')).toHaveAttribute('data-collapsed', 'false');
    });

    expect(screen.getByText('Here is the summary.')).toBeInTheDocument();
    expect(screen.queryByText('Checked X. Here is the summary.')).not.toBeInTheDocument();
  });

  it('renders the execution graph immediately for an active run before any stream content arrives', async () => {
    const { useChatStore } = await import('@/stores/chat');
    useChatStore.setState({
      messages: [
        {
          role: 'user',
          content: 'Check semiconductor chatter',
        },
      ],
      loading: false,
      error: null,
      sending: true,
      activeRunId: 'run-starting',
      streamingText: '',
      streamingMessage: null,
      streamingTools: [],
      pendingFinal: false,
      lastUserMessageAt: Date.now(),
      pendingToolImages: [],
      sessions: [{ key: 'agent:main:main' }],
      currentSessionKey: 'agent:main:main',
      currentAgentId: 'main',
      sessionLabels: {},
      sessionLastActivity: {},
      thinkingLevel: null,
    });

    const { Chat } = await import('@/pages/Chat/index');

    render(<Chat />);

    await waitFor(() => {
      expect(screen.getByTestId('chat-execution-graph')).toHaveAttribute('data-collapsed', 'false');
    });

    expect(screen.getByTestId('chat-execution-step-thinking-trailing')).toBeInTheDocument();
    expect(screen.getAllByText('Thinking').length).toBeGreaterThan(0);
  });

  it('keeps the chat composer enabled in hermes mode when gateway is stopped', async () => {
    gatewayState.status = { state: 'stopped', port: 18789 };
    settingsState.runtime = {
      installChoice: 'hermes',
      mode: 'hermes',
      installedKinds: ['hermes'],
      lastStandaloneRuntime: 'hermes',
    };

    const { Chat } = await import('@/pages/Chat/index');

    render(<Chat />);

    await waitFor(() => {
      expect(chatInputMock).toHaveBeenCalled();
    });

    const lastProps = chatInputMock.mock.calls.at(-1)?.[0] as { disabled?: boolean } | undefined;
    expect(lastProps?.disabled).toBe(false);
  });
});
