import { useEffect, useMemo, useState } from "react"
import { Settings as SettingsIcon, Moon, Sun, Monitor, Save, Server, CheckCircle2, CircleAlert, Loader2, BrainCircuit, TimerReset, Layers3 } from "lucide-react"
import { useTheme } from "../components/theme-provider"
import { getApiBaseUrl } from "@/lib/api"
import { cn } from "@/lib/utils"
import { fetchAvailableModels, type ModelOption } from "@/lib/models"
import { getStoredSettings, saveStoredSettings } from "@/lib/preferences"

type ConnectionStatus = "idle" | "success" | "error" | "testing"

interface SystemInfo {
    appVersion: string
    opencodeInstalled: boolean
    modelCount: number
    error: string | null
}

export default function Settings() {
    const { theme, setTheme } = useTheme()
    const storedSettings = useMemo(() => getStoredSettings(), [])
    const [apiBaseUrl, setApiBaseUrl] = useState(storedSettings.apiBaseUrl)
    const [sdkUrl, setSdkUrl] = useState(storedSettings.sdkUrl)
    const [defaultModel, setDefaultModel] = useState(storedSettings.defaultModel)
    const [defaultBackend, setDefaultBackend] = useState(storedSettings.defaultBackend)
    const [defaultParallel, setDefaultParallel] = useState(storedSettings.defaultParallel)
    const [defaultTimeout, setDefaultTimeout] = useState(storedSettings.defaultTimeout)
    const [models, setModels] = useState<ModelOption[]>([])
    const [modelsLoading, setModelsLoading] = useState(true)
    const [modelsError, setModelsError] = useState<string | null>(null)
    const [saveMessage, setSaveMessage] = useState<string | null>(null)
    const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("idle")
    const [connectionMessage, setConnectionMessage] = useState<string | null>(null)
    const [savedApiBaseUrl, setSavedApiBaseUrl] = useState(() => getApiBaseUrl())
    const [systemInfo, setSystemInfo] = useState<SystemInfo>({
        appVersion: "-",
        opencodeInstalled: false,
        modelCount: 0,
        error: null,
    })
    const [systemLoading, setSystemLoading] = useState(true)

    useEffect(() => {
        const controller = new AbortController()

        async function loadModels() {
            setModelsLoading(true)
            setModelsError(null)

            try {
                const response = await fetchAvailableModels(controller.signal)
                const availableModels = response.models || []
                setModels(availableModels)

                if (response.error) {
                    setModelsError(response.error)
                }

                setDefaultModel((current) => {
                    if (current && availableModels.some((option) => option.id === current)) {
                        return current
                    }

                    return availableModels[0]?.id || ""
                })
            } catch (err: any) {
                if (err.name === "AbortError") {
                    return
                }

                setModels([])
                setModelsError(err.message || "Failed to load models")
            } finally {
                setModelsLoading(false)
            }
        }

        loadModels()
        return () => controller.abort()
    }, [savedApiBaseUrl])

    useEffect(() => {
        const controller = new AbortController()

        async function loadSystemInfo() {
            setSystemLoading(true)

            try {
                const [healthResponse, opencodeResponse] = await Promise.all([
                    fetch(`${savedApiBaseUrl}/api/health`, { signal: controller.signal }),
                    fetch(`${savedApiBaseUrl}/api/health/opencode`, { signal: controller.signal }),
                ])

                const healthPayload = await healthResponse.json().catch(() => ({}))
                const opencodePayload = await opencodeResponse.json().catch(() => ({}))

                setSystemInfo({
                    appVersion: typeof healthPayload.version === "string" ? healthPayload.version : "-",
                    opencodeInstalled: Boolean(opencodePayload.installed),
                    modelCount: Number(opencodePayload.model_count) || 0,
                    error: typeof opencodePayload.error === "string" ? opencodePayload.error : null,
                })
            } catch (err: any) {
                if (err.name === "AbortError") {
                    return
                }

                setSystemInfo({
                    appVersion: "-",
                    opencodeInstalled: false,
                    modelCount: 0,
                    error: err.message || "System info unavailable",
                })
            } finally {
                setSystemLoading(false)
            }
        }

        loadSystemInfo()
        return () => controller.abort()
    }, [savedApiBaseUrl])

    const handleSave = () => {
        const normalized = saveStoredSettings({
            apiBaseUrl,
            sdkUrl,
            defaultModel,
            defaultBackend,
            defaultParallel,
            defaultTimeout,
        })

        setApiBaseUrl(normalized.apiBaseUrl)
        setSdkUrl(normalized.sdkUrl)
        setDefaultModel(normalized.defaultModel)
        setDefaultBackend(normalized.defaultBackend)
        setDefaultParallel(normalized.defaultParallel)
        setDefaultTimeout(normalized.defaultTimeout)
        setSavedApiBaseUrl(normalized.apiBaseUrl)
        setSaveMessage("Settings saved locally.")
    }

    const handleTestConnection = async () => {
        setConnectionStatus("testing")
        setConnectionMessage(null)

        try {
            const normalizedBaseUrl = apiBaseUrl.trim().replace(/\/$/, "")
            const response = await fetch(`${normalizedBaseUrl}/api/health`)
            const payload = await response.json().catch(() => ({}))

            if (!response.ok) {
                throw new Error(payload.detail || "Healthcheck failed")
            }

            setConnectionStatus("success")
            setConnectionMessage(`Connected to version ${payload.version || "unknown"}`)
        } catch (err: any) {
            setConnectionStatus("error")
            setConnectionMessage(err.message || "Connection failed")
        }
    }

    return (
        <div className="space-y-6 animate-in fade-in zoom-in-95 duration-500 max-w-4xl mx-auto pb-12">
            <div className="flex flex-col gap-2 border-b pb-6">
                <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                    <SettingsIcon className="size-8" />
                    Settings
                </h1>
                <p className="text-muted-foreground">
                    Manage your application preferences and local connection details.
                </p>
            </div>

            <div className="grid gap-8">
                {/* Appearance Settings */}
                <div className="space-y-4">
                    <h3 className="text-xl font-semibold">Appearance</h3>
                    <p className="text-sm text-muted-foreground">Customize the local theme of the UI dashboard.</p>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <button
                            onClick={() => setTheme("light")}
                            className={cn(
                                "flex flex-col items-center gap-3 p-4 border-2 rounded-xl bg-card hover:bg-muted/50 transition-colors ring-offset-background focus-visible:outline-none focus-visible:ring-2 disabled:opacity-50",
                                theme === "light" ? "border-primary" : "border-border"
                            )}
                        >
                            <div className="size-24 rounded-md bg-muted/50 border flex items-center justify-center p-2 w-full">
                                <div className="w-full h-full bg-white rounded shadow-sm flex flex-col gap-2 p-2">
                                    <div className="w-full h-2 bg-slate-200 rounded" />
                                    <div className="w-3/4 h-2 bg-slate-200 rounded" />
                                </div>
                            </div>
                            <div className="flex items-center gap-2 font-medium">
                                <Sun className="size-4 text-foreground" /> Light
                            </div>
                        </button>

                        <button
                            onClick={() => setTheme("dark")}
                            className={cn(
                                "flex flex-col items-center gap-3 p-4 border-2 rounded-xl bg-card hover:bg-muted/50 transition-colors ring-offset-background focus-visible:outline-none focus-visible:ring-2 disabled:opacity-50",
                                theme === "dark" ? "border-primary" : "border-border"
                            )}
                        >
                            <div className="size-24 rounded-md bg-slate-950 border border-slate-800 flex items-center justify-center p-2 w-full">
                                <div className="w-full h-full bg-slate-900 border border-slate-800 rounded shadow-sm flex flex-col gap-2 p-2">
                                    <div className="w-full h-2 bg-slate-800 rounded" />
                                    <div className="w-3/4 h-2 bg-slate-800 rounded" />
                                </div>
                            </div>
                            <div className="flex items-center gap-2 font-medium">
                                <Moon className="size-4 text-foreground" /> Dark
                            </div>
                        </button>

                        <button
                            onClick={() => setTheme("system")}
                            className={cn(
                                "flex flex-col items-center gap-3 p-4 border-2 rounded-xl bg-card hover:bg-muted/50 transition-colors ring-offset-background focus-visible:outline-none focus-visible:ring-2 disabled:opacity-50",
                                theme === "system" ? "border-primary" : "border-border"
                            )}
                        >
                            <div className="size-24 rounded-md bg-gradient-to-br from-white to-slate-950 border flex items-center justify-center p-2 w-full overflow-hidden relative">
                                <div className="absolute inset-x-2 top-2 h-1/2 bg-white rounded-t shadow border-x border-t" />
                                <div className="absolute inset-x-2 bottom-2 h-1/2 bg-slate-950 rounded-b shadow border-x border-b border-slate-800" />
                            </div>
                            <div className="flex items-center gap-2 font-medium">
                                <Monitor className="size-4 text-foreground" /> System
                            </div>
                        </button>
                    </div>
                </div>

                <hr className="border-border" />

                <div className="space-y-4">
                    <div>
                        <h3 className="text-xl font-semibold">Default Scan Configuration</h3>
                        <p className="text-sm text-muted-foreground">Set the defaults used by the launch form.</p>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2 rounded-xl border bg-card p-4">
                            <label className="text-sm font-medium flex items-center gap-2">
                                <BrainCircuit className="size-4 text-primary" />
                                Default Model
                            </label>
                            <select
                                value={defaultModel}
                                onChange={(event) => setDefaultModel(event.target.value)}
                                disabled={modelsLoading || models.length === 0}
                                className="w-full bg-background border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                            >
                                {modelsLoading && <option value="">Loading available models...</option>}
                                {!modelsLoading && models.length === 0 && <option value="">No models available</option>}
                                {!modelsLoading && models.map((option) => (
                                    <option key={option.id} value={option.id}>{option.name}</option>
                                ))}
                            </select>
                            {modelsError && <p className="text-xs text-yellow-500">{modelsError}</p>}
                        </div>

                        <div className="space-y-2 rounded-xl border bg-card p-4">
                            <label className="text-sm font-medium flex items-center gap-2">
                                <Layers3 className="size-4 text-primary" />
                                Default Backend
                            </label>
                            <select
                                value={defaultBackend}
                                onChange={(event) => setDefaultBackend(event.target.value as "cli" | "sdk")}
                                className="w-full bg-background border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                            >
                                <option value="cli">CLI</option>
                                <option value="sdk">SDK</option>
                            </select>
                        </div>

                        <div className="space-y-2 rounded-xl border bg-card p-4">
                            <label className="text-sm font-medium">Default Parallel Agents</label>
                            <input
                                type="range"
                                min="1"
                                max="4"
                                value={defaultParallel}
                                onChange={(event) => setDefaultParallel(Number.parseInt(event.target.value, 10) || 1)}
                                className="w-full accent-primary"
                            />
                            <div className="text-sm text-muted-foreground">{defaultParallel} agents</div>
                        </div>

                        <div className="space-y-2 rounded-xl border bg-card p-4">
                            <label className="text-sm font-medium flex items-center gap-2">
                                <TimerReset className="size-4 text-primary" />
                                OpenCode Timeout
                            </label>
                            <input
                                type="number"
                                min="1"
                                value={defaultTimeout}
                                onChange={(event) => setDefaultTimeout(Math.max(1, Number.parseInt(event.target.value, 10) || 1))}
                                className="w-full bg-background border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                            />
                            <p className="text-xs text-muted-foreground">Timeout in seconds for each agent execution.</p>
                        </div>
                    </div>
                </div>

                <hr className="border-border" />

                {/* API Settings */}
                <div className="space-y-4">
                    <h3 className="text-xl font-semibold">Backend Connection</h3>
                    <p className="text-sm text-muted-foreground">Edit the backend endpoints used by the dashboard.</p>

                    <div className="max-w-xl space-y-4">
                        <div className="flex flex-col gap-2">
                            <label className="text-sm font-medium">API Base URL</label>
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <Server className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                                    <input
                                        className="w-full bg-background border rounded-md pl-9 pr-4 py-2 text-sm"
                                        value={apiBaseUrl}
                                        onChange={(event) => setApiBaseUrl(event.target.value)}
                                    />
                                </div>
                                <button
                                    onClick={handleTestConnection}
                                    className="border bg-background hover:bg-muted px-4 py-2 rounded-md font-medium text-sm flex items-center gap-2 disabled:opacity-50"
                                    disabled={connectionStatus === "testing"}
                                >
                                    {connectionStatus === "testing" ? <Loader2 className="size-4 animate-spin" /> : <Server className="size-4" />}
                                    Test Connection
                                </button>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">This value is stored in localStorage and overrides the default frontend API config.</p>
                        </div>

                        <div className="flex flex-col gap-2">
                            <label className="text-sm font-medium">SDK URL (optional)</label>
                            <input
                                className="w-full bg-background border rounded-md px-4 py-2 text-sm"
                                value={sdkUrl}
                                onChange={(event) => setSdkUrl(event.target.value)}
                                placeholder="http://localhost:54321"
                            />
                            <p className="text-xs text-muted-foreground">Used as the default remote endpoint when the SDK backend is selected.</p>
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                            <button
                                onClick={handleSave}
                                className="bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-md font-medium text-sm flex items-center gap-2"
                            >
                                <Save className="size-4" /> Save Settings
                            </button>

                            {saveMessage && (
                                <span className="text-sm text-green-500">{saveMessage}</span>
                            )}

                            {connectionMessage && (
                                <span className={cn(
                                    "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium",
                                    connectionStatus === "success"
                                        ? "border-green-500/20 bg-green-500/10 text-green-500"
                                        : connectionStatus === "error"
                                            ? "border-destructive/20 bg-destructive/10 text-destructive"
                                            : "border-border bg-muted text-muted-foreground"
                                )}>
                                    {connectionStatus === "success" ? <CheckCircle2 className="size-3.5" /> : <CircleAlert className="size-3.5" />}
                                    {connectionMessage}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                <hr className="border-border" />

                <div className="space-y-4">
                    <h3 className="text-xl font-semibold">System Info</h3>
                    <p className="text-sm text-muted-foreground">Read-only information gathered from the active backend.</p>

                    <div className="grid gap-4 md:grid-cols-3">
                        <div className="rounded-xl border bg-card p-4 space-y-2">
                            <div className="text-sm text-muted-foreground">OpenCode Status</div>
                            {systemLoading ? (
                                <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Checking...</div>
                            ) : (
                                <div className={cn(
                                    "inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium",
                                    systemInfo.opencodeInstalled ? "bg-green-500/10 text-green-500" : "bg-destructive/10 text-destructive"
                                )}>
                                    {systemInfo.opencodeInstalled ? <CheckCircle2 className="size-4" /> : <CircleAlert className="size-4" />}
                                    {systemInfo.opencodeInstalled ? "Installed" : "Not Found"}
                                </div>
                            )}
                        </div>

                        <div className="rounded-xl border bg-card p-4 space-y-2">
                            <div className="text-sm text-muted-foreground">Available Models</div>
                            <div className="text-2xl font-semibold">{systemLoading ? "-" : systemInfo.modelCount}</div>
                        </div>

                        <div className="rounded-xl border bg-card p-4 space-y-2">
                            <div className="text-sm text-muted-foreground">App Version</div>
                            <div className="text-2xl font-semibold">{systemLoading ? "-" : systemInfo.appVersion}</div>
                        </div>
                    </div>

                    {systemInfo.error && !systemLoading && (
                        <div className="rounded-md border border-yellow-500/20 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-500">
                            {systemInfo.error}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
