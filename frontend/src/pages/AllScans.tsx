import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { History, Search, Filter, ShieldCheck, ShieldAlert, Terminal, FileCode2, Trash2, GitCompareArrows } from "lucide-react"
import { apiUrl } from "@/lib/api"

interface Project {
    id: number
    name: string
    repo_path: string
    last_scan_id: number | null
    last_scan_date: string | null
    last_scan_status: string | null
    total_findings: number | null
    critical: number | null
    high: number | null
    medium: number | null
    low: number | null
}

export default function AllScans() {
    const [projects, setProjects] = useState<Project[]>([])
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState("")
    const [statusFilter, setStatusFilter] = useState("all")

    useEffect(() => {
        async function fetchData() {
            try {
                const res = await fetch(apiUrl("/api/projects"))
                if (res.ok) {
                    const data: Project[] = await res.json()
                    // Sort by latest scan first
                    data.sort((a, b) => {
                        const dateA = a.last_scan_date ? new Date(a.last_scan_date).getTime() : 0;
                        const dateB = b.last_scan_date ? new Date(b.last_scan_date).getTime() : 0;
                        return dateB - dateA;
                    });
                    setProjects(data)
                }
            } catch (e) {
                console.error("Fetch all scans error", e)
            } finally {
                setLoading(false)
            }
        }
        fetchData()
    }, [])

    const scans = projects
        .filter(p => p.last_scan_id !== null)
        .filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.repo_path.toLowerCase().includes(searchQuery.toLowerCase()))
        .filter(p => statusFilter === "all" ? true : p.last_scan_status === statusFilter)

    const handleDelete = async (scanId: number) => {
        if (!confirm("Are you sure you want to delete this scan? This action cannot be undone.")) return;

        try {
            const res = await fetch(apiUrl(`/api/scans/${scanId}`), {
                method: "DELETE"
            });

            if (res.ok) {
                // Remove the scan from the UI temporarily or trigger a refetch
                setProjects(prev => prev.filter(p => p.last_scan_id !== scanId));
            } else {
                const data = await res.json();
                alert(data.detail || "Failed to delete scan");
            }
        } catch (e) {
            console.error(e);
            alert("Error deleting scan");
        }
    }

    return (
        <div className="space-y-6 animate-in fade-in zoom-in-95 duration-500 max-w-7xl mx-auto pb-12">
            <div className="flex flex-col gap-2 border-b pb-6">
                <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                    <History className="size-8" />
                    Recent Scans
                </h1>
                <p className="text-muted-foreground">
                    Historical overview of the latest scans across all monitored projects.
                </p>
            </div>

            <div className="flex items-center justify-between gap-4 mt-8 mb-4">
                <div className="relative w-full max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="Search projects..."
                        className="w-full bg-background border rounded-md pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <div className="relative border rounded-md bg-card focus-within:ring-2 focus-within:ring-primary/50 flex">
                    <Filter className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <select
                        className="appearance-none bg-transparent hover:bg-muted py-2 pl-9 pr-8 text-sm font-medium focus:outline-none cursor-pointer rounded-md"
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                    >
                        <option value="all">All Statuses</option>
                        <option value="completed">Completed</option>
                        <option value="failed">Failed</option>
                        <option value="running">Running</option>
                    </select>
                </div>
            </div>

            <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-muted-foreground bg-muted/50 uppercase border-b">
                            <tr>
                                <th className="px-6 py-4 font-medium">Project</th>
                                <th className="px-6 py-4 font-medium">Last Scan Date</th>
                                <th className="px-6 py-4 font-medium">Status</th>
                                <th className="px-6 py-4 font-medium text-center">Vulnerabilities (C/H/M/L)</th>
                                <th className="px-6 py-4 font-medium text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y relative">
                            {loading && (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                                        Loading...
                                    </td>
                                </tr>
                            )}
                            {!loading && scans.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                                        No recent scans found. Start by scanning a project.
                                    </td>
                                </tr>
                            )}
                            {!loading && scans.map(s => (
                                <tr key={s.id} className="hover:bg-muted/30 transition-colors group">
                                    <td className="px-6 py-4">
                                        <div className="font-semibold text-base">{s.name}</div>
                                        <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                            <FileCode2 className="size-3" />
                                            <span className="truncate max-w-[200px]" title={s.repo_path}>{s.repo_path}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 font-medium text-muted-foreground">
                                        {s.last_scan_date ? new Date(s.last_scan_date).toLocaleString() : "Unknown"}
                                    </td>
                                    <td className="px-6 py-4">
                                        {s.last_scan_status === "completed" ? (
                                            <span className="inline-flex items-center gap-1.5 text-green-500 bg-green-500/10 px-2.5 py-1 rounded-full text-xs font-semibold">
                                                <ShieldCheck className="size-3.5" /> Completed
                                            </span>
                                        ) : s.last_scan_status === "failed" ? (
                                            <span className="inline-flex items-center gap-1.5 text-red-500 bg-red-500/10 px-2.5 py-1 rounded-full text-xs font-semibold">
                                                <ShieldAlert className="size-3.5" /> Failed
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1.5 text-blue-500 bg-blue-500/10 px-2.5 py-1 rounded-full text-xs font-semibold">
                                                <Terminal className="size-3.5" /> Running
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center justify-center gap-2 font-medium">
                                            <span className="inline-flex w-9 items-center justify-center gap-1 text-destructive">
                                                <span className="size-1.5 rounded-full bg-destructive" />
                                                <span>{s.critical}</span>
                                            </span>
                                            <span className="inline-flex w-9 items-center justify-center gap-1 text-orange-500">
                                                <span className="size-1.5 rounded-full bg-orange-500" />
                                                <span>{s.high}</span>
                                            </span>
                                            <span className="inline-flex w-9 items-center justify-center gap-1 text-yellow-600">
                                                <span className="size-1.5 rounded-full bg-yellow-500" />
                                                <span>{s.medium}</span>
                                            </span>
                                            <span className="inline-flex w-9 items-center justify-center gap-1 text-blue-500">
                                                <span className="size-1.5 rounded-full bg-blue-500" />
                                                <span>{s.low}</span>
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <Link
                                                to={`/scan/${s.last_scan_id}`}
                                                className="text-primary hover:underline font-medium text-sm inline-flex items-center px-3 py-1.5 rounded-md hover:bg-primary/10 transition-colors"
                                            >
                                                View Report
                                            </Link>
                                            <Link
                                                to={`/compare?target=${s.last_scan_id}`}
                                                className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-teal-300 transition-colors hover:bg-teal-500/10"
                                            >
                                                <GitCompareArrows className="size-4" />
                                                Compare
                                            </Link>
                                            <button
                                                onClick={() => handleDelete(s.last_scan_id!)}
                                                type="button"
                                                aria-label={`Delete scan ${s.last_scan_id} for ${s.name}`}
                                                className="text-destructive hover:bg-destructive/10 p-2 rounded-md transition-colors opacity-70 hover:opacity-100"
                                                title="Delete Scan"
                                            >
                                                <Trash2 className="size-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
