import { beforeEach, describe, expect, it, vi } from 'vitest';

const syncRuntimeStartupMock = vi.fn();
const loggerWarnMock = vi.fn();

vi.mock('@electron/runtime/services/runtime-startup-coordinator', () => ({
  syncRuntimeStartup: (...args: unknown[]) => syncRuntimeStartupMock(...args),
}));

vi.mock('@electron/utils/logger', () => ({
  logger: {
    warn: (...args: unknown[]) => loggerWarnMock(...args),
  },
}));

describe('scheduleRuntimeStartupSync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('swallows runtime startup rejection and logs a warning', async () => {
    const error = new Error('bridge attach failed');
    syncRuntimeStartupMock.mockRejectedValue(error);

    const { scheduleRuntimeStartupSync } = await import('@electron/main/runtime-startup-sync');
    const gatewayManager = { getStatus: () => ({ state: 'running' }) };

    expect(() => {
      scheduleRuntimeStartupSync(
        gatewayManager as never,
        'Failed to sync runtime startup during initialization:',
      );
    }).not.toThrow();

    await Promise.resolve();
    await Promise.resolve();

    expect(syncRuntimeStartupMock).toHaveBeenCalledOnce();
    expect(syncRuntimeStartupMock).toHaveBeenCalledWith(gatewayManager);
    expect(loggerWarnMock).toHaveBeenCalledWith(
      'Failed to sync runtime startup during initialization:',
      error,
    );
  });

  it('does not log when runtime startup sync succeeds', async () => {
    syncRuntimeStartupMock.mockResolvedValue(undefined);

    const { scheduleRuntimeStartupSync } = await import('@electron/main/runtime-startup-sync');

    scheduleRuntimeStartupSync(
      { getStatus: () => ({ state: 'running' }) } as never,
      'Failed to sync runtime startup after gateway reconnect:',
    );

    await Promise.resolve();

    expect(syncRuntimeStartupMock).toHaveBeenCalledOnce();
    expect(loggerWarnMock).not.toHaveBeenCalled();
  });
});
