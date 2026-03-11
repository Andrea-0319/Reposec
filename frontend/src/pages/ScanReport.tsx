import { useEffect, useMemo, useState } from "react"
import { useParams, Link, useNavigate } from "react-router-dom"
import { ArrowLeft, ShieldAlert, AlertTriangle, Info, FileCode2, Loader2, ShieldCheck, Trash2, ChevronDown, GitCompareArrows } from "lucide-react"
import { cn } from "@/lib/utils"
import { apiUrl } from "@/lib/api"
import { OWASPFilterDropdown } from "@/components/OWASPFilterDropdown"

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
    error?: string | null
}

function AnimatedNumber({ value, className }: { value: number; className?: string }) {
    const [displayValue, setDisplayValue] = useState(0)

    useEffect(() => {
        let frameId = 0
        const startTime = performance.now()
        const duration = 700

        const animate = (timestamp: number) => {
            const progress = Math.min((timestamp - startTime) / duration, 1)
            const eased = 1 - Math.pow(1 - progress, 3)
            setDisplayValue(Math.round(value * eased))

            if (progress < 1) {
                frameId = requestAnimationFrame(animate)
            }
        }

        frameId = requestAnimationFrame(animate)

        return () => cancelAnimationFrame(frameId)
    }, [value])

    return <span className={className}>{displayValue}</span>
}

