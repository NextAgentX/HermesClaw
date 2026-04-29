import { beforeEach, describe, expect, it, vi } from 'vitest';

const invokeIpcMock = vi.fn();

vi.mock('@/lib/api-client', () => ({
  invokeIpc: (...args: unknown[]) => invokeIpcMock(...args),
}));

describe('host-api', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    window.localStorage.removeItem('hermesclaw:allow-localhost-fallback');
  });

  it('uses IPC proxy and returns unified envelope json', async () => {
    invokeIpcMock.mockResolvedValueOnce({
      ok: true,
      data: {
        status: 200,
        ok: true,
        json: { success: true },
      },
    });

    const { hostApiFetch } = await import('@/lib/host-api');
    const result = await hostApiFetch<{ success: boolean }>('/api/settings');

    expect(result.success).toBe(true);
    expect(invokeIpcMock).toHaveBeenCalledWith(
      'hostapi:fetch',
      expect.objectContaining({ path: '/api/settings', method: 'GET' }),
    );
  });

  it('provides runtime and bridge wrapper helpers', async () => {
    invokeIpcMock
      .mockResolvedValueOnce({
        ok: true,
        data: {
          status: 200,
          ok: true,
          json: {
            installChoice: 'both',
            mode: 'hermesclaw-both',
          },
        },
      })
      .mockResolvedValueOnce({
        ok: true,
        data: {
          status: 200,
          ok: true,
          json: { success: true, mode: 'hermesclaw-both' },
        },
      })
      .mockResolvedValueOnce({
        ok: true,
        data: {
          status: 200,
          ok: true,
          json: {
            installChoice: 'both',
          },
        },
      })
      .mockResolvedValueOnce({
        ok: true,
        data: {
          status: 200,
          ok: true,
          json: { success: true, installChoice: 'both' },
        },
      })
      .mockResolvedValueOnce({
        ok: true,
        data: {
          status: 200,
          ok: true,
          json: {
            success: true,
            installChoice: 'both',
            steps: [
              { id: 'openclaw', kind: 'runtime', status: 'completed', label: 'OpenClaw runtime installation' },
            ],
            snapshot: {
              runtime: {
                installChoice: 'both',
                mode: 'hermesclaw-both',
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
          },
        },
      })
      .mockResolvedValueOnce({
        ok: true,
        data: {
          status: 200,
          ok: true,
          json: {
            checkedAt: 123,
            runtime: {
              installChoice: 'both',
              mode: 'hermesclaw-both',
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
            summary: {
              primaryRuntimeKind: 'openclaw',
              primaryRuntimeHealthy: true,
              bridgeRequired: true,
              bridgeReady: false,
              issues: [],
            },
          },
        },
      })
      .mockResolvedValueOnce({
        ok: true,
        data: {
          status: 200,
          ok: true,
          json: {
            runtime: {
              installChoice: 'both',
              mode: 'hermesclaw-both',
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
        },
      })
      .mockResolvedValueOnce({
        ok: true,
        data: {
          status: 200,
          ok: true,
          json: { success: true },
        },
      })
      .mockResolvedValueOnce({
        ok: true,
        data: {
          status: 200,
          ok: true,
          json: { success: true },
        },
      })
      .mockResolvedValueOnce({
        ok: true,
        data: {
          status: 200,
          ok: true,
          json: { success: true },
        },
      })
      .mockResolvedValueOnce({
        ok: true,
        data: {
          status: 200,
          ok: true,
          json: { status: 'ok' },
        },
      })
      .mockResolvedValueOnce({
        ok: true,
        data: {
          status: 200,
          ok: true,
          json: { healthy: true },
        },
      })
      .mockResolvedValueOnce({
        ok: true,
        data: {
          status: 200,
          ok: true,
          json: { data: [{ id: 'hermes-model' }] },
        },
      })
      .mockResolvedValueOnce({
        ok: true,
        data: {
          status: 200,
          ok: true,
          json: { choices: [{ message: { role: 'assistant', content: 'hi' } }] },
        },
      });

    const {
      attachHermesOpenClawBridge,
      detachHermesOpenClawBridge,
      getRuntimeInstallChoice,
      getHermesRuntimeHealth,
      getHermesRuntimeModels,
      getHermesRuntimeStatus,
      getRuntimeMode,
      getRuntimeStatus,
      installRuntime,
      recheckHermesOpenClawBridge,
      runRuntimeHealthCheck,
      sendHermesRuntimeChatCompletion,
      setRuntimeInstallChoice,
      setRuntimeMode,
    } = await import('@/lib/host-api');

    const mode = await getRuntimeMode();
    await setRuntimeMode('hermesclaw-both');
    const installChoice = await getRuntimeInstallChoice();
    await setRuntimeInstallChoice('both');
    const installResult = await installRuntime('both');
    const health = await runRuntimeHealthCheck();
    const snapshot = await getRuntimeStatus();
    await attachHermesOpenClawBridge();
    await detachHermesOpenClawBridge();
    await recheckHermesOpenClawBridge();
    const hermesStatus = await getHermesRuntimeStatus<{ status: string }>();
    const hermesHealth = await getHermesRuntimeHealth<{ healthy: boolean }>();
    const hermesModels = await getHermesRuntimeModels<{ data: Array<{ id: string }> }>();
    const hermesChat = await sendHermesRuntimeChatCompletion<{ choices: Array<{ message: { content: string } }> }>({
      model: 'hermes-model',
      messages: [{ role: 'user', content: 'hello' }],
    });

    expect(mode.mode).toBe('hermesclaw-both');
    expect(installChoice.installChoice).toBe('both');
    expect(installResult.installChoice).toBe('both');
    expect(health.checkedAt).toBe(123);
    expect(snapshot.runtime.mode).toBe('hermesclaw-both');
    expect(hermesStatus.status).toBe('ok');
    expect(hermesHealth.healthy).toBe(true);
    expect(hermesModels.data[0].id).toBe('hermes-model');
    expect(hermesChat.choices[0].message.content).toBe('hi');
    expect(invokeIpcMock).toHaveBeenNthCalledWith(
      1,
      'hostapi:fetch',
      expect.objectContaining({ path: '/api/runtime/mode', method: 'GET' }),
    );
    expect(invokeIpcMock).toHaveBeenNthCalledWith(
      2,
      'hostapi:fetch',
      expect.objectContaining({ path: '/api/runtime/mode', method: 'PUT', body: JSON.stringify({ mode: 'hermesclaw-both' }) }),
    );
    expect(invokeIpcMock).toHaveBeenNthCalledWith(
      3,
      'hostapi:fetch',
      expect.objectContaining({ path: '/api/runtime/install-choice', method: 'GET' }),
    );
    expect(invokeIpcMock).toHaveBeenNthCalledWith(
      4,
      'hostapi:fetch',
      expect.objectContaining({ path: '/api/runtime/install-choice', method: 'PUT', body: JSON.stringify({ installChoice: 'both' }) }),
    );
    expect(invokeIpcMock).toHaveBeenNthCalledWith(
      5,
      'hostapi:fetch',
      expect.objectContaining({ path: '/api/runtime/install', method: 'POST', body: JSON.stringify({ installChoice: 'both' }) }),
    );
    expect(invokeIpcMock).toHaveBeenNthCalledWith(
      6,
      'hostapi:fetch',
      expect.objectContaining({ path: '/api/runtime/health-check', method: 'POST' }),
    );
    expect(invokeIpcMock).toHaveBeenNthCalledWith(
      7,
      'hostapi:fetch',
      expect.objectContaining({ path: '/api/runtime/status', method: 'GET' }),
    );
    expect(invokeIpcMock).toHaveBeenNthCalledWith(
      8,
      'hostapi:fetch',
      expect.objectContaining({ path: '/api/bridges/hermes-openclaw/attach', method: 'POST' }),
    );
    expect(invokeIpcMock).toHaveBeenNthCalledWith(
      9,
      'hostapi:fetch',
      expect.objectContaining({ path: '/api/bridges/hermes-openclaw/detach', method: 'POST' }),
    );
    expect(invokeIpcMock).toHaveBeenNthCalledWith(
      10,
      'hostapi:fetch',
      expect.objectContaining({ path: '/api/bridges/hermes-openclaw/recheck', method: 'POST' }),
    );
    expect(invokeIpcMock).toHaveBeenNthCalledWith(
      11,
      'hostapi:fetch',
      expect.objectContaining({ path: '/api/runtime/hermes/status', method: 'GET' }),
    );
    expect(invokeIpcMock).toHaveBeenNthCalledWith(
      12,
      'hostapi:fetch',
      expect.objectContaining({ path: '/api/runtime/hermes/health', method: 'GET' }),
    );
    expect(invokeIpcMock).toHaveBeenNthCalledWith(
      13,
      'hostapi:fetch',
      expect.objectContaining({ path: '/api/runtime/hermes/models', method: 'GET' }),
    );
    expect(invokeIpcMock).toHaveBeenNthCalledWith(
      14,
      'hostapi:fetch',
      expect.objectContaining({
        path: '/api/runtime/hermes/chat/completions',
        method: 'POST',
        body: JSON.stringify({
          model: 'hermes-model',
          messages: [{ role: 'user', content: 'hello' }],
        }),
      }),
    );
  });

  it('supports legacy proxy envelope response', async () => {
    invokeIpcMock.mockResolvedValueOnce({
      success: true,
      status: 200,
      ok: true,
      json: { ok: 1 },
    });

    const { hostApiFetch } = await import('@/lib/host-api');
    const result = await hostApiFetch<{ ok: number }>('/api/settings');
    expect(result.ok).toBe(1);
  });

  it('falls back to browser fetch when hostapi handler is not registered', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ fallback: true }),
    });
    vi.stubGlobal('fetch', fetchMock);
    window.localStorage.setItem('hermesclaw:allow-localhost-fallback', '1');

    invokeIpcMock.mockResolvedValueOnce({
      ok: false,
      error: { message: 'No handler registered for hostapi:fetch' },
    });

    const { hostApiFetch } = await import('@/lib/host-api');
    const result = await hostApiFetch<{ fallback: boolean }>('/api/test');

    expect(result.fallback).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:13210/api/test',
      expect.objectContaining({ headers: expect.any(Object) }),
    );
  });

  it('throws message from legacy non-ok envelope', async () => {
    invokeIpcMock.mockResolvedValueOnce({
      success: true,
      ok: false,
      status: 401,
      json: { error: 'Invalid Authentication' },
    });

    const { hostApiFetch } = await import('@/lib/host-api');
    await expect(hostApiFetch('/api/test')).rejects.toThrow('Invalid Authentication');
  });

  it('falls back to browser fetch only when IPC channel is unavailable', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ fallback: true }),
    });
    vi.stubGlobal('fetch', fetchMock);
    window.localStorage.setItem('hermesclaw:allow-localhost-fallback', '1');

    invokeIpcMock.mockRejectedValueOnce(new Error('Invalid IPC channel: hostapi:fetch'));

    const { hostApiFetch } = await import('@/lib/host-api');
    const result = await hostApiFetch<{ fallback: boolean }>('/api/test');

    expect(result.fallback).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:13210/api/test',
      expect.objectContaining({ headers: expect.any(Object) }),
    );
  });

  it('does not use localhost fallback when policy flag is disabled', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ fallback: true }),
    });
    vi.stubGlobal('fetch', fetchMock);

    invokeIpcMock.mockRejectedValueOnce(new Error('Invalid IPC channel: hostapi:fetch'));

    const { hostApiFetch } = await import('@/lib/host-api');
    await expect(hostApiFetch('/api/test')).rejects.toThrow('Invalid IPC channel: hostapi:fetch');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
