import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { History, Search, Filter, ShieldCheck, ShieldAlert, Terminal, FileCode2 } from "lucide-react"

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

    useEffect(() => {
        async function fetchData() {
            try {
                const res = await fetch("http://localhost:8000/api/projects")
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

    const scans = projects.filter(p => p.last_scan_id !== null)

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
                        disabled
                    />
                </div>
                <button className="flex items-center gap-2 border bg-card text-foreground hover:bg-muted py-2 px-4 rounded-md text-sm font-medium transition-colors" disabled>
                    <Filter className="size-4" />
                    Filter
                </button>
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
                                            <span className="text-destructive w-6 text-center">{s.critical}</span>
                                            <span className="text-orange-500 w-6 text-center">{s.high}</span>
                                            <span className="text-yellow-600 w-6 text-center">{s.medium}</span>
                                            <span className="text-blue-500 w-6 text-center">{s.low}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <Link
                                            to={`/scan/${s.last_scan_id}`}
                                            className="text-primary hover:underline font-medium text-sm inline-flex items-center px-3 py-1.5 rounded-md hover:bg-primary/10 transition-colors"
                                        >
                                            View Report
                                        </Link>
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
