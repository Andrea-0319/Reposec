import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import {
    Play,
    Rocket,
    AlertCircle,
    Loader2,
    ShieldAlert,
    FolderOpen,
    GitBranch,
    Globe,
    ChevronDown,
} from "lucide-react"
import { apiUrl } from "@/lib/api"
import { fetchAvailableModels, type ModelOption } from "@/lib/models"
import { getStoredSettings } from "@/lib/preferences"

// --- Types ---
type SourceType = "local" | "git"

interface BranchResponse {
    branches: string[]
    default_branch: string | null
    error: string | null
}

export default function LaunchScan() {
    const navigate = useNavigate()
    const [searchParams] = useSearchParams()
    const storedSettings = useMemo(() => getStoredSettings(), [])

    // Source type toggle (local path vs git URL)
    const [sourceType, setSourceType] = useState<SourceType>("local")

    // Common form state
    const [repoPath, setRepoPath] = useState(searchParams.get("repo") || "")
    const [model, setModel] = useState(storedSettings.defaultModel)
    const [backend, setBackend] = useState(storedSettings.defaultBackend)
    const [parallel, setParallel] = useState(storedSettings.defaultParallel)
    const [timeout, setTimeout] = useState(storedSettings.defaultTimeout)
    const [sdkUrl, setSdkUrl] = useState(storedSettings.sdkUrl)
    const [models, setModels] = useState<ModelOption[]>([])
    const [modelsLoading, setModelsLoading] = useState(true)
    const [modelsError, setModelsError] = useState<string | null>(null)

    // Git-specific branch state
    const [branch, setBranch] = useState("")
    const [branches, setBranches] = useState<string[]>([])
    const [defaultBranch, setDefaultBranch] = useState("")
    const [branchesLoading, setBranchesLoading] = useState(false)
    const [branchesError, setBranchesError] = useState<string | null>(null)

    // Submission state
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Debounce timer ref for branch fetching
    const branchTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null)

    // --- Load available models on mount ---
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
                if (err.name === "AbortError") return
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

    // --- Debounced branch discovery when Git URL changes ---
    const fetchBranches = useCallback(async (url: string) => {
        // Basic client-side check before calling API
        if (!url.trim() || (!url.startsWith("http") && !url.startsWith("git@"))) {
            setBranches([])
            setDefaultBranch("")
            setBranch("")
            setBranchesError(null)
            return
        }

        setBranchesLoading(true)
        setBranchesError(null)

        try {
            const res = await fetch(apiUrl("/api/git/branches"), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ url: url.trim() }),
            })

            const data: BranchResponse = await res.json()

            if (!res.ok) {
                throw new Error((data as any).detail || "Failed to fetch branches")
            }

            if (data.error) {
                setBranchesError(data.error)
                // Still allow manual input as fallback
                setBranches([])
                setDefaultBranch("")
                return
            }

            setBranches(data.branches)
            setDefaultBranch(data.default_branch || "")
            // Pre-select the default branch
            setBranch(data.default_branch || data.branches[0] || "")
        } catch (err: any) {
            setBranchesError(err.message || "Could not discover branches")
            setBranches([])
            setDefaultBranch("")
        } finally {
            setBranchesLoading(false)
        }
    }, [])

    // Trigger debounced branch fetch when repoPath changes in git mode
    useEffect(() => {
        if (sourceType !== "git") return

        // Clear previous timer
        if (branchTimerRef.current) {
            clearTimeout(branchTimerRef.current)
        }

        // Reset state immediately when input changes
        setBranches([])
        setDefaultBranch("")
        setBranch("")
        setBranchesError(null)

        // Debounce 500ms
        branchTimerRef.current = window.setTimeout(() => {
            fetchBranches(repoPath)
        }, 500)

        return () => {
            if (branchTimerRef.current) {
                clearTimeout(branchTimerRef.current)
            }
        }
    }, [repoPath, sourceType, fetchBranches])

    // --- Launch scan ---
    const handleLaunch = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!repoPath.trim()) {
            setError(sourceType === "git" ? "Git URL cannot be empty." : "Repository path cannot be empty.")
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
                    parallel: parallel,
                    branch: sourceType === "git" && branch ? branch : undefined,
                }),
            })

            const data = await res.json()

            if (!res.ok) {
                throw new Error(data.detail || "Failed to launch scan")
            }

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
                    Start a new security scan on a local repository or a remote Git repository.
                </p>
            </div>

            {error && (
                <div className="bg-destructive/15 text-destructive p-4 rounded-md flex items-center gap-3 border border-destructive/20">
                    <AlertCircle className="size-5" />
                    <span className="font-semibold text-sm">{error}</span>
                </div>
            )}

            <form onSubmit={handleLaunch} className="space-y-6 bg-card p-6 rounded-xl border shadow-sm">

                {/* Source Type Toggle */}
                <div className="space-y-2">
                    <label className="text-sm font-medium">Source Type</label>
                    <div className="flex rounded-lg border overflow-hidden">
                        <button
                            type="button"
                            onClick={() => { setSourceType("local"); setRepoPath(""); setError(null) }}
                            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors ${
                                sourceType === "local"
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-background text-muted-foreground hover:bg-muted/50"
                            }`}
                        >
                            <FolderOpen className="size-4" />
                            Local Path
                        </button>
                        <button
                            type="button"
                            onClick={() => { setSourceType("git"); setRepoPath(""); setError(null) }}
                            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors ${
                                sourceType === "git"
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-background text-muted-foreground hover:bg-muted/50"
                            }`}
                        >
                            <Globe className="size-4" />
                            Git Repository
                        </button>
                    </div>
                </div>

                {/* Input field — adapts to source type */}
                <div className="space-y-2">
                    <label className="text-sm font-medium">
                        {sourceType === "local" ? "Repository Local Path" : "Git Repository URL"}{" "}
                        <span className="text-destructive">*</span>
                    </label>
                    <input
                        type="text"
                        value={repoPath}
                        onChange={(e) => setRepoPath(e.target.value)}
                        placeholder={
                            sourceType === "local"
                                ? "e.g. C:\\Projects\\MyWebApp"
                                : "e.g. https://github.com/owner/repo"
                        }
                        className="w-full bg-background border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                        required
                    />
                    <p className="text-xs text-muted-foreground">
                        {sourceType === "local"
                            ? "Absolute path to the directory you want to analyze."
                            : "HTTPS or SSH URL of the repository to clone and analyze."}
                    </p>
                </div>

                {/* Branch selector — only visible in git mode */}
                {sourceType === "git" && (
                    <div className="space-y-2">
                        <label className="text-sm font-medium flex items-center gap-1.5">
                            <GitBranch className="size-4" />
                            Branch
                        </label>

                        {branchesLoading && (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                                <Loader2 className="size-3.5 animate-spin" />
                                Discovering branches…
                            </div>
                        )}

                        {!branchesLoading && branches.length > 0 && (
                            <div className="relative">
                                <select
                                    value={branch}
                                    onChange={(e) => setBranch(e.target.value)}
                                    className="w-full bg-background border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 appearance-none pr-8"
                                >
                                    {branches.map((b) => (
                                        <option key={b} value={b}>
                                            {b}{b === defaultBranch ? " (default)" : ""}
                                        </option>
                                    ))}
                                </select>
                                <ChevronDown className="size-4 absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                            </div>
                        )}

                        {/* Fallback: manual text input when branches can't be loaded */}
                        {!branchesLoading && branches.length === 0 && repoPath.trim() && !branchesError && (
                            <input
                                type="text"
                                value={branch}
                                onChange={(e) => setBranch(e.target.value)}
                                placeholder="e.g. main"
                                className="w-full bg-background border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                            />
                        )}

                        {branchesError && (
                            <div className="space-y-2">
                                <div className="rounded-md border border-yellow-500/20 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-500 flex items-start gap-2">
                                    <AlertCircle className="size-3.5 shrink-0 mt-0.5" />
                                    <span>{branchesError} — you can type a branch name manually below.</span>
                                </div>
                                <input
                                    type="text"
                                    value={branch}
                                    onChange={(e) => setBranch(e.target.value)}
                                    placeholder="e.g. main"
                                    className="w-full bg-background border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                                />
                            </div>
                        )}

                        <p className="text-xs text-muted-foreground">
                            Leave empty to use the repository's default branch.
                        </p>
                    </div>
                )}

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
