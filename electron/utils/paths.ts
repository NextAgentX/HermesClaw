/**
 * Path Utilities
 * Cross-platform path resolution helpers
 */
import { createRequire } from 'node:module';
import { execFileSync } from 'child_process';
import { join } from 'path';
import { homedir } from 'os';
import { existsSync, mkdirSync, readFileSync, realpathSync } from 'fs';
import type { HermesWindowsPreferredMode, InstallStatus } from '../runtime/types';

const require = createRequire(import.meta.url);

type ElectronAppLike = Pick<typeof import('electron').app, 'isPackaged' | 'getPath' | 'getAppPath'>;

export {
  quoteForCmd,
  needsWinShell,
  prepareWinSpawn,
  normalizeNodeRequirePathForNodeOptions,
  appendNodeRequireToNodeOptions,
} from './win-shell';

function getElectronApp() {
  if (process.versions?.electron) {
    return (require('electron') as typeof import('electron')).app;
  }

  const fallbackUserData = process.env.HERMESCLAW_USER_DATA_DIR?.trim() || join(homedir(), '.hermesclaw');
  const fallbackAppPath = process.cwd();
  const fallbackApp: ElectronAppLike = {
    isPackaged: false,
    getPath: (name) => {
      if (name === 'userData') return fallbackUserData;
      return fallbackUserData;
    },
    getAppPath: () => fallbackAppPath,
  };
  return fallbackApp;
}

/**
 * Expand ~ to home directory
 */
export function expandPath(path: string): string {
  if (path.startsWith('~')) {
    return path.replace('~', homedir());
  }
  return path;
}

/**
 * Get OpenClaw config directory
 */
export function getOpenClawConfigDir(): string {
  return join(homedir(), '.openclaw');
}

export const HERMES_DEFAULT_ENDPOINT = 'http://127.0.0.1:8642';

export interface HermesInstallStatus extends InstallStatus {
  endpoint?: string;
  error?: string;
}

export interface HermesInstallStatusOptions {
  windowsHermesPreferredMode?: HermesWindowsPreferredMode;
  windowsHermesNativePath?: string;
  windowsHermesWslDistro?: string;
  installedKinds?: string[];
}

export function getHermesHomeDir(): string {
  return join(homedir(), '.hermes');
}

export function getHermesEndpoint(): string {
  return HERMES_DEFAULT_ENDPOINT;
}

export interface HermesClawRuntimeLayout {
  rootDir: string;
  packagedBaselineDir: string;
  baselineRuntimesDir: string;
  userRuntimesDir: string;
  runtimeStateDir: string;
  activeRuntimesPath: string;
  compatibilityMatrixPath: string;
  installHistoryPath: string;
  sharedConfigDir: string;
  manifestPath: string;
  backupsDir: string;
  logsDir: string;
  cacheDir: string;
}

export function getHermesClawRootDir(): string {
  return join(getElectronApp().getPath('userData'), 'HermesClaw');
}

export function getHermesClawPackagedBaselineDir(): string {
  if (getElectronApp().isPackaged) {
    return join(process.resourcesPath, 'hermesclaw');
  }
  return join(getElectronApp().getAppPath(), 'node_modules', '@hermesclaw');
}

export function getHermesClawRuntimeLayout(): HermesClawRuntimeLayout {
  const rootDir = getHermesClawRootDir();
  const runtimeStateDir = join(rootDir, 'runtime-state');
  return {
    rootDir,
    packagedBaselineDir: getHermesClawPackagedBaselineDir(),
    baselineRuntimesDir: join(rootDir, 'runtimes', 'baseline'),
    userRuntimesDir: join(rootDir, 'runtimes', 'user'),
    runtimeStateDir,
    activeRuntimesPath: join(runtimeStateDir, 'active-runtimes.json'),
    compatibilityMatrixPath: join(runtimeStateDir, 'compatibility-matrix.json'),
    installHistoryPath: join(runtimeStateDir, 'install-history.json'),
    sharedConfigDir: join(rootDir, 'shared-config'),
    manifestPath: join(rootDir, 'runtime-manifest.json'),
    backupsDir: join(rootDir, 'backups'),
    logsDir: join(rootDir, 'logs'),
    cacheDir: join(rootDir, 'cache'),
  };
}

