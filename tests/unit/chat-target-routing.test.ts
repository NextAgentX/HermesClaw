import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { gatewayRpcMock, hostApiFetchMock, sendHermesRuntimeChatCompletionMock, agentsState } = vi.hoisted(() => ({
  gatewayRpcMock: vi.fn(),
  hostApiFetchMock: vi.fn(),
  sendHermesRuntimeChatCompletionMock: vi.fn(),
  agentsState: {
    agents: [] as Array<Record<string, unknown>>,
  },
}));

vi.mock('@/stores/gateway', () => ({
  useGatewayStore: {
    getState: () => ({
      rpc: gatewayRpcMock,
    }),
  },
}));

vi.mock('@/stores/agents', () => ({
  useAgentsStore: {
    getState: () => agentsState,
  },
}));

vi.mock('@/lib/host-api', () => ({
  hostApiFetch: (...args: unknown[]) => hostApiFetchMock(...args),
  sendHermesRuntimeChatCompletion: (...args: unknown[]) => sendHermesRuntimeChatCompletionMock(...args),
}));

describe('chat target routing', () => {
  const HERMES_CHAT_SNAPSHOT_KEY = 'hermesclaw:hermes-chat-snapshot';

  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-11T12:00:00Z'));
    window.localStorage.clear();

    agentsState.agents = [
      {
        id: 'main',
        name: 'Main',
        isDefault: true,
        modelDisplay: 'MiniMax',
        inheritedModel: true,
        workspace: '~/.openclaw/workspace',
        agentDir: '~/.openclaw/agents/main/agent',
        mainSessionKey: 'agent:main:main',
        channelTypes: [],
      },
      {
        id: 'research',
        name: 'Research',
        isDefault: false,
        modelDisplay: 'Claude',
        inheritedModel: false,
        workspace: '~/.openclaw/workspace-research',
        agentDir: '~/.openclaw/agents/research/agent',
        mainSessionKey: 'agent:research:desk',
        channelTypes: [],
      },
    ];

    gatewayRpcMock.mockReset();
    gatewayRpcMock.mockImplementation(async (method: string) => {
      if (method === 'chat.history') {
        return { messages: [] };
      }
      if (method === 'chat.send') {
        return { runId: 'run-text' };
      }
      if (method === 'chat.abort') {
        return { ok: true };
      }
      if (method === 'sessions.list') {
        return { sessions: [] };
      }
      throw new Error(`Unexpected gateway RPC: ${method}`);
    });

    hostApiFetchMock.mockReset();
    hostApiFetchMock.mockResolvedValue({ success: true, result: { runId: 'run-media' } });

    sendHermesRuntimeChatCompletionMock.mockReset();
    sendHermesRuntimeChatCompletionMock.mockResolvedValue({
      choices: [
        {
          message: {
            role: 'assistant',
            content: 'Hermes response',
          },
        },
      ],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('switches to the selected agent main session before sending text', async () => {
    const { useChatStore } = await import('@/stores/chat');

    useChatStore.setState({
      currentSessionKey: 'agent:main:main',
      currentAgentId: 'main',
      sessions: [{ key: 'agent:main:main' }],
      messages: [{ role: 'assistant', content: 'Existing main history' }],
      sessionLabels: {},
      sessionLastActivity: {},
      sending: false,
      activeRunId: null,
      streamingText: '',
      streamingMessage: null,
      streamingTools: [],
      pendingFinal: false,
      lastUserMessageAt: null,
      pendingToolImages: [],
      error: null,
      loading: false,
      thinkingLevel: null,
    });

    await useChatStore.getState().sendMessage('Hello direct agent', undefined, 'research');

    const state = useChatStore.getState();
    expect(state.currentSessionKey).toBe('agent:research:desk');
    expect(state.currentAgentId).toBe('research');
    expect(state.sessions.some((session) => session.key === 'agent:research:desk')).toBe(true);
    expect(state.messages.at(-1)?.content).toBe('Hello direct agent');

    const historyCall = gatewayRpcMock.mock.calls.find(([method]) => method === 'chat.history');
    expect(historyCall?.[1]).toEqual({ sessionKey: 'agent:research:desk', limit: 200 });

    const sendCall = gatewayRpcMock.mock.calls.find(([method]) => method === 'chat.send');
    expect(sendCall?.[1]).toMatchObject({
      sessionKey: 'agent:research:desk',
      message: 'Hello direct agent',
      deliver: false,
    });
    expect(typeof (sendCall?.[1] as { idempotencyKey?: unknown })?.idempotencyKey).toBe('string');
  });

  it('uses the selected agent main session for attachment sends', async () => {
    const { useChatStore } = await import('@/stores/chat');

    useChatStore.setState({
      currentSessionKey: 'agent:main:main',
      currentAgentId: 'main',
      sessions: [{ key: 'agent:main:main' }],
      messages: [],
      sessionLabels: {},
      sessionLastActivity: {},
      sending: false,
      activeRunId: null,
      streamingText: '',
      streamingMessage: null,
      streamingTools: [],
      pendingFinal: false,
      lastUserMessageAt: null,
      pendingToolImages: [],
      error: null,
      loading: false,
      thinkingLevel: null,
    });

    await useChatStore.getState().sendMessage(
      '',
      [
        {
          fileName: 'design.png',
          mimeType: 'image/png',
          fileSize: 128,
          stagedPath: '/tmp/design.png',
          preview: 'data:image/png;base64,abc',
        },
      ],
      'research',
    );

    expect(useChatStore.getState().currentSessionKey).toBe('agent:research:desk');

    expect(hostApiFetchMock).toHaveBeenCalledWith(
      '/api/chat/send-with-media',
      expect.objectContaining({
        method: 'POST',
        body: expect.any(String),
      }),
    );

    const payload = JSON.parse(
      (hostApiFetchMock.mock.calls[0]?.[1] as { body: string }).body,
    ) as {
      sessionKey: string;
      message: string;
      media: Array<{ filePath: string }>;
    };

    expect(payload.sessionKey).toBe('agent:research:desk');
    expect(payload.message).toBe('Process the attached file(s).');
    expect(payload.media[0]?.filePath).toBe('/tmp/design.png');
  });

  it('routes hermes-mode text sends through the Hermes compatibility endpoint', async () => {
    const { useSettingsStore } = await import('@/stores/settings');
    const { useChatStore } = await import('@/stores/chat');

    useSettingsStore.setState({
      runtime: {
        installChoice: 'hermes',
        mode: 'hermes',
        installedKinds: ['hermes'],
        lastStandaloneRuntime: 'hermes',
      },
    });

    useChatStore.setState({
      currentSessionKey: 'agent:main:main',
      currentAgentId: 'main',
      sessions: [{ key: 'agent:main:main' }],
      messages: [],
      sessionLabels: {},
      sessionLastActivity: {},
      sending: false,
      activeRunId: null,
      streamingText: '',
      streamingMessage: null,
      streamingTools: [],
      pendingFinal: false,
      lastUserMessageAt: null,
      pendingToolImages: [],
      error: null,
      loading: false,
      thinkingLevel: null,
    });

    await useChatStore.getState().sendMessage('Hello Hermes');

    expect(sendHermesRuntimeChatCompletionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: [{ role: 'user', content: 'Hello Hermes' }],
      }),
    );
    expect(gatewayRpcMock).not.toHaveBeenCalledWith('chat.send', expect.anything(), expect.anything());

    const state = useChatStore.getState();
    expect(state.sending).toBe(false);
    expect(state.activeRunId).toBeNull();
    expect(state.error).toBeNull();
    expect(state.messages.at(-1)).toMatchObject({
      role: 'assistant',
      content: 'Hermes response',
    });
  });

  it('includes prior conversation context on a second hermes-mode text send', async () => {
    const { useSettingsStore } = await import('@/stores/settings');
    const { useChatStore } = await import('@/stores/chat');

    useSettingsStore.setState({
      runtime: {
        installChoice: 'hermes',
        mode: 'hermes',
        installedKinds: ['hermes'],
        lastStandaloneRuntime: 'hermes',
      },
    });

    useChatStore.setState({
      currentSessionKey: 'agent:main:main',
      currentAgentId: 'main',
      sessions: [{ key: 'agent:main:main' }],
      messages: [
        { role: 'user', content: 'My name is Ada' },
        { role: 'assistant', content: 'Nice to meet you, Ada.' },
      ],
      sessionLabels: {},
      sessionLastActivity: {},
      sending: false,
      activeRunId: null,
      streamingText: '',
      streamingMessage: null,
      streamingTools: [],
      pendingFinal: false,
      lastUserMessageAt: null,
      pendingToolImages: [],
      error: null,
      loading: false,
      thinkingLevel: null,
    });

    await useChatStore.getState().sendMessage('What is my name?');

    expect(sendHermesRuntimeChatCompletionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: [
          { role: 'user', content: 'My name is Ada' },
          { role: 'assistant', content: 'Nice to meet you, Ada.' },
          { role: 'user', content: 'What is my name?' },
        ],
      }),
    );
  });

  it('skips gateway-backed refresh in hermes mode', async () => {
    const { useSettingsStore } = await import('@/stores/settings');
    const { useChatStore } = await import('@/stores/chat');

    useSettingsStore.setState({
      runtime: {
        installChoice: 'hermes',
        mode: 'hermes',
        installedKinds: ['hermes'],
        lastStandaloneRuntime: 'hermes',
      },
    });

    gatewayRpcMock.mockClear();

    await useChatStore.getState().refresh();

    expect(gatewayRpcMock).not.toHaveBeenCalledWith('chat.history', expect.anything(), expect.anything());
    expect(gatewayRpcMock).not.toHaveBeenCalledWith('sessions.list', expect.anything(), expect.anything());
    expect(gatewayRpcMock).not.toHaveBeenCalled();
  });

  it('persists hermes chat snapshot after a text send', async () => {
    const { useSettingsStore } = await import('@/stores/settings');
    const { useChatStore } = await import('@/stores/chat');

    useSettingsStore.setState({
      runtime: {
        installChoice: 'hermes',
        mode: 'hermes',
        installedKinds: ['hermes'],
        lastStandaloneRuntime: 'hermes',
      },
    });

    useChatStore.setState({
      currentSessionKey: 'agent:main:main',
      currentAgentId: 'main',
      sessions: [{ key: 'agent:main:main' }],
      messages: [],
      sessionLabels: {},
      sessionLastActivity: {},
      sending: false,
      activeRunId: null,
      streamingText: '',
      streamingMessage: null,
      streamingTools: [],
      pendingFinal: false,
      lastUserMessageAt: null,
      pendingToolImages: [],
      error: null,
      loading: false,
      thinkingLevel: null,
    });

    await useChatStore.getState().sendMessage('Persist me');

    const rawSnapshot = window.localStorage.getItem(HERMES_CHAT_SNAPSHOT_KEY);
    expect(rawSnapshot).toBeTruthy();

    const snapshot = JSON.parse(rawSnapshot as string) as {
      currentSessionKey: string;
      messagesBySession: Record<string, Array<{ role: string; content: string }>>;
    };

    expect(snapshot.currentSessionKey).toBe('agent:main:main');
    expect(snapshot.messagesBySession['agent:main:main']).toEqual([
      expect.objectContaining({ role: 'user', content: 'Persist me' }),
      expect.objectContaining({ role: 'assistant', content: 'Hermes response' }),
    ]);
  });

  it('restores hermes snapshot state on store initialization', async () => {
    const { useSettingsStore } = await import('@/stores/settings');

    useSettingsStore.setState({
      runtime: {
        installChoice: 'hermes',
        mode: 'hermes',
        installedKinds: ['hermes'],
        lastStandaloneRuntime: 'hermes',
      },
    });

    window.localStorage.setItem(HERMES_CHAT_SNAPSHOT_KEY, JSON.stringify({
      version: 1,
      sessions: [{ key: 'agent:main:remembered', displayName: 'remembered' }],
      currentSessionKey: 'agent:main:remembered',
      currentAgentId: 'main',
      sessionLabels: { 'agent:main:remembered': 'Remembered prompt' },
      sessionLastActivity: { 'agent:main:remembered': 1234567890 },
      messagesBySession: {
        'agent:main:remembered': [
          { role: 'user', content: 'Remember me', timestamp: 1, id: 'u-1' },
          { role: 'assistant', content: 'I remember.', timestamp: 2, id: 'a-1' },
        ],
      },
    }));

    const { useChatStore } = await import('@/stores/chat');
    const state = useChatStore.getState();

    expect(state.currentSessionKey).toBe('agent:main:remembered');
    expect(state.sessions).toEqual([{ key: 'agent:main:remembered', displayName: 'remembered' }]);
    expect(state.sessionLabels['agent:main:remembered']).toBe('Remembered prompt');
    expect(state.messages).toEqual([
      expect.objectContaining({ role: 'user', content: 'Remember me' }),
      expect.objectContaining({ role: 'assistant', content: 'I remember.' }),
    ]);
  });

  it('loads hermes snapshot history without gateway rpc', async () => {
    const { useSettingsStore } = await import('@/stores/settings');
    const { useChatStore } = await import('@/stores/chat');

    useSettingsStore.setState({
      runtime: {
        installChoice: 'hermes',
        mode: 'hermes',
        installedKinds: ['hermes'],
        lastStandaloneRuntime: 'hermes',
      },
    });

    window.localStorage.setItem(HERMES_CHAT_SNAPSHOT_KEY, JSON.stringify({
      version: 1,
      sessions: [
        { key: 'agent:main:remembered', displayName: 'remembered' },
        { key: 'agent:main:other', displayName: 'other' },
      ],
      currentSessionKey: 'agent:main:remembered',
      currentAgentId: 'main',
      sessionLabels: {},
      sessionLastActivity: {},
      messagesBySession: {
        'agent:main:remembered': [
          { role: 'user', content: 'Remember me', timestamp: 1, id: 'u-1' },
        ],
        'agent:main:other': [
          { role: 'assistant', content: 'Other session history', timestamp: 2, id: 'a-2' },
        ],
      },
    }));

    useChatStore.setState({
      currentSessionKey: 'agent:main:other',
      currentAgentId: 'main',
      messages: [],
      sessions: [
        { key: 'agent:main:remembered', displayName: 'remembered' },
        { key: 'agent:main:other', displayName: 'other' },
      ],
      sessionLabels: {},
      sessionLastActivity: {},
      sending: false,
      activeRunId: null,
      streamingText: '',
      streamingMessage: null,
      streamingTools: [],
      pendingFinal: false,
      lastUserMessageAt: null,
      pendingToolImages: [],
      error: null,
      loading: false,
      thinkingLevel: null,
    });

    gatewayRpcMock.mockClear();

    await useChatStore.getState().loadHistory();

    expect(gatewayRpcMock).not.toHaveBeenCalled();
    expect(useChatStore.getState().messages).toEqual([
      expect.objectContaining({ role: 'assistant', content: 'Other session history' }),
    ]);
  });
});
