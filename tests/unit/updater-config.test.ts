import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();

function readText(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), 'utf8');
}

describe('updater release source configuration', () => {
  it('uses only NextAgentX/HermesClaw GitHub Releases for packaged updates', () => {
    const config = readText('electron-builder.yml');

    expect(config).toContain('provider: github');
    expect(config).toContain('owner: NextAgentX');
    expect(config).toContain('repo: HermesClaw');
    expect(config).not.toContain('oss.intelli-spectrum.com');
    expect(config).not.toContain('NextAgentX-ai');
  });

  it('does not override electron-updater to the old OSS feed at runtime', () => {
    const updater = readText('electron/main/updater.ts');

    expect(updater).not.toContain('OSS_BASE_URL');
    expect(updater).not.toContain('setFeedURL');
    expect(updater).not.toContain('oss.intelli-spectrum.com');
  });
});
