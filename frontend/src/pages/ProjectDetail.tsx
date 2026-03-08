import { useEffect, useState } from "react"
import { useParams, Link } from "react-router-dom"
import { ArrowLeft, History, ShieldAlert, ShieldCheck, PlayCircle, Loader2, Trash2 } from "lucide-react"
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend
} from "recharts"
import { cn } from "@/lib/utils"

interface Scan {
    id: number
    project_id: number
    scan_dir: string
    started_at: string
    duration_seconds: number | null
    status: string
    total_findings: number
    critical: number
    high: number
    medium: number
    low: number
}

interface Project {
    id: number
    name: string
    repo_path: string
}

export default function ProjectDetail() {
    const { id } = useParams()
    const [scans, setScans] = useState<Scan[]>([])
    const [projectInfo, setProjectInfo] = useState<Project | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function fetchData() {
            try {
                // Fetch specific project scans
                const scansRes = await fetch(`http://localhost:8000/api/projects/${id}/scans`)
                if (scansRes.ok) {
                    const scansData: Scan[] = await scansRes.json()
                    // Sort ascending for chart (oldest to newest)
                    const sortedForChart = [...scansData].sort(
                        (a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime()
                    )
                    setScans(sortedForChart)
                }

                // Fetch all projects to find the name (workaround short of a single GET /api/projects/:id)
                const projRes = await fetch(`http://localhost:8000/api/projects`)
                if (projRes.ok) {
                    const projs = await projRes.json()
                    const p = projs.find((x: any) => x.id === Number(id))
                    if (p) setProjectInfo(p)
                }
            } catch (e) {
                console.error("Fetch error", e)
            } finally {
                setLoading(false)
            }
        }
        fetchData()
    }, [id])

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <Loader2 className="size-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

    const chartData = scans.map(s => ({
        name: new Date(s.started_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }),
        Total: s.total_findings,
        Critical: s.critical,
        High: s.high
    }))

    const handleDelete = async (scanId: number) => {
        if (!confirm("Are you sure you want to delete this scan? This action cannot be undone.")) return;

        try {
            const res = await fetch(`http://localhost:8000/api/scans/${scanId}`, {
                method: "DELETE"
            });

            if (res.ok) {
                // Remove the scan from the UI
                setScans(prev => prev.filter(s => s.id !== scanId));
            } else {
                const data = await res.json();
                alert(data.detail || "Failed to delete scan");
            }
        } catch (e) {
            console.error(e);
            alert("Error deleting scan");
        }
    }

    // Reverse back for the table (newest first)
    const displayScans = [...scans].reverse()

    return (
        <div className="space-y-6 animate-in fade-in zoom-in-95 duration-500 max-w-7xl mx-auto">
            <div className="flex items-center gap-4 border-b pb-6">
                <Link to="/" className="p-2 hover:bg-muted rounded-full transition-colors">
                    <ArrowLeft className="size-5" />
                </Link>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">
                        {projectInfo ? projectInfo.name : `Project #${id}`}
                    </h1>
                    <p className="text-muted-foreground mt-1 text-sm font-mono bg-muted/50 inline-block px-2 py-0.5 rounded">
                        {projectInfo?.repo_path || "Loading path..."}
                    </p>
                </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
                {/* Trend Chart */}
                <div className="lg:col-span-2 rounded-xl border bg-card shadow-sm p-6 flex flex-col">
                    <h3 className="font-semibold text-lg mb-6 flex items-center gap-2">
                        <History className="size-5 text-muted-foreground" />
                        Vulnerability Trend
                    </h3>
                    <div className="flex-1 min-h-[300px] w-full">
                        {scans.length > 1 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#888888" opacity={0.2} vertical={false} />
                                    <XAxis
                                        dataKey="name"
                                        stroke="#888888"
                                        fontSize={12}
                                        tickLine={false}
                                        axisLine={false}
                                        minTickGap={30}
                                    />
                                    <YAxis
                                        stroke="#888888"
                                        fontSize={12}
                                        tickLine={false}
                                        axisLine={false}
                                        tickFormatter={(value) => `${value}`}
                                    />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: "var(--color-bg-card)", borderRadius: "8px", borderColor: "var(--color-border)" }}
                                        itemStyle={{ color: "var(--color-foreground)" }}
                                    />
                                    <Legend />
                                    <Line type="monotone" dataKey="Total" stroke="#8884d8" strokeWidth={3} activeDot={{ r: 8 }} />
                                    <Line type="monotone" dataKey="Critical" stroke="#ef4444" strokeWidth={2} />
                                    <Line type="monotone" dataKey="High" stroke="#f97316" strokeWidth={2} />
                                </LineChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex items-center justify-center h-full border-2 border-dashed rounded-lg">
                                <p className="text-sm text-muted-foreground text-center">
                                    Not enough data for the chart.<br />More than one completed scan is required.
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Action / Overview Card */}
                <div className="rounded-xl border bg-card shadow-sm p-6 flex flex-col relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-full -z-10" />
                    <h3 className="font-semibold text-lg mb-4">Quick Actions</h3>

                    <div className="p-4 bg-muted/30 rounded-lg border mb-6">
                        <div className="text-sm text-muted-foreground mb-1">Project Status</div>
                        <div className="flex items-center gap-2">
                            {displayScans[0]?.status === "completed" ? (
                                <ShieldCheck className="size-5 text-green-500" />
                            ) : (
                                <ShieldAlert className="size-5 text-red-500" />
                            )}
                            <span className="font-medium capitalize">{displayScans[0]?.status || "Unknown"}</span>
                        </div>
                    </div>

                    <Link
                        to={`/launch?repo=${encodeURIComponent(projectInfo?.repo_path || "")}`}
                        className="mt-auto flex items-center justify-center gap-2 w-full bg-primary text-primary-foreground hover:bg-primary/90 py-2.5 rounded-md font-medium transition-colors"
                    >
                        <PlayCircle className="size-4" />
                        Launch New Scan
                    </Link>
                    <p className="text-xs text-center text-muted-foreground mt-3">
                        Launch a new scan for this repository using the dashboard.
                    </p>
                </div>
            </div>

            {/* Scans Timeline list */}
            <div>
                <h3 className="text-lg font-semibold mb-4 px-1">Scans Timeline</h3>
                <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-muted-foreground bg-muted/50 uppercase border-b">
                                <tr>
                                    <th className="px-6 py-3 font-medium">Date</th>
                                    <th className="px-6 py-3 font-medium">Status</th>
                                    <th className="px-6 py-3 font-medium text-right">Duration</th>
                                    <th className="px-6 py-3 font-medium text-center">Vulnerabilities (C/H/M/L)</th>
                                    <th className="px-6 py-3 font-medium text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {displayScans.map((scan) => (
                                    <tr key={scan.id} className="hover:bg-muted/30 transition-colors group">
                                        <td className="px-6 py-4 font-medium">
                                            {new Date(scan.started_at).toLocaleString()}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={cn("px-2.5 py-1 rounded-full text-xs font-semibold capitalize",
                                                scan.status === "completed" ? "bg-green-500/10 text-green-500" :
                                                    scan.status === "failed" ? "bg-red-500/10 text-red-500" :
                                                        "bg-blue-500/10 text-blue-500"
                                            )}>
                                                {scan.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right text-muted-foreground">
                                            {scan.duration_seconds ? `${scan.duration_seconds.toFixed(1)}s` : "-"}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center justify-center gap-2 font-medium">
                                                <span className="text-destructive w-6 text-center">{scan.critical}</span>
                                                <span className="text-orange-500 w-6 text-center">{scan.high}</span>
                                                <span className="text-yellow-600 w-6 text-center">{scan.medium}</span>
                                                <span className="text-blue-500 w-6 text-center">{scan.low}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Link
                                                    to={`/scan/${scan.id}`}
                                                    className="text-primary hover:underline font-medium text-sm inline-flex items-center"
                                                >
                                                    View Details &rarr;
                                                </Link>
                                                <button
                                                    onClick={() => handleDelete(scan.id)}
                                                    className="text-destructive hover:bg-destructive/10 p-2 rounded-md transition-colors"
                                                    title="Delete Scan"
                                                >
                                                    <Trash2 className="size-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {displayScans.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">
                                            No scans available for this project.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    )
}
