import { beforeEach, describe, expect, it, vi } from 'vitest';

const syncHermesClawSharedConfigMock = vi.fn();
const loggerWarnMock = vi.fn();

vi.mock('@electron/runtime/services/hermesclaw-local-integration-service', () => ({
  syncHermesClawSharedConfig: (...args: unknown[]) => syncHermesClawSharedConfigMock(...args),
}));

vi.mock('@electron/utils/logger', () => ({
  logger: {
    warn: (...args: unknown[]) => loggerWarnMock(...args),
  },
}));

describe('HermesClaw shared config incremental sync scheduler', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('debounces incremental sync requests into one main-process write', async () => {
    syncHermesClawSharedConfigMock.mockResolvedValue({ dryRun: false, scope: 'incremental', changes: [], log: [] });

    const { scheduleHermesClawSharedConfigSync, cancelScheduledHermesClawSharedConfigSync } = await import(
      '@electron/main/hermesclaw-shared-config-sync'
    );

    scheduleHermesClawSharedConfigSync('incremental', 50);
    scheduleHermesClawSharedConfigSync('incremental', 50);
    await vi.advanceTimersByTimeAsync(49);
    expect(syncHermesClawSharedConfigMock).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);

    expect(syncHermesClawSharedConfigMock).toHaveBeenCalledOnce();
    expect(syncHermesClawSharedConfigMock).toHaveBeenCalledWith({ dryRun: false, scope: 'incremental' });
    cancelScheduledHermesClawSharedConfigSync();
  });

  it('logs sync failures without throwing into IPC callers', async () => {
    const error = new Error('adapter failed');
    syncHermesClawSharedConfigMock.mockRejectedValue(error);

    const { scheduleHermesClawSharedConfigSync } = await import('@electron/main/hermesclaw-shared-config-sync');

    scheduleHermesClawSharedConfigSync('incremental', 10);
    await vi.advanceTimersByTimeAsync(10);
    await Promise.resolve();

    expect(loggerWarnMock).toHaveBeenCalledWith(
      'Failed to sync HermesClaw shared config after configuration change:',
      error,
    );
  });
});
