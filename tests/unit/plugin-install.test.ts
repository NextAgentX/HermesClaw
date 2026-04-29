import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockExistsSync,
  mockCpSync,
  mockCopyFileSync,
  mockStatSync,
  mockMkdirSync,
  mockRmSync,
  mockReadFileSync,
  mockWriteFileSync,
  mockReaddirSync,
  mockRealpathSync,
  mockLoggerWarn,
  mockLoggerInfo,
  mockHomedir,
  mockApp,
} = vi.hoisted(() => ({
  mockExistsSync: vi.fn(),
  mockCpSync: vi.fn(),
  mockCopyFileSync: vi.fn(),
  mockStatSync: vi.fn(() => ({ isDirectory: () => false })),
  mockMkdirSync: vi.fn(),
  mockRmSync: vi.fn(),
  mockReadFileSync: vi.fn(),
  mockWriteFileSync: vi.fn(),
  mockReaddirSync: vi.fn(),
  mockRealpathSync: vi.fn(),
  mockLoggerWarn: vi.fn(),
  mockLoggerInfo: vi.fn(),
  mockHomedir: vi.fn(() => '/home/test'),
  mockApp: {
    isPackaged: true,
    getAppPath: vi.fn(() => '/mock/app'),
  },
}));

const ORIGINAL_PLATFORM_DESCRIPTOR = Object.getOwnPropertyDescriptor(process, 'platform');

vi.mock('node:fs', async () => {
  const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
  const mocked = {
    ...actual,
    existsSync: mockExistsSync,
    cpSync: mockCpSync,
    copyFileSync: mockCopyFileSync,
    statSync: mockStatSync,
    mkdirSync: mockMkdirSync,
    rmSync: mockRmSync,
    readFileSync: mockReadFileSync,
    writeFileSync: mockWriteFileSync,
    readdirSync: mockReaddirSync,
    realpathSync: mockRealpathSync,
  };
  return {
    ...mocked,
    default: mocked,
  };
});

vi.mock('node:fs/promises', async () => {
  const actual = await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises');
  return {
    ...actual,
    readdir: vi.fn(),
    stat: vi.fn(),
    copyFile: vi.fn(),
    mkdir: vi.fn(),
  };
});

vi.mock('node:os', () => ({
  homedir: () => mockHomedir(),
  default: {
    homedir: () => mockHomedir(),
  },
}));

vi.mock('electron', () => ({
  app: mockApp,
}));

vi.mock('@electron/utils/logger', () => ({
  logger: {
    warn: mockLoggerWarn,
    info: mockLoggerInfo,
  },
}));

function setPlatform(platform: NodeJS.Platform): void {
  Object.defineProperty(process, 'platform', {
    value: platform,
    configurable: true,
  });
}