export function ensureHermesClawRuntimeLayout(): HermesClawRuntimeLayout {
  const layout = getHermesClawRuntimeLayout();
  ensureDir(layout.rootDir);
  ensureDir(layout.baselineRuntimesDir);
  ensureDir(layout.userRuntimesDir);
  ensureDir(layout.runtimeStateDir);
  ensureDir(layout.sharedConfigDir);
  ensureDir(layout.backupsDir);
  ensureDir(layout.logsDir);
  ensureDir(layout.cacheDir);
  return layout;
}

function hasWslExecutable(): boolean {
  const systemRoot = process.env.SystemRoot || 'C:\\Windows';
  return existsSync(join(systemRoot, 'System32', 'wsl.exe'));
}

function getHermesWslHomeLabel(distro: string): string {
  return `~/.hermes (WSL:${distro})`;
}

function getHermesNativeHomeLabel(configuredPath?: string): string {
  const candidate = configuredPath?.trim();
  return expandPath(candidate && candidate.length > 0 ? candidate : getHermesHomeDir());
}

function probeHermesHomeInWsl(distro: string): boolean {
  try {
    execFileSync('wsl.exe', ['-d', distro, '--', 'sh', '-lc', 'test -d ~/.hermes'], {
      stdio: 'ignore',
    });
    return true;
  } catch {
    return false;
  }
}

