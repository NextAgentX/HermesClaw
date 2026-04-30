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
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

type HermesAgentManifest = {
  packageName: string;
  version: string;
  releaseTag: string;
  installSpec: string;
  pythonVersion: string;
  entrypoints: string[];
};

describe('HermesAgent packaging configuration', () => {
  it('pins HermesAgent outside npm and wires it into package builds', () => {
    const pkg = readJson<PackageJson>('package.json');
    const manifest = readJson<HermesAgentManifest>('resources/hermes-agent/manifest.json');

    expect(manifest).toMatchObject({
      packageName: 'hermes-agent',
      version: '0.11.0',
      releaseTag: 'v2026.4.23',
    });
    expect(manifest.installSpec).toContain('NousResearch/hermes-agent/archive/refs/tags/v2026.4.23.tar.gz');
    expect(manifest.pythonVersion).toMatch(/^3\.11(\.\d+)?$/);
    expect(manifest.entrypoints).toEqual(expect.arrayContaining(['hermes', 'hermes-agent', 'hermes-acp']));

    expect(pkg.dependencies).not.toHaveProperty('hermes-agent');
    expect(pkg.devDependencies).not.toHaveProperty('hermes-agent');
    expect(pkg.scripts['bundle:hermes-agent']).toBe('zx scripts/bundle-hermes-agent.mjs');
    expect(pkg.scripts.build).toContain('zx scripts/bundle-hermes-agent.mjs');
    expect(pkg.scripts.package).toContain('zx scripts/bundle-hermes-agent.mjs');
  });

  it('ships the staged HermesAgent runtime as a separate extra resource', () => {
    const electronBuilderConfig = readText('electron-builder.yml');

    expect(electronBuilderConfig).toContain('from: build/hermes-agent/');
    expect(electronBuilderConfig).toContain('to: hermes-agent/');
  });

  it('keeps the bundle script manifest-driven and checkable without network installs', () => {
    const bundleScript = readText('scripts/bundle-hermes-agent.mjs');

    expect(bundleScript).toContain("'resources', 'hermes-agent', 'manifest.json'");
    expect(bundleScript).toContain('argv.check');
    expect(bundleScript).toContain('resolveManifestOverrides');
    expect(bundleScript).toContain('HERMES_AGENT_VERSION');
    expect(bundleScript).toContain('HERMES_AGENT_RELEASE_TAG');
    expect(bundleScript).toContain('HERMES_AGENT_INSTALL_SPEC');
    expect(bundleScript).toContain('HERMES_AGENT_PYTHON_VERSION');
    expect(bundleScript).toContain("'build', 'hermes-agent'");
    expect(bundleScript).toContain("'pip', 'install'");
    expect(bundleScript).toContain('installSpec');
  });
});
