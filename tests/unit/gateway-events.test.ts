import { beforeEach, describe, expect, it, vi } from 'vitest';

const hostApiFetchMock = vi.fn();
const subscribeHostEventMock = vi.fn();

vi.mock('@/lib/host-api', () => ({
  hostApiFetch: (...args: unknown[]) => hostApiFetchMock(...args),
}));

vi.mock('@/lib/host-events', () => ({
  subscribeHostEvent: (...args: unknown[]) => subscribeHostEventMock(...args),
}));

describe('gateway store event wiring', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.useRealTimers();
    window.electron.ipcRenderer.invoke = vi.fn();
  });

  it('subscribes to host events through subscribeHostEvent on init', async () => {
    hostApiFetchMock.mockResolvedValueOnce({ state: 'running', port: 18789 });

    const handlers = new Map<string, (payload: unknown) => void>();
    subscribeHostEventMock.mockImplementation((eventName: string, handler: (payload: unknown) => void) => {
      handlers.set(eventName, handler);
      return () => {};
    });

    const { useGatewayStore } = await import('@/stores/gateway');
    await useGatewayStore.getState().init();

    expect(subscribeHostEventMock).toHaveBeenCalledWith('gateway:status', expect.any(Function));
    expect(subscribeHostEventMock).toHaveBeenCalledWith('gateway:error', expect.any(Function));
    expect(subscribeHostEventMock).toHaveBeenCalledWith('gateway:notification', expect.any(Function));
    expect(subscribeHostEventMock).toHaveBeenCalledWith('gateway:chat-message', expect.any(Function));
    expect(subscribeHostEventMock).toHaveBeenCalledWith('gateway:channel-status', expect.any(Function));

    handlers.get('gateway:status')?.({ state: 'stopped', port: 18789 });
    expect(useGatewayStore.getState().status.state).toBe('stopped');
  });

  it('propagates gatewayReady field from status events', async () => {
    hostApiFetchMock.mockResolvedValueOnce({ state: 'running', port: 18789, gatewayReady: false });

    const handlers = new Map<string, (payload: unknown) => void>();
    subscribeHostEventMock.mockImplementation((eventName: string, handler: (payload: unknown) => void) => {
      handlers.set(eventName, handler);
      return () => {};
    });

    const { useGatewayStore } = await import('@/stores/gateway');
    await useGatewayStore.getState().init();

    // Initially gatewayReady=false from the status fetch
    expect(useGatewayStore.getState().status.gatewayReady).toBe(false);

    // Simulate gateway.ready event setting gatewayReady=true
    handlers.get('gateway:status')?.({ state: 'running', port: 18789, gatewayReady: true });
    expect(useGatewayStore.getState().status.gatewayReady).toBe(true);
  });

  it('treats undefined gatewayReady as ready for backwards compatibility', async () => {
    hostApiFetchMock.mockResolvedValueOnce({ state: 'running', port: 18789 });

    const handlers = new Map<string, (payload: unknown) => void>();
    subscribeHostEventMock.mockImplementation((eventName: string, handler: (payload: unknown) => void) => {
      handlers.set(eventName, handler);
      return () => {};
    });

    const { useGatewayStore } = await import('@/stores/gateway');
    await useGatewayStore.getState().init();

    const status = useGatewayStore.getState().status;
    // gatewayReady is undefined (old gateway version) — should be treated as ready
    expect(status.gatewayReady).toBeUndefined();
    expect(status.state === 'running' && status.gatewayReady !== false).toBe(true);
  });

  it('refreshes gatewayReady from the post-listener status refetch even when state is unchanged', async () => {
    hostApiFetchMock
      .mockResolvedValueOnce({ state: 'running', port: 18789, gatewayReady: false })
      .mockResolvedValueOnce({ state: 'running', port: 18789, gatewayReady: true });

    subscribeHostEventMock.mockImplementation(() => () => {});

    const { useGatewayStore } = await import('@/stores/gateway');
    await useGatewayStore.getState().init();

    expect(useGatewayStore.getState().status).toEqual(
      expect.objectContaining({ state: 'running', gatewayReady: true }),
    );
  });

  it('reconciles gatewayReady drift on the periodic IPC status check even when state is unchanged', async () => {
    vi.useFakeTimers();
    hostApiFetchMock
      .mockResolvedValueOnce({ state: 'running', port: 18789, gatewayReady: false })
      .mockResolvedValueOnce({ state: 'running', port: 18789, gatewayReady: false });

    subscribeHostEventMock.mockImplementation(() => () => {});
    window.electron.ipcRenderer.invoke = vi.fn().mockResolvedValue({
      state: 'running',
      port: 18789,
      gatewayReady: true,
    });

    const { useGatewayStore } = await import('@/stores/gateway');
    await useGatewayStore.getState().init();

    expect(useGatewayStore.getState().status.gatewayReady).toBe(false);

    await vi.advanceTimersByTimeAsync(30_000);

    expect(useGatewayStore.getState().status).toEqual(
      expect.objectContaining({ state: 'running', gatewayReady: true }),
    );
  });
});
