import { describe, expect, it } from 'vitest';

import { buildRuntimeInstallState } from '@electron/runtime/services/runtime-install-orchestrator';

describe('runtime install orchestrator', () => {
  it('maps both to openclaw primary plus hermes agent bridge state', () => {
    const result = buildRuntimeInstallState(
      {
        runtime: {
          installChoice: 'openclaw',
          mode: 'openclaw',
          installedKinds: ['openclaw'],
          lastStandaloneRuntime: 'openclaw',
        },
        bridge: {
          hermesAsOpenClawAgent: {
            enabled: false,
            attached: true,
            hermesInstalled: false,
            hermesHealthy: true,
            openclawRecognized: true,
            reasonCode: 'openclaw_recognition_pending',
            lastSyncAt: 123,
            lastError: 'old-error',
          },
        },
      },
      'both',
    );

    expect(result.runtime).toEqual({
      installChoice: 'both',
      mode: 'hermesclaw-both',
      installedKinds: ['openclaw', 'hermes'],
      lastStandaloneRuntime: 'openclaw',
    });
    expect(result.bridge).toEqual({
      hermesAsOpenClawAgent: {
        enabled: true,
        attached: true,
        hermesInstalled: true,
        hermesHealthy: true,
        openclawRecognized: true,
        reasonCode: 'openclaw_recognition_pending',
        lastSyncAt: 123,
        lastError: 'old-error',
      },
    });
  });

  it('maps openclaw choice to openclaw standalone while clearing stale bridge state', () => {
    const result = buildRuntimeInstallState(
      {
        runtime: {
          installChoice: 'both',
          mode: 'openclaw-with-hermes-agent',
          installedKinds: ['openclaw', 'hermes'],
          lastStandaloneRuntime: 'hermes',
        },
        bridge: {
          hermesAsOpenClawAgent: {
            enabled: true,
            attached: true,
            hermesInstalled: true,
            hermesHealthy: true,
            openclawRecognized: true,
            reasonCode: 'openclaw_recognition_pending',
            lastSyncAt: 456,
            lastError: 'bridge-warning',
          },
        },
      },
      'openclaw',
    );

    expect(result.runtime).toEqual({
      installChoice: 'openclaw',
      mode: 'openclaw',
      installedKinds: ['openclaw'],
      lastStandaloneRuntime: 'openclaw',
    });
    expect(result.bridge).toEqual({
      hermesAsOpenClawAgent: {
        enabled: false,
        attached: false,
        hermesInstalled: false,
        hermesHealthy: false,
        openclawRecognized: false,
        reasonCode: 'bridge_disabled',
        lastSyncAt: undefined,
        lastError: undefined,
      },
    });
  });

  it('maps hermes choice to hermes standalone while disabling bridge state', () => {
    const result = buildRuntimeInstallState(
      {
        runtime: {
          installChoice: 'both',
          mode: 'openclaw-with-hermes-agent',
          installedKinds: ['openclaw', 'hermes'],
          windowsHermesWslDistro: 'Ubuntu',
          lastStandaloneRuntime: 'openclaw',
        },
        bridge: {
          hermesAsOpenClawAgent: {
            enabled: true,
            attached: true,
            hermesInstalled: true,
            hermesHealthy: true,
            openclawRecognized: true,
            reasonCode: 'openclaw_recognition_pending',
            lastSyncAt: 456,
            lastError: 'bridge-warning',
          },
        },
      },
      'hermes',
    );

    expect(result.runtime).toEqual({
      installChoice: 'hermes',
      mode: 'hermes',
      installedKinds: ['hermes'],
      windowsHermesWslDistro: 'Ubuntu',
      lastStandaloneRuntime: 'hermes',
    });
    expect(result.bridge).toEqual({
      hermesAsOpenClawAgent: {
        enabled: false,
        attached: false,
        hermesInstalled: true,
        hermesHealthy: false,
        openclawRecognized: false,
        reasonCode: 'bridge_disabled',
        lastSyncAt: undefined,
        lastError: undefined,
      },
    });
  });
});
