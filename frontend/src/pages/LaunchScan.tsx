import { useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { Play, Rocket, AlertCircle, Loader2 } from "lucide-react"

export default function LaunchScan() {
    const navigate = useNavigate()
    const [searchParams] = useSearchParams()

    // Initializing state, using query params if navigating from another page (like Project Details)
    const [repoPath, setRepoPath] = useState(searchParams.get("repo") || "")
    const [model, setModel] = useState("opencode/minimax-m2.5-free")
    const [backend, setBackend] = useState("cli")
    const [parallel, setParallel] = useState(1)

    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const handleLaunch = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!repoPath.trim()) {
            setError("Repository path cannot be empty.")
            return
        }

        setLoading(true)
        setError(null)

        try {
            const res = await fetch("http://localhost:8000/api/scans/launch", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    repo_path: repoPath.trim(),
                    model: model.trim() || undefined,
                    backend: backend.trim() || undefined,
                    parallel: parallel
                })
            })

            const data = await res.json()

            if (!res.ok) {
                throw new Error(data.detail || "Failed to launch scan")
            }

            // Successfully started, navigate to the Dashboard or directly to the All Scans page
            navigate("/scans")
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
                        className="w-full bg-background border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                    >
                        <option value="opencode/minimax-m2.5-free">Minimax m2.5 Free</option>
                        <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                        <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                        <option value="gpt-4o">GPT-4o</option>
                        <option value="claude-3.5-sonnet">Claude 3.5 Sonnet</option>
                    </select>
                </div>

                {/* Backend Selection */}
                <div className="space-y-2">
                    <label className="text-sm font-medium">Backend System</label>
                    <select
                        value={backend}
                        onChange={(e) => setBackend(e.target.value)}
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
                        onChange={(e) => setParallel(parseInt(e.target.value))}
                        className="w-full bg-background border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                    <p className="text-xs text-muted-foreground">
                        Number of concurrent agents to run the analysis (1 to 4).
                    </p>
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