export default function ScanReport() {
    const { id } = useParams()
    const navigate = useNavigate()
    const [data, setData] = useState<ScanResponse | null>(null)
    const [loading, setLoading] = useState(true)
    const [statusError, setStatusError] = useState<string | null>(null)
    const [severityFilter, setSeverityFilter] = useState<string | null>(null)
    const [owaspFilter, setOwaspFilter] = useState<Set<string>>(new Set())
    const [expandedFindings, setExpandedFindings] = useState<Set<number>>(new Set())

    useEffect(() => {
        async function fetchScanData() {
            setLoading(true)
            try {
                const res = await fetch(apiUrl(`/api/scans/${id}`))
                if (res.ok) {
                    const json = await res.json()
                    setData(json)
                    setStatusError(json.error || null)
                } else {
                    setData(null)
                }
            } catch (e) {
                console.error("Fetch scan report error", e)
                setData(null)
            } finally {
                setLoading(false)
            }
        }
        fetchScanData()
    }, [id])

    useEffect(() => {
        if (!id || data?.scan.status !== "running") {
            return
        }

        const intervalId = window.setInterval(async () => {
            try {
                const statusRes = await fetch(apiUrl(`/api/scans/${id}/status`))
                if (!statusRes.ok) {
                    throw new Error("Failed to refresh scan status")
                }

                const statusJson = await statusRes.json()
                setStatusError(statusJson.error || null)

                if (statusJson.status !== "running") {
                    const detailRes = await fetch(apiUrl(`/api/scans/${id}`))
                    if (!detailRes.ok) {
                        throw new Error("Failed to refresh scan details")
                    }

                    const detailJson = await detailRes.json()
                    setData(detailJson)
                }
            } catch (e) {
                console.error("Polling scan status failed", e)
            }
        }, 2000)

        return () => window.clearInterval(intervalId)
    }, [data?.scan.status, id])

    const scan = data?.scan ?? null
    const findings = useMemo(() => data?.findings ?? [], [data])
    const scanError = data?.error || statusError
    const hasActiveFilters = severityFilter !== null || owaspFilter.size > 0

    const owaspCategories = useMemo(() => {
        const categories = Array.from(new Set(findings.map((finding) => finding.owasp).filter(Boolean) as string[]))

        return categories.sort((left: string, right: string) => {
            const leftCode = left.match(/A\d{2}/i)?.[0] ?? left
            const rightCode = right.match(/A\d{2}/i)?.[0] ?? right
            return leftCode.localeCompare(rightCode, undefined, { numeric: true, sensitivity: "base" })
        })
    }, [findings])

    const filteredFindings = useMemo(() => {
        return findings.filter((finding) => {
            const matchesSeverity = severityFilter
                ? finding.severity.toUpperCase() === severityFilter.toUpperCase()
                : true
            const matchesOwasp = owaspFilter.size > 0
                ? Boolean(finding.owasp && owaspFilter.has(finding.owasp))
                : true

            return matchesSeverity && matchesOwasp
        })
    }, [findings, owaspFilter, severityFilter])

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <Loader2 className="size-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

    if (!scan) {
        return (
            <div className="text-center mt-12">
                <h2 className="text-2xl font-bold">Scan Not Found</h2>
                <Link to="/" className="text-primary hover:underline mt-4 inline-block">Return to Dashboard</Link>
            </div>
        )
    }

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

    const toggleOwaspFilter = (category: string) => {
        setOwaspFilter((current) => {
            const next = new Set(current)

            if (next.has(category)) {
                next.delete(category)
            } else {
                next.add(category)
            }

            return next
        })
    }

    const clearOwaspFilters = () => {
        setOwaspFilter(new Set())
    }

    const toggleSeverityFilter = (nextSeverity: string | null) => {
        setSeverityFilter((current) => current === nextSeverity ? null : nextSeverity)
    }

    const toggleFindingExpansion = (findingId: number) => {
        setExpandedFindings((current) => {
            const next = new Set(current)

            if (next.has(findingId)) {
                next.delete(findingId)
            } else {
                next.add(findingId)
            }

            return next
        })
    }

    const allVisibleExpanded = filteredFindings.length > 0 && filteredFindings.every((finding) => expandedFindings.has(finding.id))

    const toggleAllExpanded = () => {
        setExpandedFindings((current) => {
            const next = new Set(current)

            if (allVisibleExpanded) {
                filteredFindings.forEach((finding) => next.delete(finding.id))
            } else {
                filteredFindings.forEach((finding) => next.add(finding.id))
            }

            return next
        })
    }

    const handleDelete = async () => {
        if (!confirm("Are you sure you want to delete this scan? This action cannot be undone.")) return;

        try {
            const res = await fetch(apiUrl(`/api/scans/${scan.id}`), {
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
                        <Link to={`/project/${scan.project_id}`} aria-label="Back to project details" className="p-2 hover:bg-muted rounded-full transition-colors">
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

                    <div className="flex items-center gap-2">
                        <Link
                            to={`/compare?target=${scan.id}`}
                            className="flex items-center gap-2 rounded-md px-4 py-2 font-medium text-teal-300 transition-colors hover:bg-teal-500/10"
                        >
                            <GitCompareArrows className="size-4" />
                            Compare Scan
                        </Link>
                        <button
                            onClick={handleDelete}
                            className="flex items-center gap-2 text-destructive hover:bg-destructive/10 px-4 py-2 rounded-md font-medium transition-colors"
                        >
                            <Trash2 className="size-4" />
                            Delete Scan
                        </button>
                    </div>
                </div>

                {scan.status === "running" && (
                    <div className="bg-blue-500/10 text-blue-700 dark:text-blue-300 px-4 py-3 rounded-md flex items-center gap-3 border border-blue-500/20 max-w-2xl">
                        <Loader2 className="size-5 animate-spin" />
                        <span className="font-semibold text-sm">This scan is still running. The page refreshes automatically.</span>
                    </div>
                )}

                {scan.status === "failed" && (
                    <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-md flex items-start gap-3 border border-destructive/20 max-w-3xl">
                        <ShieldAlert className="size-5 mt-0.5 shrink-0" />
                        <div className="space-y-1">
                            <span className="font-semibold text-sm block">This scan failed. Results might be incomplete.</span>
                            {scanError && (
                                <p className="text-sm text-destructive/90 break-words">{scanError}</p>
                            )}
                        </div>
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
                        onClick={() => toggleSeverityFilter(kpi.id)}
                        className={cn(
                            "rounded-xl border shadow-sm p-4 flex flex-col justify-between text-left transition-all hover:ring-2 hover:ring-primary/50 cursor-pointer",
                            kpi.bg,
                            severityFilter === kpi.id ? "ring-2 ring-primary" : ""
                        )}
                    >
                        <span className="text-sm font-medium text-muted-foreground">{kpi.label}</span>
                        <AnimatedNumber value={kpi.value} className={cn("text-3xl font-bold mt-2", kpi.color)} />
                    </button>
                ))}
            </div>

            {/* Findings List */}
            <div className="mt-8">
                <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                    <h3 className="text-xl font-semibold flex items-center gap-2">
                        <span>Vulnerability Details</span>
                        <span className="bg-muted text-muted-foreground px-2 py-0.5 rounded-full text-xs font-bold">
                            {hasActiveFilters ? `${filteredFindings.length}/${findings.length}` : findings.length}
                        </span>
                    </h3>

                    <div className="flex flex-wrap items-center justify-start gap-2 xl:justify-end">
                        {filteredFindings.length > 0 && (
                            <button
                                type="button"
                                onClick={toggleAllExpanded}
                                className="rounded-full border border-border bg-background px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted"
                            >
                                {allVisibleExpanded ? "Collapse All" : "Expand All"}
                            </button>
                        )}

                        <OWASPFilterDropdown
                            categories={owaspCategories}
                            activeFilters={owaspFilter}
                            onToggle={toggleOwaspFilter}
                            onClear={clearOwaspFilters}
                        />
                    </div>
                </div>

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
                                <button
                                    type="button"
                                    onClick={() => toggleFindingExpansion(finding.id)}
                                    aria-expanded={expandedFindings.has(finding.id)}
                                    className="w-full p-5 text-left transition-colors hover:bg-muted/10"
                                >
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1 space-y-3">
                                            <div className="flex flex-wrap items-center gap-3">
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

                                            <div className="space-y-2">
                                                <h4 className="text-lg font-semibold leading-tight">{finding.title}</h4>
                                                {finding.file && (
                                                    <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border bg-muted/60 px-3 py-1.5 text-xs font-medium text-muted-foreground">
                                                        <FileCode2 className="size-3.5 shrink-0" />
                                                        <span className="truncate font-mono">{finding.file}</span>
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <ChevronDown className={cn(
                                            "mt-1 size-5 shrink-0 text-muted-foreground transition-transform",
                                            expandedFindings.has(finding.id) ? "rotate-180" : "rotate-0"
                                        )} />
                                    </div>
                                </button>

                                {expandedFindings.has(finding.id) && (
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
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
