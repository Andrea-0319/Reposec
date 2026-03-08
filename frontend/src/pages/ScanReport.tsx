import { useEffect, useState } from "react"
import { useParams, Link, useNavigate } from "react-router-dom"
import { ArrowLeft, ShieldAlert, AlertTriangle, Info, FileCode2, Loader2, ShieldCheck, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface ScanDetail {
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

interface Finding {
    id: number
    scan_id: number
    title: string
    severity: string
    owasp: string | null
    file: string | null
    description: string | null
    remediation: string | null
}

interface ScanResponse {
    scan: ScanDetail
    findings: Finding[]
}

export default function ScanReport() {
    const { id } = useParams()
    const navigate = useNavigate()
    const [data, setData] = useState<ScanResponse | null>(null)
    const [loading, setLoading] = useState(true)
    const [severityFilter, setSeverityFilter] = useState<string | null>(null)

    useEffect(() => {
        async function fetchScanData() {
            try {
                const res = await fetch(`http://localhost:8000/api/scans/${id}`)
                if (res.ok) {
                    const json = await res.json()
                    setData(json)
                }
            } catch (e) {
                console.error("Fetch scan report error", e)
            } finally {
                setLoading(false)
            }
        }
        fetchScanData()
    }, [id])

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <Loader2 className="size-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

    if (!data || !data.scan) {
        return (
            <div className="text-center mt-12">
                <h2 className="text-2xl font-bold">Scan Not Found</h2>
                <Link to="/" className="text-primary hover:underline mt-4 inline-block">Return to Dashboard</Link>
            </div>
        )
    }

    const { scan, findings } = data

    const filteredFindings = severityFilter
        ? findings.filter(f => f.severity.toUpperCase() === severityFilter.toUpperCase())
        : findings

    const getSeverityColor = (sev: string) => {
        switch (sev.toUpperCase()) {
            case "CRITICAL": return "text-destructive border-destructive/30 bg-destructive/10"
            case "HIGH": return "text-orange-500 border-orange-500/30 bg-orange-500/10 dark:text-orange-400"
            case "MEDIUM": return "text-yellow-600 border-yellow-500/30 bg-yellow-500/10 dark:text-yellow-400"
            case "LOW": return "text-blue-500 border-blue-500/30 bg-blue-500/10"
            default: return "text-muted-foreground border-border bg-muted"
        }
    }

    const getSeverityIcon = (sev: string) => {
        switch (sev.toUpperCase()) {
            case "CRITICAL": return <ShieldAlert className="size-5" />
            case "HIGH": return <AlertTriangle className="size-5" />
            case "MEDIUM": return <AlertTriangle className="size-5" />
            case "LOW": return <Info className="size-5" />
            default: return <Info className="size-5" />
        }
    }

    const handleDelete = async () => {
        if (!confirm("Are you sure you want to delete this scan? This action cannot be undone.")) return;

        try {
            const res = await fetch(`http://localhost:8000/api/scans/${scan.id}`, {
                method: "DELETE"
            });

            if (res.ok) {
                // Navigate back to the project detail page
                navigate(`/project/${scan.project_id}`);
            } else {
                const errorData = await res.json();
                alert(errorData.detail || "Failed to delete scan");
            }
        } catch (e) {
            console.error(e);
            alert("Error deleting scan");
        }
    }

    return (
        <div className="space-y-6 animate-in fade-in zoom-in-95 duration-500 max-w-7xl mx-auto pb-12">
            <div className="flex flex-col gap-4 border-b pb-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link to={`/project/${scan.project_id}`} className="p-2 hover:bg-muted rounded-full transition-colors">
                            <ArrowLeft className="size-5" />
                        </Link>
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight">Scan Report #{scan.id}</h1>
                            <p className="text-muted-foreground mt-1 text-sm">
                                Executed on {new Date(scan.started_at).toLocaleString()}
                                {scan.duration_seconds && ` • Duration: ${scan.duration_seconds.toFixed(1)}s`}
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={handleDelete}
                        className="flex items-center gap-2 text-destructive hover:bg-destructive/10 px-4 py-2 rounded-md font-medium transition-colors"
                    >
                        <Trash2 className="size-4" />
                        Delete Scan
                    </button>
                </div>

                {scan.status === "failed" && (
                    <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-md flex items-center gap-3 border border-destructive/20 max-w-2xl">
                        <ShieldAlert className="size-5" />
                        <span className="font-semibold text-sm">This scan failed. Results might be incomplete.</span>
                    </div>
                )}
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                {[
                    { id: null, label: "Total Findings", value: scan.total_findings, color: "text-foreground", bg: "bg-card" },
                    { id: "Critical", label: "Critical", value: scan.critical, color: "text-destructive", bg: "bg-destructive/5" },
                    { id: "High", label: "High", value: scan.high, color: "text-orange-500 dark:text-orange-400", bg: "bg-orange-500/5" },
                    { id: "Medium", label: "Medium", value: scan.medium, color: "text-yellow-600 dark:text-yellow-400", bg: "bg-yellow-500/5" },
                    { id: "Low", label: "Low", value: scan.low, color: "text-blue-500", bg: "bg-blue-500/5" },
                ].map((kpi, i) => (
                    <button
                        key={i}
                        onClick={() => setSeverityFilter(kpi.id)}
                        className={cn(
                            "rounded-xl border shadow-sm p-4 flex flex-col justify-between text-left transition-all hover:ring-2 hover:ring-primary/50 cursor-pointer",
                            kpi.bg,
                            severityFilter === kpi.id ? "ring-2 ring-primary" : ""
                        )}
                    >
                        <span className="text-sm font-medium text-muted-foreground">{kpi.label}</span>
                        <span className={cn("text-3xl font-bold mt-2", kpi.color)}>{kpi.value}</span>
                    </button>
                ))}
            </div>

            {/* Findings List */}
            <div className="mt-8">
                <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                    Vulnerability Details
                    <span className="bg-muted text-muted-foreground px-2 py-0.5 rounded-full text-xs font-bold">
                        {filteredFindings.length}
                    </span>
                </h3>

                {filteredFindings.length === 0 ? (
                    <div className="rounded-xl border border-dashed p-12 text-center flex flex-col items-center max-w-2xl mx-auto">
                        <ShieldCheck className="size-12 text-green-500 mb-4" />
                        <h3 className="text-lg font-bold">No vulnerabilities found</h3>
                        <p className="text-muted-foreground mt-2 text-sm">The code analyzed in this scan is clean and secure based on current rules (or the selected severity filter yielded no results).</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {filteredFindings.map((finding) => (
                            <div key={finding.id} className="rounded-xl border bg-card shadow-sm overflow-hidden flex flex-col transition-all hover:shadow-md">
                                <div className="p-5 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                                    <div className="flex-1 space-y-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <span className={cn("flex items-center gap-1.5 px-2.5 py-1 rounded border text-xs font-bold uppercase tracking-wider inline-flex", getSeverityColor(finding.severity))}>
                                                {getSeverityIcon(finding.severity)}
                                                {finding.severity}
                                            </span>
                                            {finding.owasp && (
                                                <span className="text-xs font-mono bg-muted text-muted-foreground px-2 py-1 rounded">
                                                    {finding.owasp}
                                                </span>
                                            )}
                                        </div>
                                        <h4 className="text-lg font-semibold leading-tight">{finding.title}</h4>
                                        {finding.file && (
                                            <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-2 font-mono">
                                                <FileCode2 className="size-4" />
                                                {finding.file}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="border-t bg-muted/20 p-5 space-y-4 text-sm">
                                    {finding.description && (
                                        <div>
                                            <h5 className="font-semibold mb-1 text-foreground">Description:</h5>
                                            <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed">{finding.description}</p>
                                        </div>
                                    )}
                                    {finding.remediation && (
                                        <div>
                                            <h5 className="font-semibold mb-1 text-foreground">Recommended Remediation:</h5>
                                            <div className="bg-muted/50 border p-3 rounded-md text-foreground/90 font-mono text-xs whitespace-pre-wrap">
                                                {finding.remediation}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
