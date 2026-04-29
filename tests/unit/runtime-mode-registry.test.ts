import { describe, expect, it } from 'vitest';

import {
  HERMESCLAW_BOTH_MODE,
  LEGACY_HERMES_BOTH_MODE,
  hostRuntimeKindFromMode,
  installChoiceFromMode,
  installedKindsFromChoice,
  isHermesClawBothMode,
  normalizeInstalledKinds,
  runtimeModeFromInstallChoice,
} from '@electron/runtime/mode-registry';

describe('runtime mode registry', () => {
  it('maps both install choice to the canonical HermesClaw both mode', () => {
    expect(runtimeModeFromInstallChoice('both')).toBe(HERMESCLAW_BOTH_MODE);
    expect(installedKindsFromChoice('both')).toEqual(['openclaw', 'hermes']);
  });

  it('maps runtime modes back to install choices', () => {
    expect(installChoiceFromMode('openclaw')).toBe('openclaw');
    expect(installChoiceFromMode('hermes')).toBe('hermes');
    expect(installChoiceFromMode(HERMESCLAW_BOTH_MODE)).toBe('both');
    expect(installChoiceFromMode(LEGACY_HERMES_BOTH_MODE)).toBe('both');
  });

  it('recognizes canonical and legacy HermesClaw both modes', () => {
    expect(isHermesClawBothMode(HERMESCLAW_BOTH_MODE)).toBe(true);
    expect(isHermesClawBothMode(LEGACY_HERMES_BOTH_MODE)).toBe(true);
    expect(isHermesClawBothMode('openclaw')).toBe(false);
    expect(isHermesClawBothMode('hermes')).toBe(false);
  });

  it('selects the host runtime kind for each mode', () => {
    expect(hostRuntimeKindFromMode('openclaw')).toBe('openclaw');
    expect(hostRuntimeKindFromMode('hermes')).toBe('hermes');
    expect(hostRuntimeKindFromMode(HERMESCLAW_BOTH_MODE)).toBe('openclaw');
    expect(hostRuntimeKindFromMode(LEGACY_HERMES_BOTH_MODE)).toBe('openclaw');
  });

  it('derives installed kinds from mode when persisted kinds are missing', () => {
    expect(normalizeInstalledKinds(undefined, 'openclaw')).toEqual(['openclaw']);
    expect(normalizeInstalledKinds(undefined, 'hermes')).toEqual(['hermes']);
    expect(normalizeInstalledKinds(undefined, HERMESCLAW_BOTH_MODE)).toEqual(['openclaw', 'hermes']);
    expect(normalizeInstalledKinds(undefined, LEGACY_HERMES_BOTH_MODE)).toEqual(['openclaw', 'hermes']);
  });

  it('deduplicates persisted installed kinds', () => {
    expect(normalizeInstalledKinds(['hermes', 'openclaw', 'hermes'], 'openclaw')).toEqual(['hermes', 'openclaw']);
  });
});
