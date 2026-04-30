import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();

function readJson<T>(relativePath: string): T {
  return JSON.parse(readFileSync(join(ROOT, relativePath), 'utf8')) as T;
}

function readText(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), 'utf8');
}

type PackageJson = {
  scripts: Record<string, string>;
  devDependencies?: Record<string, string>;
};

describe('OpenClaw packaging configuration', () => {
  it('keeps OpenClaw pinned by default while exposing a bundle command', () => {
    const pkg = readJson<PackageJson>('package.json');

    expect(pkg.devDependencies?.openclaw).toBe('2026.4.15');
    expect(pkg.scripts['bundle:openclaw']).toBe('zx scripts/bundle-openclaw.mjs');
    expect(pkg.scripts.build).toContain('zx scripts/bundle-openclaw.mjs');
    expect(pkg.scripts.package).toContain('zx scripts/bundle-openclaw.mjs');
  });

  it('supports build-time OpenClaw version overrides without editing package.json', () => {
    const bundleScript = readText('scripts/bundle-openclaw.mjs');

    expect(bundleScript).toContain('OPENCLAW_VERSION');
    expect(bundleScript).toContain('OPENCLAW_PACKAGE_SPEC');
    expect(bundleScript).toContain('resolveOpenClawSource');
    expect(bundleScript).toContain("'build', '.openclaw-source'");
    expect(bundleScript).toContain('pnpm add');
  });
});
