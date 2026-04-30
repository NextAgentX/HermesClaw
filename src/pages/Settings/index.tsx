/**
 * Settings Page
 * Application configuration
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Sun,
  Moon,
  Monitor,
  RefreshCw,
  ExternalLink,
  Copy,
  FileText,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { useSettingsStore } from '@/stores/settings';
import { useGatewayStore } from '@/stores/gateway';
import { useUpdateStore } from '@/stores/update';
import { UpdateSettings } from '@/components/settings/UpdateSettings';
import {
  getGatewayWsDiagnosticEnabled,
  invokeIpc,
  setGatewayWsDiagnosticEnabled,
  toUserMessage,
} from '@/lib/api-client';
import {
  clearUiTelemetry,
  getUiTelemetrySnapshot,
  subscribeUiTelemetry,
  trackUiEvent,
  type UiTelemetryEntry,
} from '@/lib/telemetry';
import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES } from '@/i18n';
import {
  applyOpenClawUpdate,
  applyHermesClawUpdate,
  attachHermesOpenClawBridge,
  checkOpenClawUpdate,
  checkHermesClawUpdate,
  getHermesClawLocalStatus,
  getHermesClawSharedConfig,
  getRuntimeStatus,
  hostApiFetch,
  installRuntime,
  openHermesClawLogsLocation,
  restartOpenClawRuntime,
  recheckHermesOpenClawBridge,
  restartHermesRuntime,
  repairHermesClawInstallation,
  rollbackOpenClawRuntime,
  rollbackHermesClawRuntime,
  runHermesClawDoctor,
  startOpenClawRuntime,
  startHermesRuntime,
  stopOpenClawRuntime,
  stopHermesRuntime,
  syncHermesClawSharedConfig,
  type HermesClawDoctorResult,
  type HermesClawLocalStatus,
  type HermesClawSharedConfigRegistry,
  type HermesClawSharedConfigSyncResult,
  type HermesClawUpdateCheckResult,
  type OpenClawRuntimeUpdateResult,
  type RuntimeInstallResult,
  type RuntimeStatusSnapshot,
} from '@/lib/host-api';
import { cn } from '@/lib/utils';

type ControlUiInfo = {
  url: string;
  token: string;
  port: number;
};

type SettingsTab = 'overview' | 'appearance' | 'runtime' | 'updates' | 'integration' | 'advanced' | 'about';

const settingsTabs: Array<{ id: SettingsTab; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'appearance', label: 'Appearance & Startup' },
  { id: 'runtime', label: 'Runtime' },
  { id: 'updates', label: 'Updates' },
  { id: 'integration', label: 'HermesClaw Integration' },
  { id: 'advanced', label: 'Advanced & Diagnostics' },
  { id: 'about', label: 'About' },
];

export function Settings() {
  const { t } = useTranslation('settings');
  const {
    theme,
    setTheme,
    language,
    setLanguage,
    launchAtStartup,
    setLaunchAtStartup,
    gatewayAutoStart,
    setGatewayAutoStart,
    proxyEnabled,
    proxyServer,
    proxyHttpServer,
    proxyHttpsServer,
    proxyAllServer,
    proxyBypassRules,
    setProxyEnabled,
    setProxyServer,
    setProxyHttpServer,
    setProxyHttpsServer,
    setProxyAllServer,
    setProxyBypassRules,
    autoCheckUpdate,
    setAutoCheckUpdate,
    autoDownloadUpdate,
    setAutoDownloadUpdate,
    devModeUnlocked,
    setDevModeUnlocked,
    telemetryEnabled,
    setTelemetryEnabled,
    runtime,
  } = useSettingsStore();

  const { status: gatewayStatus, restart: restartGateway } = useGatewayStore();
  const currentVersion = useUpdateStore((state) => state.currentVersion);
  const updateSetAutoDownload = useUpdateStore((state) => state.setAutoDownload);
  const [controlUiInfo, setControlUiInfo] = useState<ControlUiInfo | null>(null);
  const [openclawCliCommand, setOpenclawCliCommand] = useState('');
  const [openclawCliError, setOpenclawCliError] = useState<string | null>(null);
  const [proxyServerDraft, setProxyServerDraft] = useState('');
  const [proxyHttpServerDraft, setProxyHttpServerDraft] = useState('');
  const [proxyHttpsServerDraft, setProxyHttpsServerDraft] = useState('');
  const [proxyAllServerDraft, setProxyAllServerDraft] = useState('');
  const [proxyBypassRulesDraft, setProxyBypassRulesDraft] = useState('');
  const [proxyEnabledDraft, setProxyEnabledDraft] = useState(false);
  const [savingProxy, setSavingProxy] = useState(false);
  const [wsDiagnosticEnabled, setWsDiagnosticEnabled] = useState(false);
  const [showTelemetryViewer, setShowTelemetryViewer] = useState(false);
  const [telemetryEntries, setTelemetryEntries] = useState<UiTelemetryEntry[]>([]);
  const [runtimeStatus, setRuntimeStatus] = useState<RuntimeStatusSnapshot | null>(null);
  const [hermesClawStatus, setHermesClawStatus] = useState<HermesClawLocalStatus | null>(null);
  const [hermesClawDoctorResult, setHermesClawDoctorResult] = useState<HermesClawDoctorResult | null>(null);
  const [hermesClawUpdateResult, setHermesClawUpdateResult] = useState<HermesClawUpdateCheckResult | null>(null);
  const [hermesClawSharedConfig, setHermesClawSharedConfig] = useState<HermesClawSharedConfigRegistry | null>(null);
  const [hermesClawSyncResult, setHermesClawSyncResult] = useState<HermesClawSharedConfigSyncResult | null>(null);
  const [runtimeStatusLoading, setRuntimeStatusLoading] = useState(false);
  const [runtimeStatusError, setRuntimeStatusError] = useState<string | null>(null);
  const runtimeStatusRefreshInFlightRef = useRef<Promise<void> | null>(null);
  const [bridgeActionLoading, setBridgeActionLoading] = useState<'attach' | 'recheck' | null>(null);
  const [openClawRuntimeActionLoading, setOpenClawRuntimeActionLoading] = useState<'install' | 'start' | 'stop' | 'restart' | 'check-update' | 'apply-update' | 'rollback' | null>(null);
  const [openClawUpdateResult, setOpenClawUpdateResult] = useState<OpenClawRuntimeUpdateResult | null>(null);
  const [hermesRuntimeActionLoading, setHermesRuntimeActionLoading] = useState<'install' | 'start' | 'stop' | 'restart' | null>(null);
  const [hermesClawActionLoading, setHermesClawActionLoading] = useState<'doctor' | 'repair' | 'open-logs' | 'check-update' | 'apply-update' | 'rollback' | 'sync' | null>(null);
  const [runtimeConfigSaving, setRuntimeConfigSaving] = useState(false);
  const [windowsHermesPreferredModeDraft, setWindowsHermesPreferredModeDraft] = useState<'native' | 'wsl2'>('wsl2');
  const [windowsHermesNativePathDraft, setWindowsHermesNativePathDraft] = useState('');
  const [windowsHermesWslDistroDraft, setWindowsHermesWslDistroDraft] = useState('');

  const isWindows = window.electron.platform === 'win32';
  const showCliTools = true;
  const [showLogs, setShowLogs] = useState(false);
  const [logContent, setLogContent] = useState('');
  const [doctorRunningMode, setDoctorRunningMode] = useState<'diagnose' | 'fix' | null>(null);
  const [doctorResult, setDoctorResult] = useState<{
    mode: 'diagnose' | 'fix';
    success: boolean;
    exitCode: number | null;
    stdout: string;
    stderr: string;
    command: string;
    cwd: string;
    durationMs: number;
    timedOut?: boolean;
    error?: string;
  } | null>(null);

  const handleShowLogs = async () => {
    try {
      const logs = await hostApiFetch<{ content: string }>('/api/logs?tailLines=100');
      setLogContent(logs.content);
      setShowLogs(true);
    } catch {
      setLogContent('(Failed to load logs)');
      setShowLogs(true);
    }
  };

  const handleOpenLogDir = async () => {
    try {
      const { dir: logDir } = await hostApiFetch<{ dir: string | null }>('/api/logs/dir');
      if (logDir) {
        await invokeIpc('shell:showItemInFolder', logDir);
      }
    } catch {
      // ignore
    }
  };

  const handleRunOpenClawDoctor = async (mode: 'diagnose' | 'fix') => {
    setDoctorRunningMode(mode);
    try {
      const result = await hostApiFetch<{
        mode: 'diagnose' | 'fix';
        success: boolean;
        exitCode: number | null;
        stdout: string;
        stderr: string;
        command: string;
        cwd: string;
        durationMs: number;
        timedOut?: boolean;
        error?: string;
      }>('/api/app/openclaw-doctor', {
        method: 'POST',
        body: JSON.stringify({ mode }),
      });
      setDoctorResult(result);
      if (result.success) {
        toast.success(mode === 'fix' ? t('developer.doctorFixSucceeded') : t('developer.doctorSucceeded'));
      } else {
        toast.error(result.error || (mode === 'fix' ? t('developer.doctorFixFailed') : t('developer.doctorFailed')));
      }
    } catch (error) {
      const message = toUserMessage(error) || (mode === 'fix' ? t('developer.doctorFixRunFailed') : t('developer.doctorRunFailed'));
      toast.error(message);
      setDoctorResult({
        mode,
        success: false,
        exitCode: null,
        stdout: '',
        stderr: '',
        command: 'openclaw doctor',
        cwd: '',
        durationMs: 0,
        error: message,
      });
    } finally {
      setDoctorRunningMode(null);
    }
  };

  const handleCopyDoctorOutput = async () => {
    if (!doctorResult) return;
    const payload = [
      `command: ${doctorResult.command}`,
      `cwd: ${doctorResult.cwd}`,
      `exitCode: ${doctorResult.exitCode ?? 'null'}`,
      `durationMs: ${doctorResult.durationMs}`,
      '',
      '[stdout]',
      doctorResult.stdout.trim() || '(empty)',
      '',
      '[stderr]',
      doctorResult.stderr.trim() || '(empty)',
    ].join('\n');

    try {
      await navigator.clipboard.writeText(payload);
      toast.success(t('developer.doctorCopied'));
    } catch (error) {
      toast.error(`Failed to copy doctor output: ${String(error)}`);
    }
  };



  const refreshControlUiInfo = async () => {
    try {
      const result = await hostApiFetch<{
        success: boolean;
        url?: string;
        token?: string;
        port?: number;
      }>('/api/gateway/control-ui');
      if (result.success && result.url && result.token && typeof result.port === 'number') {
        setControlUiInfo({ url: result.url, token: result.token, port: result.port });
      }
    } catch {
      // Ignore refresh errors
    }
  };

  const handleCopyGatewayToken = async () => {
    if (!controlUiInfo?.token) return;
    try {
      await navigator.clipboard.writeText(controlUiInfo.token);
      toast.success(t('developer.tokenCopied'));
    } catch (error) {
      toast.error(`Failed to copy token: ${String(error)}`);
    }
  };

  const refreshRuntimeStatus = useCallback(async () => {
    if (runtimeStatusRefreshInFlightRef.current) {
      return runtimeStatusRefreshInFlightRef.current;
    }

    const refreshPromise = (async () => {
      setRuntimeStatusLoading(true);
      try {
        const [result, localStatus, sharedConfig] = await Promise.all([
          getRuntimeStatus(),
          getHermesClawLocalStatus(),
          getHermesClawSharedConfig(),
        ]);
        setRuntimeStatus(result);
        setHermesClawStatus(localStatus);
        setHermesClawSharedConfig(sharedConfig);
        setRuntimeStatusError(null);
      } catch (error) {
        setRuntimeStatusError(toUserMessage(error) || t('gateway.runtimeStatusLoadFailed'));
      } finally {
        setRuntimeStatusLoading(false);
      }
    })();

    runtimeStatusRefreshInFlightRef.current = refreshPromise;
    try {
      return await refreshPromise;
    } finally {
      if (runtimeStatusRefreshInFlightRef.current === refreshPromise) {
        runtimeStatusRefreshInFlightRef.current = null;
      }
    }
  }, [t]);

  const refreshHermesClawStatus = useCallback(async () => {
    const [localStatus, sharedConfig] = await Promise.all([
      getHermesClawLocalStatus(),
      getHermesClawSharedConfig(),
    ]);
    setHermesClawStatus(localStatus);
    setHermesClawSharedConfig(sharedConfig);
  }, []);

  const handleHermesClawDoctor = async () => {
    setHermesClawActionLoading('doctor');
    try {
      const result = await runHermesClawDoctor();
      setHermesClawDoctorResult(result);
      toast.success(result.ok ? 'HermesClaw doctor completed' : 'HermesClaw doctor completed with warnings');
    } catch (error) {
      toast.error(toUserMessage(error) || 'Failed to run HermesClaw doctor');
    } finally {
      setHermesClawActionLoading(null);
    }
  };

  const handleHermesClawRepair = async () => {
    setHermesClawActionLoading('repair');
    try {
      const result = await repairHermesClawInstallation();
      setHermesClawDoctorResult(result.doctor);
      await refreshHermesClawStatus();
      if (result.success) {
        toast.success(`HermesClaw repair completed (${result.repaired.length} actions)`);
      } else {
        toast.error(result.doctor.repairPlan[0] ?? 'HermesClaw repair completed with remaining issues');
      }
    } catch (error) {
      toast.error(toUserMessage(error) || 'Failed to repair HermesClaw installation');
    } finally {
      setHermesClawActionLoading(null);
    }
  };

  const handleHermesClawOpenLogs = async () => {
    setHermesClawActionLoading('open-logs');
    try {
      const result = await openHermesClawLogsLocation();
      if (!result.success) {
        throw new Error(result.error ?? 'Failed to open HermesClaw logs directory');
      }
      toast.success(`HermesClaw logs opened: ${result.dir}`);
    } catch (error) {
      toast.error(toUserMessage(error) || 'Failed to open HermesClaw logs');
    } finally {
      setHermesClawActionLoading(null);
    }
  };

  const handleHermesClawCheckUpdate = async () => {
    setHermesClawActionLoading('check-update');
    try {
      const result = await checkHermesClawUpdate(hermesClawStatus?.manifest.activeChannel);
      setHermesClawUpdateResult(result);
      toast.success('HermesClaw update check completed');
    } catch (error) {
      toast.error(toUserMessage(error) || 'Failed to check HermesClaw updates');
    } finally {
      setHermesClawActionLoading(null);
    }
  };

  const handleHermesClawApplyUpdate = async () => {
    setHermesClawActionLoading('apply-update');
    try {
      await applyHermesClawUpdate({
        channel: hermesClawUpdateResult?.channel ?? hermesClawStatus?.manifest.activeChannel,
        version: hermesClawUpdateResult?.latestVersion ?? hermesClawUpdateResult?.currentVersion,
      });
      await refreshHermesClawStatus();
      toast.success('HermesClaw runtime updated');
    } catch (error) {
      toast.error(toUserMessage(error) || 'Failed to update HermesClaw runtime');
    } finally {
      setHermesClawActionLoading(null);
    }
  };

  const handleHermesClawRollback = async () => {
    setHermesClawActionLoading('rollback');
    try {
      const result = await rollbackHermesClawRuntime();
      if (!result.success) {
        toast.error(result.error || 'No HermesClaw rollback is available');
        return;
      }
      await refreshHermesClawStatus();
      toast.success('HermesClaw runtime rolled back');
    } catch (error) {
      toast.error(toUserMessage(error) || 'Failed to roll back HermesClaw runtime');
    } finally {
      setHermesClawActionLoading(null);
    }
  };

  const handleHermesClawSync = async () => {
    setHermesClawActionLoading('sync');
    try {
      const result = await syncHermesClawSharedConfig({ dryRun: true, scope: 'manual' });
      setHermesClawSyncResult(result);
      await refreshHermesClawStatus();
      toast.success('HermesClaw shared config dry-run completed');
    } catch (error) {
      toast.error(toUserMessage(error) || 'Failed to sync HermesClaw shared config');
    } finally {
      setHermesClawActionLoading(null);
    }
  };

  const applyRuntimeInstallResult = async (result: RuntimeInstallResult) => {
    setRuntimeStatus(result.snapshot);
    await refreshHermesClawStatus();
    if (!result.success) {
      throw new Error(result.error ?? 'Runtime installation failed');
    }
  };

  const handleRuntimeInstall = async (_runtimeKind: 'openclaw' | 'hermes') => {
    const installChoice = 'both';
    setOpenClawRuntimeActionLoading('install');
    setHermesRuntimeActionLoading('install');

    try {
      const result = await installRuntime(installChoice);
      await applyRuntimeInstallResult(result);
      toast.success('OpenClaw + Hermes runtime install completed');
    } catch (error) {
      toast.error(toUserMessage(error) || 'Failed to install OpenClaw + Hermes runtime');
    } finally {
      setOpenClawRuntimeActionLoading(null);
      setHermesRuntimeActionLoading(null);
    }
  };

  const handleHermesRuntimeAction = async (action: 'start' | 'stop' | 'restart') => {
    setHermesRuntimeActionLoading(action);
    try {
      const result = action === 'start'
        ? await startHermesRuntime()
        : action === 'stop'
          ? await stopHermesRuntime()
          : await restartHermesRuntime();
      if (!result.success) {
        throw new Error(result.error ?? `Hermes runtime ${action} failed`);
      }
      setRuntimeStatus(result.snapshot);
      await refreshHermesClawStatus();
      toast.success(`Hermes runtime ${action} completed`);
    } catch (error) {
      toast.error(toUserMessage(error) || `Failed to ${action} Hermes runtime`);
    } finally {
      setHermesRuntimeActionLoading(null);
    }
  };

  const handleOpenClawRuntimeAction = async (action: 'start' | 'stop' | 'restart' | 'check-update' | 'apply-update' | 'rollback') => {
    setOpenClawRuntimeActionLoading(action);
    try {
      if (action === 'start' || action === 'stop' || action === 'restart') {
        const result = action === 'start'
          ? await startOpenClawRuntime()
          : action === 'stop'
            ? await stopOpenClawRuntime()
            : await restartOpenClawRuntime();
        if (!result.success) {
          throw new Error(result.error ?? `OpenClaw runtime ${action} failed`);
        }
        setRuntimeStatus(result.snapshot);
        toast.success(`OpenClaw runtime ${action} completed`);
        return;
      }

      const result = action === 'check-update'
        ? await checkOpenClawUpdate()
        : action === 'apply-update'
          ? await applyOpenClawUpdate()
          : await rollbackOpenClawRuntime();
      setOpenClawUpdateResult(result);
      setRuntimeStatus(result.snapshot);
      if (result.success === false) {
        toast.error(result.error ?? 'OpenClaw runtime management action failed');
      } else {
        toast.success('OpenClaw runtime management action completed');
      }
    } catch (error) {
      toast.error(toUserMessage(error) || `Failed to ${action} OpenClaw runtime`);
    } finally {
      setOpenClawRuntimeActionLoading(null);
    }
  };

  const handleBridgeAction = async (action: 'attach' | 'recheck') => {
    setBridgeActionLoading(action);
    try {
      if (action === 'attach') {
        await attachHermesOpenClawBridge();
      } else {
        await recheckHermesOpenClawBridge();
      }
      await refreshRuntimeStatus();
      toast.success(action === 'attach' ? t('gateway.bridgeAttachSucceeded') : t('gateway.bridgeRecheckSucceeded'));
    } catch (error) {
      toast.error(toUserMessage(error) || t('gateway.runtimeStatusLoadFailed'));
    } finally {
      setBridgeActionLoading(null);
    }
  };

  const runtimeConfigSource = runtimeStatus?.runtime ?? runtime;

  useEffect(() => {
    setWindowsHermesPreferredModeDraft(runtimeConfigSource.windowsHermesPreferredMode ?? 'wsl2');
    setWindowsHermesNativePathDraft(runtimeConfigSource.windowsHermesNativePath ?? '');
    setWindowsHermesWslDistroDraft(runtimeConfigSource.windowsHermesWslDistro ?? '');
  }, [
    runtimeConfigSource.windowsHermesNativePath,
    runtimeConfigSource.windowsHermesPreferredMode,
    runtimeConfigSource.windowsHermesWslDistro,
  ]);

  const runtimeConfigDirty = useMemo(() => {
    return (
      (windowsHermesPreferredModeDraft ?? 'wsl2') !== (runtimeConfigSource.windowsHermesPreferredMode ?? 'wsl2')
      || windowsHermesNativePathDraft.trim() !== (runtimeConfigSource.windowsHermesNativePath ?? '')
      || windowsHermesWslDistroDraft.trim() !== (runtimeConfigSource.windowsHermesWslDistro ?? '')
    );
  }, [
    runtimeConfigSource.windowsHermesNativePath,
    runtimeConfigSource.windowsHermesPreferredMode,
    runtimeConfigSource.windowsHermesWslDistro,
    windowsHermesNativePathDraft,
    windowsHermesPreferredModeDraft,
    windowsHermesWslDistroDraft,
  ]);

  const handleSaveWindowsHermesRuntimeConfig = async () => {
    setRuntimeConfigSaving(true);
    try {
      const nextRuntime = {
        ...runtimeConfigSource,
        windowsHermesPreferredMode: windowsHermesPreferredModeDraft,
        windowsHermesNativePath: windowsHermesNativePathDraft.trim() || undefined,
        windowsHermesWslDistro: windowsHermesWslDistroDraft.trim() || undefined,
      };

      await hostApiFetch('/api/settings/runtime', {
        method: 'PUT',
        body: JSON.stringify({ value: nextRuntime }),
      });

      await refreshRuntimeStatus();
      toast.success(t('gateway.runtimeWindowsConfigSaved'));
    } catch (error) {
      toast.error(toUserMessage(error) || t('gateway.runtimeWindowsConfigSaveFailed'));
    } finally {
      setRuntimeConfigSaving(false);
    }
  };

  useEffect(() => {
    if (!showCliTools) return;
    let cancelled = false;

    (async () => {
      try {
        const result = await invokeIpc<{
          success: boolean;
          command?: string;
          error?: string;
        }>('openclaw:getCliCommand');
        if (cancelled) return;
        if (result.success && result.command) {
          setOpenclawCliCommand(result.command);
          setOpenclawCliError(null);
        } else {
          setOpenclawCliCommand('');
          setOpenclawCliError(result.error || 'OpenClaw CLI unavailable');
        }
      } catch (error) {
        if (cancelled) return;
        setOpenclawCliCommand('');
        setOpenclawCliError(String(error));
      }
    })();

    return () => { cancelled = true; };
  }, [devModeUnlocked, showCliTools]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void refreshRuntimeStatus();
    }, 350);

    return () => window.clearTimeout(timeoutId);
  }, [gatewayStatus.gatewayReady, gatewayStatus.state, refreshRuntimeStatus]);

  const handleCopyCliCommand = async () => {
    if (!openclawCliCommand) return;
    try {
      await navigator.clipboard.writeText(openclawCliCommand);
      toast.success(t('developer.cmdCopied'));
    } catch (error) {
      toast.error(`Failed to copy command: ${String(error)}`);
    }
  };

  useEffect(() => {
    const unsubscribe = window.electron.ipcRenderer.on(
      'openclaw:cli-installed',
      (...args: unknown[]) => {
        const installedPath = typeof args[0] === 'string' ? args[0] : '';
        toast.success(`openclaw CLI installed at ${installedPath}`);
      },
    );
    return () => { unsubscribe?.(); };
  }, []);

  useEffect(() => {
    setWsDiagnosticEnabled(getGatewayWsDiagnosticEnabled());
  }, []);

  useEffect(() => {
    if (!devModeUnlocked) return;
    setTelemetryEntries(getUiTelemetrySnapshot(200));
    const unsubscribe = subscribeUiTelemetry((entry) => {
      setTelemetryEntries((prev) => {
        const next = [...prev, entry];
        if (next.length > 200) {
          next.splice(0, next.length - 200);
        }
        return next;
      });
    });
    return unsubscribe;
  }, [devModeUnlocked]);

  useEffect(() => {
    setProxyEnabledDraft(proxyEnabled);
  }, [proxyEnabled]);

  useEffect(() => {
    setProxyServerDraft(proxyServer);
  }, [proxyServer]);

  useEffect(() => {
    setProxyHttpServerDraft(proxyHttpServer);
  }, [proxyHttpServer]);

  useEffect(() => {
    setProxyHttpsServerDraft(proxyHttpsServer);
  }, [proxyHttpsServer]);

  useEffect(() => {
    setProxyAllServerDraft(proxyAllServer);
  }, [proxyAllServer]);

  useEffect(() => {
    setProxyBypassRulesDraft(proxyBypassRules);
  }, [proxyBypassRules]);

  const proxySettingsDirty = useMemo(() => {
    return (
      proxyEnabledDraft !== proxyEnabled
      || proxyServerDraft.trim() !== proxyServer
      || proxyHttpServerDraft.trim() !== proxyHttpServer
      || proxyHttpsServerDraft.trim() !== proxyHttpsServer
      || proxyAllServerDraft.trim() !== proxyAllServer
      || proxyBypassRulesDraft.trim() !== proxyBypassRules
    );
  }, [
    proxyAllServer,
    proxyAllServerDraft,
    proxyBypassRules,
    proxyBypassRulesDraft,
    proxyEnabled,
    proxyEnabledDraft,
    proxyHttpServer,
    proxyHttpServerDraft,
    proxyHttpsServer,
    proxyHttpsServerDraft,
    proxyServer,
    proxyServerDraft,
  ]);

  const handleSaveProxySettings = async () => {
    setSavingProxy(true);
    try {
      const normalizedProxyServer = proxyServerDraft.trim();
      const normalizedHttpServer = proxyHttpServerDraft.trim();
      const normalizedHttpsServer = proxyHttpsServerDraft.trim();
      const normalizedAllServer = proxyAllServerDraft.trim();
      const normalizedBypassRules = proxyBypassRulesDraft.trim();
      await invokeIpc('settings:setMany', {
        proxyEnabled: proxyEnabledDraft,
        proxyServer: normalizedProxyServer,
        proxyHttpServer: normalizedHttpServer,
        proxyHttpsServer: normalizedHttpsServer,
        proxyAllServer: normalizedAllServer,
        proxyBypassRules: normalizedBypassRules,
      });

      setProxyServer(normalizedProxyServer);
      setProxyHttpServer(normalizedHttpServer);
      setProxyHttpsServer(normalizedHttpsServer);
      setProxyAllServer(normalizedAllServer);
      setProxyBypassRules(normalizedBypassRules);
      setProxyEnabled(proxyEnabledDraft);

      toast.success(t('gateway.proxySaved'));
      trackUiEvent('settings.proxy_saved', { enabled: proxyEnabledDraft });
    } catch (error) {
      toast.error(`${t('gateway.proxySaveFailed')}: ${toUserMessage(error)}`);
    } finally {
      setSavingProxy(false);
    }
  };

  const telemetryStats = useMemo(() => {
    let errorCount = 0;
    let slowCount = 0;
    for (const entry of telemetryEntries) {
      if (entry.event.endsWith('_error') || entry.event.includes('request_error')) {
        errorCount += 1;
      }
      const durationMs = typeof entry.payload.durationMs === 'number'
        ? entry.payload.durationMs
        : Number.NaN;
      if (Number.isFinite(durationMs) && durationMs >= 800) {
        slowCount += 1;
      }
    }
    return { total: telemetryEntries.length, errorCount, slowCount };
  }, [telemetryEntries]);

  const telemetryByEvent = useMemo(() => {
    const map = new Map<string, {
      event: string;
      count: number;
      errorCount: number;
      slowCount: number;
      totalDuration: number;
      timedCount: number;
      lastTs: string;
    }>();

    for (const entry of telemetryEntries) {
      const current = map.get(entry.event) ?? {
        event: entry.event,
        count: 0,
        errorCount: 0,
        slowCount: 0,
        totalDuration: 0,
        timedCount: 0,
        lastTs: entry.ts,
      };

      current.count += 1;
      current.lastTs = entry.ts;

      if (entry.event.endsWith('_error') || entry.event.includes('request_error')) {
        current.errorCount += 1;
      }

      const durationMs = typeof entry.payload.durationMs === 'number'
        ? entry.payload.durationMs
        : Number.NaN;
      if (Number.isFinite(durationMs)) {
        current.totalDuration += durationMs;
        current.timedCount += 1;
        if (durationMs >= 800) {
          current.slowCount += 1;
        }
      }

      map.set(entry.event, current);
    }

    return [...map.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, 12);
  }, [telemetryEntries]);

  const handleCopyTelemetry = async () => {
    try {
      const serialized = telemetryEntries.map((entry) => JSON.stringify(entry)).join('\n');
      await navigator.clipboard.writeText(serialized);
      toast.success(t('developer.telemetryCopied'));
    } catch (error) {
      toast.error(`${t('common:status.error')}: ${String(error)}`);
    }
  };

  const handleClearTelemetry = () => {
    clearUiTelemetry();
    setTelemetryEntries([]);
    toast.success(t('developer.telemetryCleared'));
  };

  const handleWsDiagnosticToggle = (enabled: boolean) => {
    setGatewayWsDiagnosticEnabled(enabled);
    setWsDiagnosticEnabled(enabled);
    toast.success(
      enabled
        ? t('developer.wsDiagnosticEnabled')
        : t('developer.wsDiagnosticDisabled'),
    );
  };

  const runtimeModeI18nKey = runtimeStatus?.runtime.mode === 'hermesclaw-both'
    || runtimeStatus?.runtime.mode === 'openclaw-with-hermes-agent'
    ? 'openclawWithHermesAgent'
    : runtimeStatus?.runtime.mode;

  const runtimeModeLabel = runtimeModeI18nKey
    ? t(`gateway.runtimeModeOptions.${runtimeModeI18nKey}`)
    : '—';

  const runtimeModeHint = runtimeModeI18nKey
    ? t(`gateway.runtimeModeHints.${runtimeModeI18nKey}`)
    : '';

  const bridgeStateLabel = runtimeStatus
    ? runtimeStatus.bridge.enabled
      ? runtimeStatus.bridge.attached
        ? t('gateway.bridgeStates.attached')
        : t('gateway.bridgeStates.detached')
      : t('gateway.bridgeStates.disabled')
    : '—';

  const hermesClawActiveChannel = hermesClawStatus?.manifest.activeChannel ?? 'stable';
  const hermesClawActiveRuntime = hermesClawStatus?.manifest.channels[hermesClawActiveChannel];
  const hermesNativePathDisplay = windowsHermesNativePathDraft.trim()
    || runtimeConfigSource.windowsHermesNativePath
    || hermesClawStatus?.installStatus.installPath
    || hermesClawActiveRuntime?.runtimeDir
    || '%USERPROFILE%\\.hermes';
  const hermesWslPathDisplay = windowsHermesWslDistroDraft.trim()
    ? `~/.hermes (WSL:${windowsHermesWslDistroDraft.trim()})`
    : '~/.hermes (WSL)';
  const hermesPathDisplay = windowsHermesPreferredModeDraft === 'native'
    ? hermesNativePathDisplay
    : hermesWslPathDisplay;
  const hermesAgentBridge = runtimeStatus?.bridge ?? hermesClawStatus?.bridge;
  const hermesAgentRuntime = runtimeStatus?.runtimes.find((runtime) => runtime.kind === 'hermes');
  const hermesAgentVersion = hermesClawStatus?.installStatus.version
    || hermesClawStatus?.runtimeState.runtimes.hermes?.version
    || hermesClawActiveRuntime?.version
    || hermesAgentRuntime?.version
    || '—';
  const hermesAgentStatusLabel = hermesAgentBridge
    ? !hermesAgentBridge.enabled
      ? 'Disabled'
      : hermesAgentBridge.attached
        ? 'Attached'
        : hermesAgentBridge.hermesInstalled
          ? 'Awaiting attach'
          : 'Not installed'
    : '—';
  const hermesAgentHealthLabel = hermesAgentBridge
    ? hermesAgentBridge.hermesHealthy
      ? 'Healthy'
      : hermesAgentBridge.error ?? 'Needs attention'
    : '—';
  const hermesUpdateSummary = hermesClawUpdateResult
    ? `${hermesClawUpdateResult.channel}: ${hermesClawUpdateResult.currentVersion ?? 'local'} → ${hermesClawUpdateResult.latestVersion ?? hermesClawUpdateResult.currentVersion ?? 'local'}${hermesClawUpdateResult.updateAvailable ? ' update available' : ' up to date'}${hermesClawUpdateResult.risk ? ` · risk ${hermesClawUpdateResult.risk}` : ''}${hermesClawUpdateResult.releaseNotes ? ` · ${hermesClawUpdateResult.releaseNotes}` : ''}`
    : null;
  const hermesClawDoctorSummary = hermesClawDoctorResult
    ? hermesClawDoctorResult.checks.map((check) => `${check.label}: ${check.status}`).join(' · ')
    : null;
  const openClawRuntime = runtimeStatus?.runtimes.find((item) => item.kind === 'openclaw') ?? null;
  const hermesRuntime = runtimeStatus?.runtimes.find((item) => item.kind === 'hermes') ?? null;

  const [activeTab, setActiveTab] = useState<SettingsTab>('overview');

  return (
    <div data-testid="settings-page" className="flex flex-col -m-6 dark:bg-background h-[calc(100vh-2.5rem)] overflow-hidden">
      <div className="w-full max-w-6xl mx-auto flex h-full">

        {/* Left Navigation */}
        <div className="w-64 border-r border-black/10 dark:border-white/10 flex flex-col p-6 space-y-1 shrink-0 overflow-y-auto">
          <h1 className="text-3xl font-serif text-foreground mb-8 font-normal tracking-tight" style={{ fontFamily: 'Georgia, Cambria, "Times New Roman", Times, serif' }}>
            {t('title')}
          </h1>
          {settingsTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "text-left px-4 py-2 rounded-lg text-[15px] transition-colors",
                activeTab === tab.id
                  ? "bg-black/5 dark:bg-white/10 text-foreground font-medium"
                  : "text-foreground/70 hover:bg-black/5 dark:hover:bg-white/5"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Right Content Area */}
        <div className="flex-1 overflow-y-auto p-10 pt-16 min-h-0">
          
          {activeTab === 'overview' && (
            <div className="space-y-12">
              <div className="mb-12">
                <h2 className="text-4xl font-serif text-foreground mb-3 font-normal tracking-tight" style={{ fontFamily: 'Georgia, Cambria, "Times New Roman", Times, serif' }}>Overview</h2>
                <p className="text-[17px] text-foreground/70 font-medium">{t('subtitle')}</p>
              </div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 p-5 space-y-3">
                  <Label className="text-[13px] text-muted-foreground">Gateway</Label>
                  <div className="text-2xl font-serif text-foreground" style={{ fontFamily: 'Georgia, Cambria, "Times New Roman", Times, serif' }}>
                    {gatewayStatus.state}
                  </div>
                  <p className="text-[12px] text-muted-foreground">{t('gateway.port')}: {gatewayStatus.port}</p>
                </div>
                <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 p-5 space-y-3">
                  <Label className="text-[13px] text-muted-foreground">OpenClaw</Label>
                  <div className="text-2xl font-serif text-foreground" style={{ fontFamily: 'Georgia, Cambria, "Times New Roman", Times, serif' }}>
                    {openClawRuntime?.running ? t('common:running') : openClawRuntime?.installed ? t('common:stopped') : 'Not installed'}
                  </div>
                  <p className="text-[12px] text-muted-foreground">{openClawRuntime?.version ?? 'local'}</p>
                </div>
                <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 p-5 space-y-3">
                  <Label className="text-[13px] text-muted-foreground">Hermes</Label>
                  <div className="text-2xl font-serif text-foreground" style={{ fontFamily: 'Georgia, Cambria, "Times New Roman", Times, serif' }}>
                    {hermesRuntime?.running ? t('common:running') : hermesRuntime?.installed ? t('common:stopped') : 'Not installed'}
                  </div>
                  <p className="text-[12px] text-muted-foreground">{hermesAgentVersion}</p>
                </div>
                <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 p-5 space-y-3">
                  <Label className="text-[13px] text-muted-foreground">Bridge</Label>
                  <div className="text-2xl font-serif text-foreground" style={{ fontFamily: 'Georgia, Cambria, "Times New Roman", Times, serif' }}>
                    {bridgeStateLabel}
                  </div>
                  <p className="text-[12px] text-muted-foreground">{runtimeModeLabel}</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'appearance' && (
            <div className="space-y-12">
              <section className="space-y-6">
            <h2 className="text-2xl md:text-3xl font-serif text-foreground font-normal tracking-tight" style={{ fontFamily: 'Georgia, Cambria, "Times New Roman", Times, serif' }}>
              {t('appearance.title')}
            </h2>
            <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 flex flex-col divide-y divide-black/5 dark:divide-white/5">
              <div className="p-5 space-y-4">
                <Label className="text-[15px] font-medium text-foreground/90">{t('appearance.theme')}</Label>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant={theme === 'light' ? 'secondary' : 'outline'}
                    className={cn("rounded-full px-5 h-10 border-black/10 dark:border-white/10", theme === 'light' ? "bg-black/5 dark:bg-white/10 text-foreground" : "bg-transparent text-muted-foreground hover:bg-black/5 dark:hover:bg-white/5")}
                    onClick={() => setTheme('light')}
                  >
                    <Sun className="h-4 w-4 mr-2" />
                    {t('appearance.light')}
                  </Button>
                  <Button
                    variant={theme === 'dark' ? 'secondary' : 'outline'}
                    className={cn("rounded-full px-5 h-10 border-black/10 dark:border-white/10", theme === 'dark' ? "bg-black/5 dark:bg-white/10 text-foreground" : "bg-transparent text-muted-foreground hover:bg-black/5 dark:hover:bg-white/5")}
                    onClick={() => setTheme('dark')}
                  >
                    <Moon className="h-4 w-4 mr-2" />
                    {t('appearance.dark')}
                  </Button>
                  <Button
                    variant={theme === 'system' ? 'secondary' : 'outline'}
                    className={cn("rounded-full px-5 h-10 border-black/10 dark:border-white/10", theme === 'system' ? "bg-black/5 dark:bg-white/10 text-foreground" : "bg-transparent text-muted-foreground hover:bg-black/5 dark:hover:bg-white/5")}
                    onClick={() => setTheme('system')}
                  >
                    <Monitor className="h-4 w-4 mr-2" />
                    {t('appearance.system')}
                  </Button>
                </div>
              </div>
              <div className="p-5 space-y-4">
                <Label className="text-[15px] font-medium text-foreground/90">{t('appearance.language')}</Label>
                <div className="flex flex-wrap gap-2">
                  {SUPPORTED_LANGUAGES.map((lang) => (
                    <Button
                      key={lang.code}
                      variant={language === lang.code ? 'secondary' : 'outline'}
                      className={cn("rounded-full px-5 h-10 border-black/10 dark:border-white/10", language === lang.code ? "bg-black/5 dark:bg-white/10 text-foreground" : "bg-transparent text-muted-foreground hover:bg-black/5 dark:hover:bg-white/5")}
                      onClick={() => setLanguage(lang.code)}
                    >
                      {lang.label}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <Label className="text-[15px] font-medium text-foreground/90">{t('appearance.launchAtStartup')}</Label>
                  <p className="text-[13px] text-muted-foreground mt-1">
                    {t('appearance.launchAtStartupDesc')}
                  </p>
                </div>
                <Switch
                  checked={launchAtStartup}
                  onCheckedChange={setLaunchAtStartup}
                />
              </div>
            </div>
          </section>

          <Separator className="bg-black/5 dark:bg-white/5" />
            </div>
          )}

          {activeTab === 'runtime' && (
            <div className="space-y-12">
              <section className="space-y-6">
            <h2 className="text-2xl md:text-3xl font-serif text-foreground font-normal tracking-tight" style={{ fontFamily: 'Georgia, Cambria, "Times New Roman", Times, serif' }}>
              {t('gateway.title')}
            </h2>
            <div className="space-y-6">
              
              <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 flex flex-col divide-y divide-black/5 dark:divide-white/5">
                <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <Label className="text-[15px] font-medium text-foreground/90">{t('gateway.status')}</Label>
                    <p className="text-[13px] text-muted-foreground mt-1">
                      {t('gateway.port')}: {gatewayStatus.port}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] font-medium border",
                      gatewayStatus.state === 'running' ? "bg-green-500/10 text-green-600 dark:text-green-500 border-green-500/20" :
                        gatewayStatus.state === 'error' ? "bg-red-500/10 text-red-600 dark:text-red-500 border-red-500/20" :
                          "bg-black/5 dark:bg-white/5 text-muted-foreground border-transparent"
                    )}>
                      <div className={cn("w-1.5 h-1.5 rounded-full",
                        gatewayStatus.state === 'running' ? "bg-green-500" :
                          gatewayStatus.state === 'error' ? "bg-red-500" : "bg-muted-foreground"
                      )} />
                      {gatewayStatus.state}
                    </div>
                    <Button variant="outline" size="sm" onClick={restartGateway} className="rounded-full h-8 px-4 border-black/10 dark:border-white/10 bg-transparent hover:bg-black/5 dark:hover:bg-white/5">
                      <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                      {t('common:actions.restart')}
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleShowLogs} className="rounded-full h-8 px-4 border-black/10 dark:border-white/10 bg-transparent hover:bg-black/5 dark:hover:bg-white/5">
                      <FileText className="h-3.5 w-3.5 mr-1.5" />
                      {t('gateway.logs')}
                    </Button>
                  </div>
                </div>

                <div className="p-5 flex items-center justify-between gap-4">
                  <div>
                    <Label className="text-[15px] font-medium text-foreground/90">{t('gateway.autoStart')}</Label>
                    <p className="text-[13px] text-muted-foreground mt-1">
                      {t('gateway.autoStartDesc')}
                    </p>
                  </div>
                  <Switch
                    checked={gatewayAutoStart}
                    onCheckedChange={setGatewayAutoStart}
                  />
                </div>
              </div>

              <div
                data-testid="settings-runtime-panel"
                className="rounded-2xl border border-black/10 dark:border-white/10 p-5 bg-black/5 dark:bg-white/5 space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div>
                    <Label className="text-[15px] font-medium text-foreground">{t('gateway.runtimeStatusTitle')}</Label>
                    <p className="text-[13px] text-muted-foreground mt-1" data-testid="settings-runtime-hint">
                      {runtimeStatusError
                        ? runtimeStatusError
                        : runtimeStatus
                          ? runtimeModeHint
                          : runtimeStatusLoading
                            ? t('gateway.runtimeStatusLoading')
                            : t('gateway.runtimeStatusUnavailable')}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void refreshRuntimeStatus()}
                    data-testid="settings-runtime-refresh-button"
                    className="rounded-full h-8 px-4 border-black/10 dark:border-white/10 bg-transparent hover:bg-black/5 dark:hover:bg-white/5"
                  >
                    <RefreshCw className={cn('h-3.5 w-3.5 mr-1.5', runtimeStatusLoading && 'animate-spin')} />
                    {t('gateway.runtimeStatusRefresh')}
                  </Button>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label className="text-[13px] text-foreground/80">{t('gateway.runtimeMode')}</Label>
                    <Badge
                      variant="outline"
                      className="rounded-full px-3 py-1 bg-white dark:bg-card border-black/5 dark:border-white/5"
                      data-testid="settings-runtime-mode-value"
                    >
                      {runtimeModeLabel}
                    </Badge>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[13px] text-foreground/80">{t('gateway.installedRuntimes')}</Label>
                    <div className="flex flex-wrap gap-2">
                      {runtimeStatus?.runtime.installedKinds.length ? runtimeStatus.runtime.installedKinds.map((kind) => (
                        <Badge
                          key={kind}
                          variant="outline"
                          className="rounded-full px-3 py-1 bg-white dark:bg-card border-black/5 dark:border-white/5"
                          data-testid={`settings-installed-runtime-${kind}`}
                        >
                          {kind === 'openclaw' ? t('gateway.runtimeLabels.openclaw') : t('gateway.runtimeLabels.hermes')}
                        </Badge>
                      )) : (
                        <span className="text-[13px] text-muted-foreground">—</span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[13px] text-foreground/80">{t('gateway.hermesBridge')}</Label>
                    <Badge
                      variant="outline"
                      className="rounded-full px-3 py-1 bg-white dark:bg-card border-black/5 dark:border-white/5"
                      data-testid="settings-runtime-bridge-badge"
                    >
                      {bridgeStateLabel}
                    </Badge>
                  </div>
                </div>

                {runtimeStatus?.runtimes.length ? (
                  <div className="grid gap-3 md:grid-cols-2">
                    {runtimeStatus.runtimes.map((runtime) => (
                      <div
                        key={runtime.kind}
                        className="rounded-2xl border border-black/5 dark:border-white/5 bg-white dark:bg-card p-4 space-y-2"
                        data-testid={`settings-runtime-entry-${runtime.kind}`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <Label className="text-[13px] text-foreground/80">
                            {runtime.kind === 'openclaw' ? t('gateway.runtimeLabels.openclaw') : t('gateway.runtimeLabels.hermes')}
                          </Label>
                          <div className="flex flex-wrap gap-2 justify-end">
                            <Badge
                              variant="outline"
                              className="rounded-full px-3 py-1 bg-white dark:bg-card border-black/5 dark:border-white/5"
                            >
                              {runtime.running ? t('common:running') : t('common:stopped')}
                            </Badge>
                            <Badge
                              variant="outline"
                              className="rounded-full px-3 py-1 bg-white dark:bg-card border-black/5 dark:border-white/5"
                            >
                              {runtime.healthy ? t('gateway.runtimeHealthStates.healthy') : t('gateway.runtimeHealthStates.degraded')}
                            </Badge>
                          </div>
                        </div>

                        {runtime.version && (
                          <p className="text-[12px] text-muted-foreground">
                            {t('settings:updates.currentVersion')}: {runtime.version}
                          </p>
                        )}

                        {runtime.endpoint && (
                          <p className="text-[12px] text-muted-foreground break-all">
                            {runtime.endpoint}
                          </p>
                        )}

                        {runtime.kind === 'hermes' && (
                          <div className="flex flex-wrap gap-2 pt-1">
                            {!runtime.installed && (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                data-testid="settings-runtime-hermes-install-button"
                                  disabled={hermesRuntimeActionLoading !== null || openClawRuntimeActionLoading !== null}
                                onClick={() => void handleRuntimeInstall('hermes')}
                                className="h-8 rounded-full px-3"
                              >
                                {hermesRuntimeActionLoading === 'install' ? (
                                  <RefreshCw className="mr-2 h-3.5 w-3.5 animate-spin" />
                                ) : null}
                                Install
                              </Button>
                            )}
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              data-testid="settings-runtime-hermes-start-button"
                              disabled={!runtime.installed || runtime.running || hermesRuntimeActionLoading !== null}
                              onClick={() => void handleHermesRuntimeAction('start')}
                              className="h-8 rounded-full px-3"
                            >
                              {hermesRuntimeActionLoading === 'start' ? (
                                <RefreshCw className="mr-2 h-3.5 w-3.5 animate-spin" />
                              ) : null}
                              Start
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              data-testid="settings-runtime-hermes-stop-button"
                              disabled={!runtime.installed || !runtime.running || hermesRuntimeActionLoading !== null}
                              onClick={() => void handleHermesRuntimeAction('stop')}
                              className="h-8 rounded-full px-3"
                            >
                              Stop
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              data-testid="settings-runtime-hermes-restart-button"
                              disabled={!runtime.installed || hermesRuntimeActionLoading !== null}
                              onClick={() => void handleHermesRuntimeAction('restart')}
                              className="h-8 rounded-full px-3"
                            >
                              {hermesRuntimeActionLoading === 'restart' ? (
                                <RefreshCw className="mr-2 h-3.5 w-3.5 animate-spin" />
                              ) : null}
                              Restart
                            </Button>
                          </div>
                        )}

                        {runtime.kind === 'openclaw' && (
                          <div className="space-y-2 pt-1">
                            <div className="flex flex-wrap gap-2">
                              {!runtime.installed && (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  data-testid="settings-runtime-openclaw-install-button"
                                  disabled={openClawRuntimeActionLoading !== null || hermesRuntimeActionLoading !== null}
                                  onClick={() => void handleRuntimeInstall('openclaw')}
                                  className="h-8 rounded-full px-3"
                                >
                                  {openClawRuntimeActionLoading === 'install' ? (
                                    <RefreshCw className="mr-2 h-3.5 w-3.5 animate-spin" />
                                  ) : null}
                                  Install
                                </Button>
                              )}
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                data-testid="settings-runtime-openclaw-start-button"
                                disabled={!runtime.installed || runtime.running || openClawRuntimeActionLoading !== null}
                                onClick={() => void handleOpenClawRuntimeAction('start')}
                                className="h-8 rounded-full px-3"
                              >
                                {openClawRuntimeActionLoading === 'start' ? (
                                  <RefreshCw className="mr-2 h-3.5 w-3.5 animate-spin" />
                                ) : null}
                                Start
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                data-testid="settings-runtime-openclaw-stop-button"
                                disabled={!runtime.installed || !runtime.running || openClawRuntimeActionLoading !== null}
                                onClick={() => void handleOpenClawRuntimeAction('stop')}
                                className="h-8 rounded-full px-3"
                              >
                                Stop
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                data-testid="settings-runtime-openclaw-restart-button"
                                disabled={!runtime.installed || openClawRuntimeActionLoading !== null}
                                onClick={() => void handleOpenClawRuntimeAction('restart')}
                                className="h-8 rounded-full px-3"
                              >
                                {openClawRuntimeActionLoading === 'restart' ? (
                                  <RefreshCw className="mr-2 h-3.5 w-3.5 animate-spin" />
                                ) : null}
                                Restart
                              </Button>
                            </div>
                          </div>
                        )}

                        {runtime.error && (
                          <p className="text-[12px] text-muted-foreground">
                            {runtime.error}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : null}

                {isWindows && (
                  <div
                    data-testid="settings-runtime-config-panel"
                    className="rounded-2xl border border-black/5 dark:border-white/5 bg-white dark:bg-card p-4 space-y-4"
                  >
                    <div className="space-y-1">
                      <Label className="text-[13px] text-foreground/80">{t('gateway.runtimeWindowsConfigTitle')}</Label>
                      <p className="text-[12px] text-muted-foreground">{t('gateway.runtimeWindowsConfigHint')}</p>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-[13px] text-foreground/80">{t('gateway.runtimeWindowsMode')}</Label>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant={windowsHermesPreferredModeDraft === 'native' ? 'default' : 'outline'}
                          data-testid="settings-runtime-mode-native"
                          onClick={() => setWindowsHermesPreferredModeDraft('native')}
                          className="rounded-full h-8 px-4"
                        >
                          {t('gateway.runtimeWindowsModeOptions.native')}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant={windowsHermesPreferredModeDraft === 'wsl2' ? 'default' : 'outline'}
                          data-testid="settings-runtime-mode-wsl2"
                          onClick={() => setWindowsHermesPreferredModeDraft('wsl2')}
                          className="rounded-full h-8 px-4"
                        >
                          {t('gateway.runtimeWindowsModeOptions.wsl2')}
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="settings-runtime-native-path" className="text-[13px] text-foreground/80">
                        {t('gateway.runtimeWindowsNativePath')}
                      </Label>
                      <Input
                        id="settings-runtime-native-path"
                        data-testid="settings-runtime-native-path"
                        value={windowsHermesNativePathDraft}
                        onChange={(event) => setWindowsHermesNativePathDraft(event.target.value)}
                        placeholder="%USERPROFILE%\\.hermes"
                      />
                      <p className="text-[12px] text-muted-foreground">{t('gateway.runtimeWindowsNativePathHelp')}</p>
                      <p className="text-[12px] text-muted-foreground break-all" data-testid="settings-runtime-hermes-path-display">
                        Hermes default path: {hermesPathDisplay}
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="settings-runtime-wsl-distro" className="text-[13px] text-foreground/80">
                        {t('gateway.runtimeWindowsWslDistro')}
                      </Label>
                      <Input
                        id="settings-runtime-wsl-distro"
                        data-testid="settings-runtime-wsl-distro"
                        value={windowsHermesWslDistroDraft}
                        onChange={(event) => setWindowsHermesWslDistroDraft(event.target.value)}
                        placeholder="Ubuntu-24.04"
                      />
                      <p className="text-[12px] text-muted-foreground">{t('gateway.runtimeWindowsWslDistroHelp')}</p>
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[12px] text-muted-foreground">{t('gateway.runtimeWindowsConfigSaveHint')}</p>
                      <Button
                        type="button"
                        size="sm"
                        data-testid="settings-runtime-save-button"
                        disabled={!runtimeConfigDirty || runtimeConfigSaving}
                        onClick={() => void handleSaveWindowsHermesRuntimeConfig()}
                        className="rounded-full h-8 px-4"
                      >
                        <RefreshCw className={cn('h-3.5 w-3.5 mr-1.5', runtimeConfigSaving && 'animate-spin')} />
                        {runtimeConfigSaving ? t('common:status.saving') : t('common:actions.save')}
                      </Button>
                    </div>
                  </div>
                )}

                {runtimeStatus?.bridge.error && (
                  <p className="text-[12px] text-muted-foreground" data-testid="settings-runtime-bridge-error">
                    {runtimeStatus.bridge.error}
                  </p>
                )}

                {runtimeStatus?.bridge.enabled && (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void handleBridgeAction('attach')}
                      data-testid="settings-runtime-bridge-attach-button"
                      disabled={bridgeActionLoading != null}
                      className="rounded-full h-8 px-4 border-black/10 dark:border-white/10 bg-transparent hover:bg-black/5 dark:hover:bg-white/5"
                    >
                      {t('gateway.bridgeAttach')}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void handleBridgeAction('recheck')}
                      data-testid="settings-runtime-bridge-recheck-button"
                      disabled={bridgeActionLoading != null}
                      className="rounded-full h-8 px-4 border-black/10 dark:border-white/10 bg-transparent hover:bg-black/5 dark:hover:bg-white/5"
                    >
                      <RefreshCw className={cn('h-3.5 w-3.5 mr-1.5', bridgeActionLoading === 'recheck' && 'animate-spin')} />
                      {t('gateway.bridgeRecheck')}
                    </Button>
                  </div>
                )}
              </div>

              {showLogs && (
                <div className="p-4 rounded-2xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5">
                  <div className="flex items-center justify-between mb-3">
                    <p className="font-medium text-[14px]">{t('gateway.appLogs')}</p>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" className="h-7 text-[12px] rounded-full hover:bg-black/5 dark:hover:bg-white/10" onClick={handleOpenLogDir}>
                        <ExternalLink className="h-3 w-3 mr-1.5" />
                        {t('gateway.openFolder')}
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 text-[12px] rounded-full hover:bg-black/5 dark:hover:bg-white/10" onClick={() => setShowLogs(false)}>
                        {t('common:actions.close')}
                      </Button>
                    </div>
                  </div>
                  <pre className="text-[12px] text-muted-foreground bg-white dark:bg-card p-4 rounded-xl max-h-60 overflow-auto whitespace-pre-wrap font-mono border border-black/5 dark:border-white/5 shadow-inner">
                    {logContent || t('chat:noLogs')}
                  </pre>
                </div>
              )}

            </div>
          </section>
            </div>
          )}

          {activeTab === 'integration' && (
            <div className="space-y-12">
              <h2 className="text-2xl md:text-3xl font-serif text-foreground font-normal tracking-tight" style={{ fontFamily: 'Georgia, Cambria, "Times New Roman", Times, serif' }}>
                HermesClaw Integration
              </h2>
              <div
                data-testid="settings-hermesclaw-panel"
                className="rounded-2xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 p-5 space-y-5"
              >
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="space-y-1">
                    <Label className="text-[15px] font-medium text-foreground/90">HermesClaw Local Integration</Label>
                    <p className="text-[12px] text-muted-foreground break-all" data-testid="settings-hermesclaw-root">
                      {hermesClawStatus?.layout.rootDir ?? '—'}
                    </p>
                  </div>
                  <Badge variant="outline" className="rounded-full px-3 py-1 bg-white dark:bg-card border-black/5 dark:border-white/5" data-testid="settings-hermesclaw-channel">
                    {hermesClawActiveChannel}
                  </Badge>
                </div>

                <div className="grid gap-3 md:grid-cols-4">
                  <div className="space-y-1 rounded-2xl border border-black/5 dark:border-white/5 bg-white dark:bg-card p-4">
                    <p className="text-[12px] text-muted-foreground">Active version</p>
                    <p className="text-[13px] text-foreground" data-testid="settings-hermesclaw-version">
                      {hermesClawActiveRuntime?.version ?? '—'}
                    </p>
                  </div>
                  <div className="space-y-1 rounded-2xl border border-black/5 dark:border-white/5 bg-white dark:bg-card p-4">
                    <p className="text-[12px] text-muted-foreground">Shared config</p>
                    <p className="text-[13px] text-foreground" data-testid="settings-hermesclaw-shared-config-count">
                      {(hermesClawSharedConfig?.skills.length ?? 0)
                        + (hermesClawSharedConfig?.agents.length ?? 0)
                        + (hermesClawSharedConfig?.rules.length ?? 0)
                        + (hermesClawSharedConfig?.providers.length ?? 0)
                        + (hermesClawSharedConfig?.tools.length ?? 0)
                        + (hermesClawSharedConfig?.hooks.length ?? 0)} entries
                    </p>
                  </div>
                  <div className="space-y-1 rounded-2xl border border-black/5 dark:border-white/5 bg-white dark:bg-card p-4">
                    <p className="text-[12px] text-muted-foreground">Install status</p>
                    <p className="text-[13px] text-foreground" data-testid="settings-hermesclaw-install-status">
                      {hermesClawStatus?.installStatus.installed ? 'Installed' : 'Not installed'}
                    </p>
                  </div>
                  <div className="space-y-1 rounded-2xl border border-black/5 dark:border-white/5 bg-white dark:bg-card p-4">
                    <p className="text-[12px] text-muted-foreground">HermesAgent</p>
                    <p className="text-[13px] text-foreground" data-testid="settings-hermes-agent-version">
                      {hermesAgentVersion}
                    </p>
                    <p className="text-[12px] text-muted-foreground" data-testid="settings-hermes-agent-status">
                      {hermesAgentStatusLabel} · {hermesAgentHealthLabel}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" data-testid="settings-hermesclaw-open-logs-button" disabled={hermesClawActionLoading != null} onClick={() => void handleHermesClawOpenLogs()} className="rounded-full h-8 px-4">
                    Open Logs
                  </Button>
                  <Button type="button" variant="outline" size="sm" data-testid="settings-hermesclaw-sync-button" disabled={hermesClawActionLoading != null} onClick={() => void handleHermesClawSync()} className="rounded-full h-8 px-4">
                    Dry-run Sync
                  </Button>
                </div>

                {hermesClawSyncResult && (
                  <p className="text-[12px] text-muted-foreground" data-testid="settings-hermesclaw-sync-log">
                    {hermesClawSyncResult.log.join(' · ')}
                  </p>
                )}
              </div>
            </div>
          )}

          {activeTab === 'advanced' && (
            <div className="space-y-12">
              <section className="space-y-6">
                <h2 className="text-2xl md:text-3xl font-serif text-foreground font-normal tracking-tight" style={{ fontFamily: 'Georgia, Cambria, "Times New Roman", Times, serif' }}>
                  Advanced & Diagnostics
                </h2>
                <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 flex flex-col divide-y divide-black/5 dark:divide-white/5">
                  <div className="p-5 flex items-center justify-between gap-4">
                    <div>
                      <Label className="text-[15px] font-medium text-foreground/90">{t('advanced.devMode')}</Label>
                      <p className="text-[13px] text-muted-foreground mt-1">
                        {t('advanced.devModeDesc')}
                      </p>
                    </div>
                    <Switch
                      checked={devModeUnlocked}
                      onCheckedChange={setDevModeUnlocked}
                      data-testid="settings-dev-mode-switch"
                    />
                  </div>

                  <div className="p-5 flex items-center justify-between gap-4">
                    <div>
                      <Label className="text-[15px] font-medium text-foreground/90">{t('advanced.telemetry')}</Label>
                      <p className="text-[13px] text-muted-foreground mt-1">
                        {t('advanced.telemetryDesc')}
                      </p>
                    </div>
                    <Switch
                      checked={telemetryEnabled}
                      onCheckedChange={setTelemetryEnabled}
                    />
                  </div>
                </div>

                <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 p-5 space-y-4">
                  <div>
                    <Label className="text-[15px] font-medium text-foreground/90">HermesClaw Doctor</Label>
                    <p className="text-[13px] text-muted-foreground mt-1">Repair and diagnostic tools for local HermesAgent integration.</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" size="sm" data-testid="settings-hermesclaw-doctor-button" disabled={hermesClawActionLoading != null} onClick={() => void handleHermesClawDoctor()} className="rounded-full h-8 px-4">
                      <RefreshCw className={cn('h-3.5 w-3.5 mr-1.5', hermesClawActionLoading === 'doctor' && 'animate-spin')} />
                      Run Doctor
                    </Button>
                    <Button type="button" variant="outline" size="sm" data-testid="settings-hermesclaw-repair-button" disabled={hermesClawActionLoading != null} onClick={() => void handleHermesClawRepair()} className="rounded-full h-8 px-4">
                      <RefreshCw className={cn('h-3.5 w-3.5 mr-1.5', hermesClawActionLoading === 'repair' && 'animate-spin')} />
                      Repair Install
                    </Button>
                  </div>
                  {hermesClawDoctorSummary && (
                    <div className="space-y-1 text-[12px] text-muted-foreground">
                      <p data-testid="settings-hermesclaw-doctor-result">
                        {hermesClawDoctorSummary}
                      </p>
                      {hermesClawDoctorResult?.reportPath && (
                        <p className="break-all" data-testid="settings-hermesclaw-report-path">
                          Diagnostic report: {hermesClawDoctorResult.reportPath}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </section>
              {devModeUnlocked && (
            <>
              <Separator className="bg-black/5 dark:bg-white/5" />
              <div data-testid="settings-developer-section">
                <h2 data-testid="settings-developer-title" className="text-3xl font-serif text-foreground mb-6 font-normal tracking-tight" style={{ fontFamily: 'Georgia, Cambria, "Times New Roman", Times, serif' }}>
                  {t('developer.title')}
                </h2>
                <div className="space-y-8">
                  {/* Gateway Proxy */}
                  <div className="space-y-4" data-testid="settings-proxy-section">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-[14px] font-medium text-foreground/80">Gateway Proxy</Label>
                        <p className="text-[13px] text-muted-foreground">
                          {t('gateway.proxyDesc')}
                        </p>
                      </div>
                      <Switch
                        checked={proxyEnabledDraft}
                        onCheckedChange={setProxyEnabledDraft}
                        data-testid="settings-proxy-toggle"
                      />
                    </div>

                    <div className="flex items-center gap-4">
                      <Button
                        variant="outline"
                        onClick={handleSaveProxySettings}
                        disabled={savingProxy || !proxySettingsDirty}
                        data-testid="settings-proxy-save-button"
                        className="rounded-xl h-10 px-5 bg-transparent border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5"
                      >
                        <RefreshCw className={`h-4 w-4 mr-2${savingProxy ? ' animate-spin' : ''}`} />
                        {savingProxy ? t('common:status.saving') : t('common:actions.save')}
                      </Button>
                      <p className="text-[12px] text-muted-foreground">
                        {t('gateway.proxyRestartNote')}
                      </p>
                    </div>

                    {proxyEnabledDraft && (
                      <div className="space-y-4 pt-2">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="proxy-server" className="text-[13px] text-foreground/80">{t('gateway.proxyServer')}</Label>
                            <Input
                              id="proxy-server"
                              value={proxyServerDraft}
                              onChange={(event) => setProxyServerDraft(event.target.value)}
                              placeholder="http://127.0.0.1:7890"
                              className="h-10 rounded-xl bg-black/5 dark:bg-white/5 border-transparent font-mono text-[13px]"
                            />
                            <p className="text-[11px] text-muted-foreground">
                              {t('gateway.proxyServerHelp')}
                            </p>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="proxy-http-server" className="text-[13px] text-foreground/80">{t('gateway.proxyHttpServer')}</Label>
                            <Input
                              id="proxy-http-server"
                              value={proxyHttpServerDraft}
                              onChange={(event) => setProxyHttpServerDraft(event.target.value)}
                              placeholder={proxyServerDraft || 'http://127.0.0.1:7890'}
                              className="h-10 rounded-xl bg-black/5 dark:bg-white/5 border-transparent font-mono text-[13px]"
                            />
                            <p className="text-[11px] text-muted-foreground">
                              {t('gateway.proxyHttpServerHelp')}
                            </p>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="proxy-https-server" className="text-[13px] text-foreground/80">{t('gateway.proxyHttpsServer')}</Label>
                            <Input
                              id="proxy-https-server"
                              value={proxyHttpsServerDraft}
                              onChange={(event) => setProxyHttpsServerDraft(event.target.value)}
                              placeholder={proxyServerDraft || 'http://127.0.0.1:7890'}
                              className="h-10 rounded-xl bg-black/5 dark:bg-white/5 border-transparent font-mono text-[13px]"
                            />
                            <p className="text-[11px] text-muted-foreground">
                              {t('gateway.proxyHttpsServerHelp')}
                            </p>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="proxy-all-server" className="text-[13px] text-foreground/80">{t('gateway.proxyAllServer')}</Label>
                            <Input
                              id="proxy-all-server"
                              value={proxyAllServerDraft}
                              onChange={(event) => setProxyAllServerDraft(event.target.value)}
                              placeholder={proxyServerDraft || 'socks5://127.0.0.1:7891'}
                              className="h-10 rounded-xl bg-black/5 dark:bg-white/5 border-transparent font-mono text-[13px]"
                            />
                            <p className="text-[11px] text-muted-foreground">
                              {t('gateway.proxyAllServerHelp')}
                            </p>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="proxy-bypass" className="text-[13px] text-foreground/80">{t('gateway.proxyBypass')}</Label>
                          <Input
                            id="proxy-bypass"
                            value={proxyBypassRulesDraft}
                            onChange={(event) => setProxyBypassRulesDraft(event.target.value)}
                            placeholder="<local>;localhost;127.0.0.1;::1"
                            className="h-10 rounded-xl bg-black/5 dark:bg-white/5 border-transparent font-mono text-[13px]"
                          />
                          <p className="text-[11px] text-muted-foreground">
                            {t('gateway.proxyBypassHelp')}
                          </p>
                        </div>

                      </div>
                    )}
                  </div>
                  <div className="space-y-4 pt-4">
                    <Label className="text-[14px] font-medium text-foreground/80">{t('developer.gatewayToken')}</Label>
                    <p className="text-[13px] text-muted-foreground">
                      {t('developer.gatewayTokenDesc')}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Input
                        data-testid="settings-developer-gateway-token"
                        readOnly
                        value={controlUiInfo?.token || ''}
                        placeholder={t('developer.tokenUnavailable')}
                        className="font-mono text-[13px] h-10 rounded-xl bg-black/5 dark:bg-white/5 border-transparent flex-1 min-w-[200px]"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={refreshControlUiInfo}
                        disabled={!devModeUnlocked}
                        className="rounded-xl h-10 px-4 bg-transparent border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5"
                      >
                        <RefreshCw className="h-4 w-4 mr-2" />
                        {t('common:actions.load')}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleCopyGatewayToken}
                        disabled={!controlUiInfo?.token}
                        className="rounded-xl h-10 px-4 bg-transparent border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5"
                      >
                        <Copy className="h-4 w-4 mr-2" />
                        {t('common:actions.copy')}
                      </Button>
                    </div>
                  </div>

                  {showCliTools && (
                    <div className="space-y-3">
                      <Label className="text-[15px] font-medium text-foreground">{t('developer.cli')}</Label>
                      <p className="text-[13px] text-muted-foreground">
                        {t('developer.cliDesc')}
                      </p>
                      {isWindows && (
                        <p className="text-[12px] text-muted-foreground">
                          {t('developer.cliPowershell')}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-2">
                        <Input
                          readOnly
                          value={openclawCliCommand}
                          placeholder={openclawCliError || t('developer.cmdUnavailable')}
                          className="font-mono text-[13px] h-10 rounded-xl bg-black/5 dark:bg-white/5 border-transparent flex-1 min-w-[200px]"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleCopyCliCommand}
                          disabled={!openclawCliCommand}
                          className="rounded-xl h-10 px-4 bg-transparent border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5"
                        >
                          <Copy className="h-4 w-4 mr-2" />
                          {t('common:actions.copy')}
                        </Button>
                      </div>
                    </div>
                  )}

                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <Label className="text-[14px] font-medium text-foreground">{t('developer.doctor')}</Label>
                        <p className="text-[13px] text-muted-foreground mt-1">
                          {t('developer.doctorDesc')}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => void handleRunOpenClawDoctor('diagnose')}
                          disabled={doctorRunningMode !== null}
                          className="rounded-xl h-10 px-4 bg-transparent border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5"
                        >
                          <RefreshCw className={`h-4 w-4 mr-2${doctorRunningMode === 'diagnose' ? ' animate-spin' : ''}`} />
                          {doctorRunningMode === 'diagnose' ? t('common:status.running') : t('developer.runDoctor')}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => void handleRunOpenClawDoctor('fix')}
                          disabled={doctorRunningMode !== null}
                          className="rounded-xl h-10 px-4 bg-transparent border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5"
                        >
                          <RefreshCw className={`h-4 w-4 mr-2${doctorRunningMode === 'fix' ? ' animate-spin' : ''}`} />
                          {doctorRunningMode === 'fix' ? t('common:status.running') : t('developer.runDoctorFix')}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleCopyDoctorOutput}
                          disabled={!doctorResult}
                          className="rounded-xl h-10 px-4 bg-transparent border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5"
                        >
                          <Copy className="h-4 w-4 mr-2" />
                          {t('common:actions.copy')}
                        </Button>
                      </div>
                    </div>

                    {doctorResult && (
                      <div className="space-y-3 rounded-2xl border border-black/10 dark:border-white/10 p-5 bg-black/5 dark:bg-white/5">
                        <div className="flex flex-wrap gap-2 text-[12px]">
                          <Badge variant={doctorResult.success ? 'secondary' : 'destructive'} className="rounded-full px-3 py-1">
                            {doctorResult.mode === 'fix'
                              ? (doctorResult.success ? t('developer.doctorFixOk') : t('developer.doctorFixIssue'))
                              : (doctorResult.success ? t('developer.doctorOk') : t('developer.doctorIssue'))}
                          </Badge>
                          <Badge variant="outline" className="rounded-full px-3 py-1">
                            {t('developer.doctorExitCode')}: {doctorResult.exitCode ?? 'null'}
                          </Badge>
                          <Badge variant="outline" className="rounded-full px-3 py-1">
                            {t('developer.doctorDuration')}: {Math.round(doctorResult.durationMs)}ms
                          </Badge>
                        </div>
                        <div className="space-y-1 text-[12px] text-muted-foreground font-mono break-all">
                          <p>{t('developer.doctorCommand')}: {doctorResult.command}</p>
                          <p>{t('developer.doctorWorkingDir')}: {doctorResult.cwd || '-'}</p>
                          {doctorResult.error && <p>{t('developer.doctorError')}: {doctorResult.error}</p>}
                        </div>
                        <div className="grid gap-3 md:grid-cols-2">
                          <div className="space-y-2">
                            <p className="text-[12px] font-semibold text-foreground/80">{t('developer.doctorStdout')}</p>
                            <pre className="max-h-72 overflow-auto rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-card p-3 text-[11px] font-mono whitespace-pre-wrap break-words">
                              {doctorResult.stdout.trim() || t('developer.doctorOutputEmpty')}
                            </pre>
                          </div>
                          <div className="space-y-2">
                            <p className="text-[12px] font-semibold text-foreground/80">{t('developer.doctorStderr')}</p>
                            <pre className="max-h-72 overflow-auto rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-card p-3 text-[11px] font-mono whitespace-pre-wrap break-words">
                              {doctorResult.stderr.trim() || t('developer.doctorOutputEmpty')}
                            </pre>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between rounded-2xl border border-black/10 dark:border-white/10 p-5 bg-transparent">
                      <div>
                        <Label className="text-[14px] font-medium text-foreground">{t('developer.wsDiagnostic')}</Label>
                        <p className="text-[13px] text-muted-foreground mt-1">
                          {t('developer.wsDiagnosticDesc')}
                        </p>
                      </div>
                      <Switch
                        checked={wsDiagnosticEnabled}
                        onCheckedChange={handleWsDiagnosticToggle}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-[14px] font-medium text-foreground">{t('developer.telemetryViewer')}</Label>
                        <p className="text-[13px] text-muted-foreground mt-1">
                          {t('developer.telemetryViewerDesc')}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setShowTelemetryViewer((prev) => !prev)}
                        className="rounded-full px-5 h-9 bg-transparent border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5"
                      >
                        {showTelemetryViewer
                          ? t('common:actions.hide')
                          : t('common:actions.show')}
                      </Button>
                    </div>

                    {showTelemetryViewer && (
                      <div className="space-y-4 rounded-2xl border border-black/10 dark:border-white/10 p-5 bg-black/5 dark:bg-white/5">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="secondary" className="rounded-full px-3 py-1 bg-white dark:bg-card border border-black/5 dark:border-white/5">{t('developer.telemetryTotal')}: {telemetryStats.total}</Badge>
                          <Badge variant={telemetryStats.errorCount > 0 ? 'destructive' : 'secondary'} className={cn("rounded-full px-3 py-1", telemetryStats.errorCount === 0 && "bg-white dark:bg-card border border-black/5 dark:border-white/5")}>
                            {t('developer.telemetryErrors')}: {telemetryStats.errorCount}
                          </Badge>
                          <Badge variant={telemetryStats.slowCount > 0 ? 'secondary' : 'outline'} className={cn("rounded-full px-3 py-1", telemetryStats.slowCount === 0 && "bg-white dark:bg-card border border-black/5 dark:border-white/5")}>
                            {t('developer.telemetrySlow')}: {telemetryStats.slowCount}
                          </Badge>
                          <div className="ml-auto flex gap-2">
                            <Button type="button" variant="outline" size="sm" onClick={handleCopyTelemetry} className="rounded-full h-8 px-4 bg-white dark:bg-card border-black/5 dark:border-white/5 hover:bg-black/5 dark:hover:bg-white/10">
                              <Copy className="h-3.5 w-3.5 mr-1.5" />
                              {t('common:actions.copy')}
                            </Button>
                            <Button type="button" variant="outline" size="sm" onClick={handleClearTelemetry} className="rounded-full h-8 px-4 bg-white dark:bg-card border-black/5 dark:border-white/5 hover:bg-black/5 dark:hover:bg-white/10">
                              {t('common:actions.clear')}
                            </Button>
                          </div>
                        </div>

                        <div className="max-h-80 overflow-auto rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-card shadow-inner">
                          {telemetryByEvent.length > 0 && (
                            <div className="border-b border-black/5 dark:border-white/5 bg-black/5 dark:bg-white/5 p-3">
                              <p className="mb-3 text-[12px] font-semibold text-muted-foreground">
                                {t('developer.telemetryAggregated')}
                              </p>
                              <div className="space-y-1.5 text-[12px]">
                                {telemetryByEvent.map((item) => (
                                  <div
                                    key={item.event}
                                    className="grid grid-cols-[minmax(0,1.6fr)_0.7fr_0.9fr_0.8fr_1fr] gap-2 rounded-lg border border-black/5 dark:border-white/5 bg-white dark:bg-card px-3 py-2"
                                  >
                                    <span className="truncate font-medium" title={item.event}>{item.event}</span>
                                    <span className="text-muted-foreground">n={item.count}</span>
                                    <span className="text-muted-foreground">
                                      avg={item.timedCount > 0 ? Math.round(item.totalDuration / item.timedCount) : 0}ms
                                    </span>
                                    <span className="text-muted-foreground">slow={item.slowCount}</span>
                                    <span className="text-muted-foreground">err={item.errorCount}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          <div className="space-y-2 p-3 font-mono text-[12px]">
                            {telemetryEntries.length === 0 ? (
                              <div className="text-muted-foreground text-center py-4">{t('developer.telemetryEmpty')}</div>
                            ) : (
                              telemetryEntries
                                .slice()
                                .reverse()
                                .map((entry) => (
                                  <div key={entry.id} className="rounded-lg border border-black/5 dark:border-white/5 bg-black/5 dark:bg-white/5 p-3">
                                    <div className="flex items-center justify-between gap-3 mb-2">
                                      <span className="font-semibold text-foreground">{entry.event}</span>
                                      <span className="text-muted-foreground text-[11px]">{entry.ts}</span>
                                    </div>
                                    <pre className="whitespace-pre-wrap text-[11px] text-muted-foreground overflow-x-auto">
                                      {JSON.stringify({ count: entry.count, ...entry.payload }, null, 2)}
                                    </pre>
                                  </div>
                                ))
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}

          <Separator className="bg-black/5 dark:bg-white/5" />
            </div>
          )}

          {activeTab === 'updates' && (
            <div className="space-y-12">
              <section className="space-y-6">
            <h2 className="text-2xl md:text-3xl font-serif text-foreground font-normal tracking-tight" style={{ fontFamily: 'Georgia, Cambria, "Times New Roman", Times, serif' }}>
              {t('updates.title')}
            </h2>
            <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 flex flex-col divide-y divide-black/5 dark:divide-white/5">
              <div className="p-5">
                <UpdateSettings />
              </div>
              <div className="p-5 space-y-5">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 rounded-2xl border border-black/5 dark:border-white/5 bg-white dark:bg-card p-4">
                  <div>
                    <Label className="text-[15px] font-medium text-foreground/90">OpenClaw Runtime</Label>
                    <p className="text-[12px] text-muted-foreground mt-1">
                      {openClawRuntime?.version ?? 'local'} · {openClawRuntime?.installed ? 'Installed' : 'Not installed'}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      data-testid="settings-runtime-openclaw-update-check-button"
                      disabled={!openClawRuntime?.installed || openClawRuntimeActionLoading !== null}
                      onClick={() => void handleOpenClawRuntimeAction('check-update')}
                      className="h-8 rounded-full px-3"
                    >
                      Check Update
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      data-testid="settings-runtime-openclaw-update-apply-button"
                      disabled={!openClawRuntime?.installed || openClawRuntimeActionLoading !== null}
                      onClick={() => void handleOpenClawRuntimeAction('apply-update')}
                      className="h-8 rounded-full px-3"
                    >
                      Apply Update
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      data-testid="settings-runtime-openclaw-rollback-button"
                      disabled={!openClawRuntime?.installed || openClawRuntimeActionLoading !== null}
                      onClick={() => void handleOpenClawRuntimeAction('rollback')}
                      className="h-8 rounded-full px-3"
                    >
                      Rollback
                    </Button>
                  </div>
                </div>
                {openClawUpdateResult && (
                  <p className="text-[12px] text-muted-foreground" data-testid="settings-runtime-openclaw-update-result">
                    {openClawUpdateResult.success === false
                      ? `${openClawUpdateResult.error ?? 'OpenClaw runtime management action failed'}${openClawUpdateResult.rolledBack && openClawUpdateResult.restoredVersion ? ` · rolled back to ${openClawUpdateResult.restoredVersion}` : ''}${openClawUpdateResult.rollbackError ? ` · rollback error ${openClawUpdateResult.rollbackError}` : ''}`
                      : openClawUpdateResult.action === 'check-update'
                        ? `${openClawUpdateResult.channel ?? 'stable'}: ${openClawUpdateResult.latestVersion ?? openClawUpdateResult.currentVersion ?? 'local'}${openClawUpdateResult.updateAvailable ? ' update available' : ' up to date'}${openClawUpdateResult.risk ? ` · risk ${openClawUpdateResult.risk}` : ''}${openClawUpdateResult.releaseNotes ? ` · ${openClawUpdateResult.releaseNotes}` : ''}`
                        : openClawUpdateResult.action === 'apply-update'
                          ? `Applied OpenClaw ${openClawUpdateResult.version ?? 'runtime'}${openClawUpdateResult.backupId ? ` · backup ${openClawUpdateResult.backupId}` : ''}${openClawUpdateResult.gatewayRefreshAction ? ` · Gateway ${openClawUpdateResult.gatewayRefreshAction}${openClawUpdateResult.gatewayReady ? ' ready' : ' not ready'}` : ''}`
                          : `Rolled back OpenClaw to ${openClawUpdateResult.restoredVersion ?? 'previous runtime'}${openClawUpdateResult.backupId ? ` · backup ${openClawUpdateResult.backupId}` : ''}${openClawUpdateResult.gatewayRefreshAction ? ` · Gateway ${openClawUpdateResult.gatewayRefreshAction}${openClawUpdateResult.gatewayReady ? ' ready' : ' not ready'}` : ''}`}
                  </p>
                )}

                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 rounded-2xl border border-black/5 dark:border-white/5 bg-white dark:bg-card p-4">
                  <div>
                    <Label className="text-[15px] font-medium text-foreground/90">HermesAgent Runtime</Label>
                    <p className="text-[12px] text-muted-foreground mt-1">
                      {hermesAgentVersion} · {hermesAgentStatusLabel}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" size="sm" data-testid="settings-hermesclaw-update-check-button" disabled={hermesClawActionLoading != null} onClick={() => void handleHermesClawCheckUpdate()} className="rounded-full h-8 px-4">
                      <RefreshCw className={cn('h-3.5 w-3.5 mr-1.5', hermesClawActionLoading === 'check-update' && 'animate-spin')} />
                      Check Update
                    </Button>
                    <Button type="button" variant="outline" size="sm" data-testid="settings-hermesclaw-update-apply-button" disabled={hermesClawActionLoading != null || hermesClawUpdateResult?.updateAvailable !== true} onClick={() => void handleHermesClawApplyUpdate()} className="rounded-full h-8 px-4">
                      <RefreshCw className={cn('h-3.5 w-3.5 mr-1.5', hermesClawActionLoading === 'apply-update' && 'animate-spin')} />
                      Apply Update
                    </Button>
                    <Button type="button" variant="outline" size="sm" data-testid="settings-hermesclaw-rollback-button" disabled={hermesClawActionLoading != null} onClick={() => void handleHermesClawRollback()} className="rounded-full h-8 px-4">
                      Rollback
                    </Button>
                  </div>
                </div>
                {hermesUpdateSummary && (
                  <p className="text-[12px] text-muted-foreground" data-testid="settings-hermesclaw-update-result">
                    {hermesUpdateSummary.replace(/ 路 /g, ' · ')}
                  </p>
                )}
              </div>
              <div className="p-5 flex items-center justify-between gap-4">
                <div>
                  <Label className="text-[15px] font-medium text-foreground/90">{t('updates.autoCheck')}</Label>
                  <p className="text-[13px] text-muted-foreground mt-1">
                    {t('updates.autoCheckDesc')}
                  </p>
                </div>
                <Switch
                  checked={autoCheckUpdate}
                  onCheckedChange={setAutoCheckUpdate}
                />
              </div>
              <div className="p-5 flex items-center justify-between gap-4">
                <div>
                  <Label className="text-[15px] font-medium text-foreground/90">{t('updates.autoDownload')}</Label>
                  <p className="text-[13px] text-muted-foreground mt-1">
                    {t('updates.autoDownloadDesc')}
                  </p>
                </div>
                <Switch
                  checked={autoDownloadUpdate}
                  onCheckedChange={(value) => {
                    setAutoDownloadUpdate(value);
                    updateSetAutoDownload(value);
                  }}
                />
              </div>
            </div>
          </section>

          <Separator className="bg-black/5 dark:bg-white/5" />
            </div>
          )}

          {activeTab === 'about' && (
            <div className="space-y-12">
              <div>
            <h2 className="text-3xl font-serif text-foreground mb-6 font-normal tracking-tight" style={{ fontFamily: 'Georgia, Cambria, "Times New Roman", Times, serif' }}>
              {t('about.title')}
            </h2>
            <div className="space-y-3 text-[14px] text-muted-foreground">
              <p>
                <strong className="text-foreground font-semibold">{t('about.appName')}</strong> - {t('about.tagline')}
              </p>
              <p>{t('about.basedOn')}</p>
              <p>{t('about.version', { version: currentVersion })}</p>
              <div className="flex gap-4 pt-3">
                <Button
                  variant="link"
                  className="h-auto p-0 text-[14px] text-blue-500 hover:text-blue-600 font-medium"
                  onClick={() => window.electron.openExternal('https://github.com/NextAgentX/HermesClaw')}
                >
                  {t('about.docs')}
                </Button>
                <Button
                  variant="link"
                  className="h-auto p-0 text-[14px] text-blue-500 hover:text-blue-600 font-medium"
                  onClick={() => window.electron.openExternal('https://github.com/NextAgentX/HermesClaw')}
                >
                  {t('about.github')}
                </Button>
                <Button
                  variant="link"
                  className="h-auto p-0 text-[14px] text-blue-500 hover:text-blue-600 font-medium"
                  onClick={() => window.electron.openExternal('https://icnnp7d0dymg.feishu.cn/wiki/UyfOwQ2cAiJIP6kqUW8cte5Bnlc')}
                >
                  {t('about.faq')}
                </Button>
              </div>
            </div>
          </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
