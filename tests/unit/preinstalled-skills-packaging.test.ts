import { describe, expect, it } from 'vitest';

import {
  createArchiveFileName,
  createRepoDirName,
  normalizeRepoPath,
} from '../../scripts/preinstalled-helpers.mjs';

describe('preinstalled skills packaging helpers', () => {
  it('creates repository temp directory names without path separators or drive prefixes', () => {
    expect(createRepoDirName('anthropics/skills', 'main')).toBe('anthropics_skills__main');

    const dirName = createRepoDirName('D:/_04_OpenCode/HermesClaw-Dev', 'refs/heads/feature/x');
    expect(dirName).toBe('D___04_OpenCode_HermesClaw-Dev__refs_heads_feature_x');
    expect(dirName).not.toMatch(/[:/\\\uF03A]/u);
  });

  it('falls back when repository or ref names sanitize to empty strings', () => {
    expect(createRepoDirName(':::', '///')).toBe('repo__ref');
  });

  it('normalizes sparse repository paths for git archive input', () => {
    expect(normalizeRepoPath('\\skills\\pdf\\')).toBe('skills/pdf');
    expect(normalizeRepoPath('/skills/pdf/')).toBe('skills/pdf');
  });

  it('creates a relative archive filename from a Windows absolute path', () => {
    expect(createArchiveFileName('D:\\_04_OpenCode\\HermesClaw-main\\build\\.tmp-preinstalled-skills\\.subset.tar')).toBe(
      '.subset.tar'
    );
  });
});