describe('plugin installer diagnostics', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockApp.isPackaged = true;
    mockHomedir.mockReturnValue('/home/test');
    setPlatform('linux');

    mockExistsSync.mockReturnValue(false);
    mockCpSync.mockImplementation(() => undefined);
    mockMkdirSync.mockImplementation(() => undefined);
    mockRmSync.mockImplementation(() => undefined);
    mockReadFileSync.mockReturnValue('{}');
    mockWriteFileSync.mockImplementation(() => undefined);
    mockReaddirSync.mockReturnValue([]);
    mockRealpathSync.mockImplementation((input: string) => input);
  });

  afterEach(() => {
    if (ORIGINAL_PLATFORM_DESCRIPTOR) {
      Object.defineProperty(process, 'platform', ORIGINAL_PLATFORM_DESCRIPTOR);
    }
  });

  it('returns source-missing warning when bundled mirror cannot be found', async () => {
    const { ensurePluginInstalled } = await import('@electron/utils/plugin-install');
    const result = ensurePluginInstalled('wecom', ['/bundle/wecom'], 'WeCom');

    expect(result.installed).toBe(false);
    expect(result.warning).toContain('Bundled WeCom plugin mirror not found');
    expect(mockLoggerWarn).not.toHaveBeenCalled();
  });

  it('retries once on Windows and logs diagnostic details when bundled copy fails', async () => {
    setPlatform('win32');
    mockHomedir.mockReturnValue('C:\\Users\\test');

    const sourceDir = 'C:\\Program Files\\HermesClaw\\resources\\openclaw-plugins\\wecom';
    const sourceManifestSuffix = 'Program Files\\HermesClaw\\resources\\openclaw-plugins\\wecom\\openclaw.plugin.json';

    mockExistsSync.mockImplementation((input: string) => String(input).includes(sourceManifestSuffix));
    // On win32, cpSyncSafe uses _copyDirSyncRecursive (readdirSync) instead of cpSync.
    // Simulate copy failure by making readdirSync throw during directory traversal.
    mockReaddirSync.mockImplementation((_path: string, opts?: unknown) => {
      if (opts && typeof opts === 'object' && 'withFileTypes' in (opts as Record<string, unknown>)) {
        const error = new Error('path too long') as NodeJS.ErrnoException;
        error.code = 'ENAMETOOLONG';
        throw error;
      }
      return [];
    });

    const { ensurePluginInstalled } = await import('@electron/utils/plugin-install');
    const result = ensurePluginInstalled('wecom', [sourceDir], 'WeCom');

    expect(result).toEqual({
      installed: false,
      warning: 'Failed to install bundled WeCom plugin mirror',
    });

    // On win32, cpSyncSafe walks the directory via readdirSync (with withFileTypes)
    const copyAttempts = mockReaddirSync.mock.calls.filter(
      (call: unknown[]) => {
        const opts = call[1];
        return opts && typeof opts === 'object' && 'withFileTypes' in (opts as Record<string, unknown>);
      },
    );
    expect(copyAttempts).toHaveLength(2); // initial + 1 retry
    const firstSrcPath = String(copyAttempts[0][0]);
    expect(firstSrcPath.startsWith('\\\\?\\')).toBe(true);

    expect(mockLoggerWarn).toHaveBeenCalledWith(
      '[plugin] Bundled mirror install failed for WeCom',
      expect.objectContaining({
        pluginDirName: 'wecom',
        pluginLabel: 'WeCom',
        sourceDir,
        platform: 'win32',
        attempts: [
          expect.objectContaining({ attempt: 1, code: 'ENAMETOOLONG' }),
          expect.objectContaining({ attempt: 2, code: 'ENAMETOOLONG' }),
        ],
      }),
    );
  });

  it('logs EPERM diagnostics with source and target paths', async () => {
    setPlatform('win32');
    mockHomedir.mockReturnValue('C:\\Users\\test');

    const sourceDir = 'C:\\Program Files\\HermesClaw\\resources\\openclaw-plugins\\wecom';
    const sourceManifestSuffix = 'Program Files\\HermesClaw\\resources\\openclaw-plugins\\wecom\\openclaw.plugin.json';

    mockExistsSync.mockImplementation((input: string) => String(input).includes(sourceManifestSuffix));
    // On win32, cpSyncSafe uses _copyDirSyncRecursive (readdirSync) instead of cpSync.
    mockReaddirSync.mockImplementation((_path: string, opts?: unknown) => {
      if (opts && typeof opts === 'object' && 'withFileTypes' in (opts as Record<string, unknown>)) {
        const error = new Error('access denied') as NodeJS.ErrnoException;
        error.code = 'EPERM';
        throw error;
      }
      return [];
    });

    const { ensurePluginInstalled } = await import('@electron/utils/plugin-install');
    const result = ensurePluginInstalled('wecom', [sourceDir], 'WeCom');

    expect(result.installed).toBe(false);
    expect(result.warning).toBe('Failed to install bundled WeCom plugin mirror');

    expect(mockLoggerWarn).toHaveBeenCalledWith(
      '[plugin] Bundled mirror install failed for WeCom',
      expect.objectContaining({
        pluginDirName: 'wecom',
        pluginLabel: 'WeCom',
        sourceDir,
        targetDir: expect.stringContaining('wecom'),
        platform: 'win32',
        attempts: [
          expect.objectContaining({ attempt: 1, code: 'EPERM' }),
          expect.objectContaining({ attempt: 2, code: 'EPERM' }),
        ],
      }),
    );
  });

  it('falls back to the raw node_modules path when realpath fails in dev mode', async () => {
    mockApp.isPackaged = false;

    const npmPkgPath = path.join(process.cwd(), 'node_modules', '@larksuite', 'openclaw-lark');
    const npmManifestPath = path.join(npmPkgPath, 'openclaw.plugin.json');
    const npmPackageJsonPath = path.join(npmPkgPath, 'package.json');
    const sdkPackagePath = path.join(process.cwd(), 'node_modules', '.pnpm', '@larksuiteoapi+node-sdk@1.60.0', 'node_modules', '@larksuiteoapi', 'node-sdk');
    const sdkPackageJsonPath = path.join(sdkPackagePath, 'package.json');
    const sdkVirtualNodeModules = path.dirname(path.dirname(sdkPackagePath));
    const sdkScopeDir = path.join(sdkVirtualNodeModules, '@larksuiteoapi');
    const targetDir = path.join('/home/test', '.openclaw', 'extensions', 'feishu-openclaw-plugin');
    const targetManifestPath = path.join(targetDir, 'openclaw.plugin.json');
    const targetPackageJsonPath = path.join(targetDir, 'package.json');
    const targetNodeModulesDir = path.join(targetDir, 'node_modules');
    const targetSdkDir = path.join(targetNodeModulesDir, '@larksuiteoapi', 'node-sdk');
    let targetManifestExists = false;
    let targetPluginCopied = false;

    mockExistsSync.mockImplementation((input: string) => {
      return input === npmManifestPath
        || input === path.join(process.cwd(), 'node_modules', '@larksuiteoapi', 'node-sdk', 'package.json')
        || input === targetPackageJsonPath
        || input === targetNodeModulesDir
        || input === sdkVirtualNodeModules
        || input === sdkScopeDir
        || input === sdkPackageJsonPath
        || (input === targetManifestPath && targetManifestExists);
    });

    mockReadFileSync.mockImplementation((input: string) => {
      if (input === npmPackageJsonPath) {
        return JSON.stringify({
          version: '2026.4.8',
          dependencies: {
            '@larksuiteoapi/node-sdk': '^1.60.0',
          },
        });
      }
      if (input === targetPackageJsonPath) {
        if (!targetPluginCopied) {
          return JSON.stringify({ version: '2026.4.7' });
        }
        return JSON.stringify({
          version: '2026.4.8',
          dependencies: {
            '@larksuiteoapi/node-sdk': '^1.60.0',
          },
        });
      }
      if (input === targetManifestPath) {
        return JSON.stringify({ id: 'openclaw-lark' });
      }
      if (input === sdkPackageJsonPath) {
        return JSON.stringify({ name: '@larksuiteoapi/node-sdk', version: '1.60.0' });
      }
      return '{}';
    });

    mockReaddirSync.mockImplementation((input: string, options?: { withFileTypes?: boolean }) => {
      if (input === npmPkgPath && options?.withFileTypes) {
        return [];
      }

      if (input === sdkVirtualNodeModules && options?.withFileTypes) {
        return [
          {
            name: '@larksuiteoapi',
            isDirectory: () => true,
            isSymbolicLink: () => false,
          },
        ];
      }

      if (input === sdkScopeDir) {
        return ['node-sdk'];
      }

      if (input === targetNodeModulesDir && options?.withFileTypes) {
        return [
          {
            name: '@larksuiteoapi',
            isDirectory: () => true,
            isSymbolicLink: () => false,
          },
        ];
      }

      if (input === path.join(targetNodeModulesDir, '@larksuiteoapi')) {
        return ['node-sdk'];
      }

      return [];
    });

    mockRealpathSync.mockImplementation((input: string) => {
      if (input === npmPkgPath) {
        throw new Error('ENOENT realpath failed');
      }
      if (input === path.join(process.cwd(), 'node_modules', '@larksuiteoapi', 'node-sdk')) {
        return sdkPackagePath;
      }
      if (input === path.join(targetNodeModulesDir, '@larksuiteoapi')) {
        return path.join(process.cwd(), 'node_modules', '.pnpm', '@larksuite+openclaw-lark@20_cb704d4c9fb49dac2e621d686ac12c3f', 'node_modules', '@larksuiteoapi');
      }
      if (input === targetSdkDir) {
        return sdkPackagePath;
      }
      return input;
    });
    mockCpSync.mockImplementation((_src: string, dest: string) => {
      if (dest === targetDir) {
        targetManifestExists = true;
        targetPluginCopied = true;
      }
    });

    const { ensurePluginInstalled } = await import('@electron/utils/plugin-install');
    const result = ensurePluginInstalled('feishu-openclaw-plugin', [], 'Feishu');

    expect(result).toEqual({ installed: true });
    expect(mockCpSync).toHaveBeenCalledWith(npmPkgPath, targetDir, { recursive: true, dereference: true });
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      '[plugin] Failed to resolve real path for @larksuite/openclaw-lark, falling back to the raw node_modules path',
      expect.objectContaining({ npmPkgPath }),
    );
    expect(mockCpSync).toHaveBeenCalledWith(sdkPackagePath, targetSdkDir, { recursive: true, dereference: true });
    expect(mockLoggerInfo).toHaveBeenCalledWith('[plugin] Copied 1 deps for @larksuite/openclaw-lark');
    expect(mockLoggerWarn).not.toHaveBeenCalledWith(
      '[plugin] Failed to install Feishu plugin from node_modules',
      expect.anything(),
    );
  });

  it('repairs an installed dev plugin when declared runtime dependencies are missing', async () => {
    mockApp.isPackaged = false;

    const npmPkgPath = path.join(process.cwd(), 'node_modules', '@larksuite', 'openclaw-lark');
    const npmManifestPath = path.join(npmPkgPath, 'openclaw.plugin.json');
    const npmPackageJsonPath = path.join(npmPkgPath, 'package.json');
    const sdkPackagePath = path.join(process.cwd(), 'node_modules', '.pnpm', '@larksuiteoapi+node-sdk@1.60.0', 'node_modules', '@larksuiteoapi', 'node-sdk');
    const sdkPackageJsonPath = path.join(sdkPackagePath, 'package.json');
    const sdkVirtualNodeModules = path.dirname(path.dirname(sdkPackagePath));
    const sdkScopeDir = path.join(sdkVirtualNodeModules, '@larksuiteoapi');
    const targetDir = path.join('/home/test', '.openclaw', 'extensions', 'feishu-openclaw-plugin');
    const targetManifestPath = path.join(targetDir, 'openclaw.plugin.json');
    const targetPackageJsonPath = path.join(targetDir, 'package.json');
    const targetNodeModulesDir = path.join(targetDir, 'node_modules');
    const targetSdkDir = path.join(targetNodeModulesDir, '@larksuiteoapi', 'node-sdk');
    let targetPluginCopied = false;

    mockExistsSync.mockImplementation((input: string) => {
      return input === npmManifestPath
        || input === targetManifestPath
        || input === targetPackageJsonPath
        || input === path.join(process.cwd(), 'node_modules', '@larksuiteoapi', 'node-sdk', 'package.json')
        || input === sdkPackageJsonPath
        || input === sdkVirtualNodeModules
        || input === sdkScopeDir
        || (input === targetNodeModulesDir && targetPluginCopied)
        || (input === path.join(targetSdkDir, 'package.json') && targetPluginCopied);
    });

    mockReadFileSync.mockImplementation((input: string) => {
      if (input === npmPackageJsonPath) {
        return JSON.stringify({
          version: '2026.4.8',
          dependencies: {
            '@larksuiteoapi/node-sdk': '^1.60.0',
          },
        });
      }
      if (input === targetPackageJsonPath) {
        return JSON.stringify({
          version: '2026.4.8',
          dependencies: {
            '@larksuiteoapi/node-sdk': '^1.60.0',
          },
        });
      }
      if (input === targetManifestPath) {
        return JSON.stringify({ id: 'openclaw-lark' });
      }
      if (input === sdkPackageJsonPath || input === path.join(targetSdkDir, 'package.json')) {
        return JSON.stringify({ name: '@larksuiteoapi/node-sdk', version: '1.60.0' });
      }
      return '{}';
    });

    mockReaddirSync.mockImplementation((input: string, options?: { withFileTypes?: boolean }) => {
      if (input === sdkVirtualNodeModules && options?.withFileTypes) {
        return [
          {
            name: '@larksuiteoapi',
            isDirectory: () => true,
            isSymbolicLink: () => false,
          },
        ];
      }

      if (input === sdkScopeDir) {
        return ['node-sdk'];
      }

      return [];
    });

    mockRealpathSync.mockImplementation((input: string) => {
      if (input === npmPkgPath) {
        throw new Error('ENOENT realpath failed');
      }
      if (input === path.join(process.cwd(), 'node_modules', '@larksuiteoapi', 'node-sdk')) {
        return sdkPackagePath;
      }
      return input;
    });

    mockCpSync.mockImplementation((_src: string, dest: string) => {
      if (dest === targetDir || dest === targetSdkDir) {
        targetPluginCopied = true;
      }
    });

    const { ensurePluginInstalled } = await import('@electron/utils/plugin-install');
    const result = ensurePluginInstalled('feishu-openclaw-plugin', [], 'Feishu');

    expect(result).toEqual({ installed: true });
    expect(mockLoggerInfo).toHaveBeenCalledWith(
      '[plugin] Repairing Feishu plugin because runtime dependencies are missing',
    );
    expect(mockLoggerInfo).toHaveBeenCalledWith(
      '[plugin] Repairing Feishu plugin from dev/node_modules because runtime dependencies are missing',
    );
    expect(mockCpSync).toHaveBeenCalledWith(npmPkgPath, targetDir, { recursive: true, dereference: true });
    expect(mockCpSync).toHaveBeenCalledWith(sdkPackagePath, targetSdkDir, { recursive: true, dereference: true });
  });
});
