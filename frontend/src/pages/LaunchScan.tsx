import { useEffect, useMemo, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { Play, Rocket, AlertCircle, Loader2, ShieldAlert } from "lucide-react"
import { apiUrl } from "@/lib/api"
import { fetchAvailableModels, type ModelOption } from "@/lib/models"
import { getStoredSettings } from "@/lib/preferences"

export default function LaunchScan() {
    const navigate = useNavigate()
    const [searchParams] = useSearchParams()
    const storedSettings = useMemo(() => getStoredSettings(), [])

    // Initializing state, using query params if navigating from another page (like Project Details)
    const [repoPath, setRepoPath] = useState(searchParams.get("repo") || "")
    const [model, setModel] = useState(storedSettings.defaultModel)
    const [backend, setBackend] = useState(storedSettings.defaultBackend)
    const [parallel, setParallel] = useState(storedSettings.defaultParallel)
    const [timeout, setTimeout] = useState(storedSettings.defaultTimeout)
    const [sdkUrl, setSdkUrl] = useState(storedSettings.sdkUrl)
    const [models, setModels] = useState<ModelOption[]>([])
    const [modelsLoading, setModelsLoading] = useState(true)
    const [modelsError, setModelsError] = useState<string | null>(null)

    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

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

                setModel((current) => {
                    if (current && availableModels.some((entry) => entry.id === current)) {
                        return current
                    }

                    return availableModels[0]?.id || ""
                })
            } catch (err: any) {
                if (err.name === "AbortError") {
                    return
                }

                setModels([])
                setModel("")
                setModelsError(err.message || "Failed to load models")
            } finally {
                setModelsLoading(false)
            }
        }

        loadModels()
        return () => controller.abort()
    }, [])

    const handleLaunch = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!repoPath.trim()) {
            setError("Repository path cannot be empty.")
            return
        }

        setLoading(true)
        setError(null)

        try {
            const res = await fetch(apiUrl("/api/scans/launch"), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    repo_path: repoPath.trim().replace(/^["']+|["']+$/g, ""),
                    model: model.trim() || undefined,
                    backend: backend.trim() || undefined,
                    sdk_url: backend === "sdk" ? sdkUrl.trim() || undefined : undefined,
                    timeout: timeout,
                    parallel: parallel
                })
            })

            const data = await res.json()

            if (!res.ok) {
                throw new Error(data.detail || "Failed to launch scan")
            }

            // Successfully started, navigate directly to the live scan report view
            navigate(`/scan/${data.scan_id}`)
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="space-y-6 animate-in fade-in zoom-in-95 duration-500 max-w-2xl mx-auto pb-12">
            <div className="flex flex-col gap-2 border-b pb-6">
                <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                    <Rocket className="size-8 text-primary" />
                    Launch Security Scan
                </h1>
                <p className="text-muted-foreground">
                    Start a new security scan on a local repository. The process will run asynchronously.
                </p>
            </div>

            {error && (
                <div className="bg-destructive/15 text-destructive p-4 rounded-md flex items-center gap-3 border border-destructive/20">
                    <AlertCircle className="size-5" />
                    <span className="font-semibold text-sm">{error}</span>
                </div>
            )}

            <form onSubmit={handleLaunch} className="space-y-6 bg-card p-6 rounded-xl border shadow-sm">

                {/* Repository Path */}
                <div className="space-y-2">
                    <label className="text-sm font-medium">Repository Local Path <span className="text-destructive">*</span></label>
                    <input
                        type="text"
                        value={repoPath}
                        onChange={(e) => setRepoPath(e.target.value)}
                        placeholder="e.g. C:\Projects\MyWebApp"
                        className="w-full bg-background border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                        required
                    />
                    <p className="text-xs text-muted-foreground">
                        Absolute path to the directory you want to analyze.
                    </p>
                </div>

                {/* Model Selection */}
                <div className="space-y-2">
                    <label className="text-sm font-medium">Model</label>
                    <select
                        value={model}
                        onChange={(e) => setModel(e.target.value)}
                        disabled={modelsLoading || models.length === 0}
                        className="w-full bg-background border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                    >
                        {modelsLoading && <option value="">Loading available models...</option>}
                        {!modelsLoading && models.length === 0 && <option value="">No models available</option>}
                        {!modelsLoading && models.map((option) => (
                            <option key={option.id} value={option.id}>{option.name}</option>
                        ))}
                    </select>
                    {modelsLoading && (
                        <p className="text-xs text-muted-foreground flex items-center gap-2">
                            <Loader2 className="size-3.5 animate-spin" />
                            Discovering local OpenCode models.
                        </p>
                    )}
                    {modelsError && (
                        <p className="text-xs text-yellow-500">{modelsError}</p>
                    )}
                </div>

                {/* Backend Selection */}
                <div className="space-y-2">
                    <label className="text-sm font-medium">Backend System</label>
                    <select
                        value={backend}
                        onChange={(e) => setBackend(e.target.value as "cli" | "sdk")}
                        className="w-full bg-background border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                    >
                        <option value="cli">CLI (Subprocess)</option>
                        <option value="sdk">Python SDK</option>
                    </select>
                </div>

                {/* Parallel Agents */}
                <div className="space-y-2">
                    <label className="text-sm font-medium">Parallel Agents</label>
                    <input
                        type="number"
                        min="1"
                        max="4"
                        value={parallel}
                        onChange={(e) => setParallel(Math.min(4, Math.max(1, Number.parseInt(e.target.value, 10) || 1)))}
                        className="w-full bg-background border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                    <p className="text-xs text-muted-foreground">
                        Number of concurrent agents to run the analysis (1 to 4).
                    </p>
                    {parallel > 2 && (
                        <div className="rounded-md border border-yellow-500/20 bg-yellow-500/10 px-3 py-2 text-sm text-yellow-500 flex items-start gap-2">
                            <ShieldAlert className="size-4 shrink-0 mt-0.5" />
                            <span>Running &gt;2 parallel agents increases resource usage. Ensure OpenCode supports concurrent sessions.</span>
                        </div>
                    )}
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-2">
                        <label className="text-sm font-medium">OpenCode Timeout (seconds)</label>
                        <input
                            type="number"
                            min="1"
                            value={timeout}
                            onChange={(e) => setTimeout(Math.max(1, Number.parseInt(e.target.value, 10) || 1))}
                            className="w-full bg-background border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium">SDK URL (optional)</label>
                        <input
                            type="url"
                            value={sdkUrl}
                            onChange={(e) => setSdkUrl(e.target.value)}
                            placeholder="e.g. http://localhost:54321"
                            className="w-full bg-background border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                        />
                        <p className="text-xs text-muted-foreground">
                            Used only when the SDK backend is selected.
                        </p>
                    </div>
                </div>

                {/* Submit Action */}
                <div className="pt-4 border-t">
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-2.5 rounded-md font-semibold transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="size-5 animate-spin" />
                                Launching...
                            </>
                        ) : (
                            <>
                                <Play className="size-5" />
                                Launch Scan
                            </>
                        )}
                    </button>
                </div>
            </form>
        </div>
    )
}