function parseWslDistroOutput(output: string): string[] {
  return output
    .replaceAll('\0', '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/^Windows Subsystem for Linux Distributions:/i.test(line));
}

export function listWslDistros(): string[] {
  if (process.platform !== 'win32' || !hasWslExecutable()) {
    return [];
  }

  try {
    const output = execFileSync('wsl.exe', ['-l', '-q'], {
      stdio: ['ignore', 'pipe', 'ignore'],
    });

    const decodedUtf16 = parseWslDistroOutput(output.toString('utf16le'));
    if (decodedUtf16.length > 0) {
      return decodedUtf16;
    }

    return parseWslDistroOutput(output.toString('utf8'));
  } catch {
    return [];
  }
}

function buildNativeHermesInstallStatus(
  persistedInstalled: boolean,
  configuredPath?: string,
): HermesInstallStatus {
  const installPath = getHermesNativeHomeLabel(configuredPath);
  const reachable = existsSync(installPath);
  const installed = persistedInstalled || reachable;

  return {
    installed,
    installMode: 'native',
    installPath: installed ? installPath : undefined,
    endpoint: getHermesEndpoint(),
    error: installed ? undefined : `Hermes native home directory was not found at ${installPath}`,
  };
}

function buildWslHermesInstallStatus(
  persistedInstalled: boolean,
  distro?: string,
): HermesInstallStatus {
  if (!distro) {
    return {
      installed: false,
      installMode: 'wsl2',
      endpoint: getHermesEndpoint(),
      error: 'Hermes on Windows requires a configured WSL2 distro',
    };
  }

  const installPath = getHermesWslHomeLabel(distro);

  if (!hasWslExecutable()) {
    return {
      installed: false,
      installMode: 'wsl2',
      installPath,
      endpoint: getHermesEndpoint(),
      error: 'WSL2 is not available on this system',
    };
  }

  const reachable = probeHermesHomeInWsl(distro);
  const installed = persistedInstalled || reachable;

  return {
    installed,
    installMode: 'wsl2',
    installPath: installed ? installPath : undefined,
    endpoint: getHermesEndpoint(),
    error: installed ? undefined : `Hermes home directory is not reachable in WSL distro "${distro}"`,
  };
}

function mergeHermesProbeErrors(statuses: HermesInstallStatus[]): string | undefined {
  const errors = Array.from(new Set(statuses.map((status) => status.error).filter(Boolean)));
  if (errors.length === 0) {
    return undefined;
  }
  return errors.join(' | ');
}

export function getHermesInstallStatus(options: HermesInstallStatusOptions = {}): HermesInstallStatus {
  const persistedInstalled = options.installedKinds?.includes('hermes') ?? false;

  if (process.platform === 'win32') {
    const preferredMode = options.windowsHermesPreferredMode ?? 'wsl2';
    const nativeStatus = buildNativeHermesInstallStatus(persistedInstalled, options.windowsHermesNativePath);
    const wslStatus = buildWslHermesInstallStatus(persistedInstalled, options.windowsHermesWslDistro);
    const orderedStatuses = preferredMode === 'native'
      ? [nativeStatus, wslStatus]
      : [wslStatus, nativeStatus];

    const installedStatus = orderedStatuses.find((status) => status.installed);
    if (installedStatus) {
      return installedStatus;
    }

    const primaryStatus = orderedStatuses[0];
    return {
      ...primaryStatus,
      error: mergeHermesProbeErrors(orderedStatuses) ?? primaryStatus.error,
    };
  }

  return buildNativeHermesInstallStatus(persistedInstalled, options.windowsHermesNativePath);
}

/**
 * Get OpenClaw skills directory
 */
export function getOpenClawSkillsDir(): string {
  return join(getOpenClawConfigDir(), 'skills');
}

/**
 * Get HermesClaw config directory
 */
export function getHermesClawConfigDir(): string {
  return join(homedir(), '.hermesclaw');
}

/**
 * Get HermesClaw logs directory
 */
export function getLogsDir(): string {
  return join(getElectronApp().getPath('userData'), 'logs');
}

/**
 * Get HermesClaw data directory
 */
export function getDataDir(): string {
  return getElectronApp().getPath('userData');
}

/**
 * Ensure directory exists
 */
export function ensureDir(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

/**
 * Get resources directory (for bundled assets)
 */
export function getResourcesDir(): string {
  if (getElectronApp().isPackaged) {
    return join(process.resourcesPath, 'resources');
  }
  return join(__dirname, '../../resources');
}

/**
 * Get preload script path
 */
export function getPreloadPath(): string {
  return join(__dirname, '../preload/index.js');
}

/**
 * Get OpenClaw package directory
 * - Production (packaged): from resources/openclaw (copied by electron-builder extraResources)
 * - Development: from node_modules/openclaw
 */
export function getOpenClawDir(): string {
  if (getElectronApp().isPackaged) {
    return join(process.resourcesPath, 'openclaw');
  }
  // Development: use node_modules/openclaw
  return join(__dirname, '../../node_modules/openclaw');
}

/**
 * Get OpenClaw package directory resolved to a real path.
 * Useful when consumers need deterministic module resolution under pnpm symlinks.
 */
export function getOpenClawResolvedDir(): string {
  const dir = getOpenClawDir();
  if (!existsSync(dir)) {
    return dir;
  }
  try {
    return realpathSync(dir);
  } catch {
    return dir;
  }
}

/**
 * Get OpenClaw entry script path (openclaw.mjs)
 */
export function getOpenClawEntryPath(): string {
  return join(getOpenClawDir(), 'openclaw.mjs');
}

/**
 * Get ClawHub CLI entry script path (clawdhub.js)
 */
export function getClawHubCliEntryPath(): string {
  return join(getElectronApp().getAppPath(), 'node_modules', 'clawhub', 'bin', 'clawdhub.js');
}

/**
 * Get ClawHub CLI binary path (node_modules/.bin)
 */
export function getClawHubCliBinPath(): string {
  const binName = process.platform === 'win32' ? 'clawhub.cmd' : 'clawhub';
  return join(getElectronApp().getAppPath(), 'node_modules', '.bin', binName);
}

/**
 * Check if OpenClaw package exists
 */
export function isOpenClawPresent(): boolean {
  const dir = getOpenClawDir();
  const pkgJsonPath = join(dir, 'package.json');
  return existsSync(dir) && existsSync(pkgJsonPath);
}

/**
 * Check if OpenClaw is built (has dist folder)
 * For the npm package, this should always be true since npm publishes the built dist.
 */
export function isOpenClawBuilt(): boolean {
  const dir = getOpenClawDir();
  const distDir = join(dir, 'dist');
  const hasDist = existsSync(distDir);
  return hasDist;
}

/**
 * Get OpenClaw status for environment check
 */
export interface OpenClawStatus {
  packageExists: boolean;
  isBuilt: boolean;
  entryPath: string;
  dir: string;
  version?: string;
}

export function getOpenClawStatus(): OpenClawStatus {
  const dir = getOpenClawDir();
  let version: string | undefined;

  // Try to read version from package.json
  try {
    const pkgPath = join(dir, 'package.json');
    if (existsSync(pkgPath)) {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
      version = pkg.version;
    }
  } catch {
    // Ignore version read errors
  }

  const status: OpenClawStatus = {
    packageExists: isOpenClawPresent(),
    isBuilt: isOpenClawBuilt(),
    entryPath: getOpenClawEntryPath(),
    dir,
    version,
  };

  try {
    const { logger } = require('./logger') as typeof import('./logger');
    logger.info('OpenClaw status:', status);
  } catch {
    // Ignore logger bootstrap issues in non-Electron contexts such as unit tests.
  }
  return status;
}
