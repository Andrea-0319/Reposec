import { useEffect, useState } from "react"
import { Shield, ShieldAlert, ShieldCheck, Terminal, AlertCircle, Trash2 } from "lucide-react"
import { Link } from "react-router-dom"
import { cn } from "@/lib/utils"

interface Project {
    id: number
    name: string
    repo_path: string
    created_at: string
    last_scan_id: number | null
    last_scan_date: string | null
    last_scan_status: string | null
    total_findings: number | null
    critical: number | null
    high: number | null
    medium: number | null
    low: number | null
}

export default function Dashboard() {
    const [projects, setProjects] = useState<Project[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        async function fetchProjects() {
            try {
                const response = await fetch("http://localhost:8000/api/projects")
                if (!response.ok) {
                    throw new Error("Failed to fetch projects")
                }
                const data = await response.json()
                setProjects(data)
            } catch (err: any) {
                setError(err.message)
            } finally {
                setLoading(false)
            }
        }

        fetchProjects()
    }, [])

    function formatDate(dateString: string | null) {
        if (!dateString) return "Never"
        return new Intl.DateTimeFormat("en-US", {
            dateStyle: "medium",
            timeStyle: "short",
        }).format(new Date(dateString))
    }

    function getStatusIcon(status: string | null) {
        if (status === "completed") return <ShieldCheck className="size-5 text-green-500" />
        if (status === "failed") return <ShieldAlert className="size-5 text-red-500" />
        if (status === "running") return <Shield className="size-5 text-blue-500 animate-pulse" />
        return <AlertCircle className="size-5 text-muted-foreground" />
    }

    const handleDeleteProject = async (e: React.MouseEvent, projectId: number) => {
        e.preventDefault()
        e.stopPropagation()
        if (!confirm("Are you sure you want to delete this project? This will also permanently delete all its scans and findings.")) return;

        try {
            const res = await fetch(`http://localhost:8000/api/projects/${projectId}`, {
                method: "DELETE"
            });
            if (res.ok) {
                setProjects(prev => prev.filter(p => p.id !== projectId));
            } else {
                const data = await res.json();
                alert(data.detail || "Failed to delete project");
            }
        } catch (err) {
            console.error(err);
            alert("Error deleting project");
        }
    }

    return (
        <div className="space-y-6 animate-in fade-in zoom-in-95 duration-500 max-w-7xl mx-auto">
            <div className="flex flex-col gap-2 relative border-b pb-6">
                <h1 className="text-3xl font-bold tracking-tight">Dashboard overview</h1>
                <p className="text-muted-foreground max-w-2xl">
                    View analyzed repositories and critical vulnerabilities overview from the SQLite DB.
                </p>
            </div>

            {error && (
                <div className="rounded-lg bg-destructive/15 text-destructive p-4 flex gap-3 items-center">
                    <AlertCircle className="size-5" />
                    <p className="font-medium text-sm">{error}</p>
                </div>
            )}

            {loading ? (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="h-48 rounded-xl border bg-muted/20 animate-pulse" />
                    ))}
                </div>
            ) : projects.length === 0 && !error ? (
                <div className="rounded-xl border border-dashed p-12 text-center flex flex-col items-center">
                    <Terminal className="size-10 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold">No projects found</h3>
                    <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                        Start a scan to populate this dashboard using the launch tab or CLI.
                    </p>
                </div>
            ) : (
                <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                    {projects.map((project) => (
                        <Link
                            key={project.id}
                            to={`/project/${project.id}`}
                            className="group rounded-xl border bg-card text-card-foreground shadow-sm transition-all hover:shadow-md hover:border-primary/30 flex flex-col relative overflow-hidden"
                        >
                            <div className="p-6 flex items-start justify-between">
                                <div>
                                    <h3 className="font-semibold text-lg truncate w-[200px]" title={project.name}>
                                        {project.name}
                                    </h3>
                                    <p className="text-xs text-muted-foreground mt-1 truncate w-[200px]" title={project.repo_path}>
                                        {project.repo_path}
                                    </p>
                                </div>
                                <div className="flex items-start gap-2">
                                    <div title={`Status: ${project.last_scan_status}`}>
                                        {getStatusIcon(project.last_scan_status)}
                                    </div>
                                    <button
                                        onClick={(e) => handleDeleteProject(e, project.id)}
                                        className="text-destructive hover:bg-destructive/10 p-1 rounded-md transition-colors opacity-0 group-hover:opacity-100"
                                        title="Delete Project"
                                    >
                                        <Trash2 className="size-4" />
                                    </button>
                                </div>
                            </div>

                            <div className="px-6 py-2 mt-auto">
                                <div className="flex items-end gap-2">
                                    <span className={cn("text-4xl font-bold tracking-tighter",
                                        (project.critical ?? 0) > 0 ? "text-destructive" :
                                            (project.high ?? 0) > 0 ? "text-orange-500 dark:text-orange-400" :
                                                "text-foreground"
                                    )}>
                                        {project.total_findings ?? 0}
                                    </span>
                                    <span className="text-sm text-muted-foreground font-medium mb-1">
                                        total
                                    </span>
                                </div>
                                <div className="flex gap-2 text-[11px] mt-4 mb-2">
                                    <span className="bg-destructive/10 text-destructive px-2 py-1 rounded font-semibold border border-destructive/20">
                                        {project.critical ?? 0} Critical
                                    </span>
                                    <span className="bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20 px-2 py-1 rounded font-semibold">
                                        {project.high ?? 0} High
                                    </span>
                                    <span className="bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border border-yellow-500/20 px-2 py-1 rounded font-semibold">
                                        {project.medium ?? 0} Medium
                                    </span>
                                </div>
                            </div>
                            <div className="bg-muted/40 px-6 py-3 mt-4 text-xs text-muted-foreground border-t flex items-center justify-between group-hover:bg-primary/5 transition-colors">
                                <span className="font-medium">Last Scan</span>
                                <span>{formatDate(project.last_scan_date)}</span>
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    )
}
