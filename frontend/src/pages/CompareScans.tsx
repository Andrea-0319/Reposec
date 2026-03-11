import { useEffect, useMemo, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { GitCompareArrows, Loader2, ScanSearch, ShieldAlert, ShieldCheck, Sparkles } from "lucide-react"
import { apiUrl } from "@/lib/api"
import { cn } from "@/lib/utils"

interface Project {
    id: number
    name: string
    repo_path: string
}

interface ScanOption {
    id: number
    project_id: number
    project_name: string
    started_at: string
    status: string
    total_findings: number
    critical: number
    high: number
    medium: number
    low: number
}

interface Finding {
    id: number
    title: string
    severity: string
    owasp: string | null
    file: string | null
}

interface ComparisonResponse {
    scan_a: ScanOption
    scan_b: ScanOption
    new: Finding[]
    resolved: Finding[]
    unchanged: Finding[]
}

const DIFF_SECTIONS: Array<{
    key: keyof Pick<ComparisonResponse, "new" | "resolved" | "unchanged">
    title: string
    description: string
    accent: string
}> = [
    {
        key: "new",
        title: "New Findings",
        description: "Issues introduced in the target scan.",
        accent: "text-destructive border-destructive/20 bg-destructive/5",
    },
    {
        key: "resolved",
        title: "Resolved Findings",
        description: "Issues that were present in the baseline and are now gone.",
        accent: "text-teal-400 border-teal-500/20 bg-teal-500/5",
    },
    {
        key: "unchanged",
        title: "Unchanged Findings",
        description: "Issues still present in both scans.",
        accent: "text-muted-foreground border-border bg-muted/30",
    },
]

function formatScanLabel(scan: ScanOption) {
    return `${scan.project_name} · #${scan.id} · ${new Date(scan.started_at).toLocaleString()}`
}

function getSeverityBadge(severity: string) {
    switch (severity.toUpperCase()) {
        case "CRITICAL":
            return "text-destructive border-destructive/30 bg-destructive/10"
        case "HIGH":
            return "text-orange-500 border-orange-500/30 bg-orange-500/10 dark:text-orange-400"
        case "MEDIUM":
            return "text-yellow-600 border-yellow-500/30 bg-yellow-500/10 dark:text-yellow-400"
        case "LOW":
            return "text-blue-500 border-blue-500/30 bg-blue-500/10"
        default:
            return "text-muted-foreground border-border bg-muted"
    }
}

export default function CompareScans() {
    const [searchParams] = useSearchParams()
    const [scanOptions, setScanOptions] = useState<ScanOption[]>([])
    const [selectedScanA, setSelectedScanA] = useState<string>("")
    const [selectedScanB, setSelectedScanB] = useState<string>("")
    const [comparison, setComparison] = useState<ComparisonResponse | null>(null)
    const [loadingOptions, setLoadingOptions] = useState(true)
    const [loadingComparison, setLoadingComparison] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [hasAppliedQuerySelection, setHasAppliedQuerySelection] = useState(false)

    useEffect(() => {
        async function loadScans() {
            try {
                setLoadingOptions(true)
                setError(null)

                const projectsResponse = await fetch(apiUrl("/api/projects"))
                if (!projectsResponse.ok) {
                    throw new Error("Failed to load projects")
                }

                const projects: Project[] = await projectsResponse.json()

                const timelineResponses = await Promise.all(
                    projects.map(async (project) => {
                        const scansResponse = await fetch(apiUrl(`/api/projects/${project.id}/scans`))
                        if (!scansResponse.ok) {
                            return [] as ScanOption[]
                        }

                        const scans = await scansResponse.json() as Omit<ScanOption, "project_name">[]
                        return scans.map((scan) => ({
                            ...scan,
                            project_name: project.name,
                        }))
                    })
                )

                const flattened = timelineResponses
                    .flat()
                    .sort((left, right) => new Date(right.started_at).getTime() - new Date(left.started_at).getTime())

                setScanOptions(flattened)
                if (flattened.length >= 2) {
                    setSelectedScanB(String(flattened[0].id))
                    setSelectedScanA(String(flattened[1].id))
                }
            } catch (err) {
                console.error(err)
                setError(err instanceof Error ? err.message : "Failed to load scans")
            } finally {
                setLoadingOptions(false)
            }
        }

        loadScans()
    }, [])

    useEffect(() => {
        async function loadComparison() {
            if (!selectedScanA || !selectedScanB || selectedScanA === selectedScanB) {
                setComparison(null)
                return
            }

            try {
                setLoadingComparison(true)
                setError(null)

                const response = await fetch(apiUrl(`/api/scans/${selectedScanA}/compare/${selectedScanB}`))
                if (!response.ok) {
                    throw new Error("Failed to compare scans")
                }

                const data: ComparisonResponse = await response.json()
                setComparison(data)
            } catch (err) {
                console.error(err)
                setComparison(null)
                setError(err instanceof Error ? err.message : "Failed to compare scans")
            } finally {
                setLoadingComparison(false)
            }
        }

        loadComparison()
    }, [selectedScanA, selectedScanB])

    useEffect(() => {
        if (loadingOptions || scanOptions.length === 0 || hasAppliedQuerySelection) {
            return
        }

        const baselineParam = searchParams.get("baseline")
        const targetParam = searchParams.get("target")

        if (!baselineParam && !targetParam) {
            setHasAppliedQuerySelection(true)
            return
        }

        const targetId = targetParam ? Number(targetParam) : null
        const baselineId = baselineParam ? Number(baselineParam) : null
        const targetScan = targetId ? scanOptions.find((scan) => scan.id === targetId) ?? null : null

        let resolvedBaselineId = baselineId

        if (!resolvedBaselineId && targetScan) {
            const sameProjectScans = scanOptions
                .filter((scan) => scan.project_id === targetScan.project_id)
                .sort((left, right) => new Date(right.started_at).getTime() - new Date(left.started_at).getTime())

            const targetIndex = sameProjectScans.findIndex((scan) => scan.id === targetScan.id)
            const olderScan = targetIndex >= 0 ? sameProjectScans[targetIndex + 1] : undefined
            const newerScan = targetIndex > 0 ? sameProjectScans[targetIndex - 1] : undefined
            resolvedBaselineId = olderScan?.id ?? newerScan?.id ?? null
        }

        if (resolvedBaselineId) {
            setSelectedScanA(String(resolvedBaselineId))
        }

        if (targetId) {
            setSelectedScanB(String(targetId))
        }

        setHasAppliedQuerySelection(true)
    }, [hasAppliedQuerySelection, loadingOptions, scanOptions, searchParams])

    const selectedA = useMemo(
        () => scanOptions.find((scan) => scan.id === Number(selectedScanA)) ?? null,
        [scanOptions, selectedScanA]
    )
    const selectedB = useMemo(
        () => scanOptions.find((scan) => scan.id === Number(selectedScanB)) ?? null,
        [scanOptions, selectedScanB]
    )

    return (
        <div className="space-y-6 animate-in fade-in zoom-in-95 duration-500 max-w-6xl mx-auto pb-12">
            <div className="border-b pb-6">
                <h1 className="text-3xl font-bold tracking-tight">Compare Scans</h1>
                <p className="text-muted-foreground mt-2 max-w-2xl">
                    Compare two scan snapshots to isolate regressions, validate remediations, and understand what changed between review cycles.
                </p>
            </div>

            <div className="rounded-2xl border bg-card shadow-sm p-6 md:p-8">
                <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                        <label htmlFor="scan-a" className="text-sm font-semibold text-foreground">Baseline Scan</label>
                        <select
                            id="scan-a"
                            value={selectedScanA}
                            onChange={(event) => setSelectedScanA(event.target.value)}
                            className="w-full rounded-xl border bg-background px-4 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                            disabled={loadingOptions || scanOptions.length === 0}
                        >
                            <option value="">Select first scan</option>
                            {scanOptions.map((scan) => (
                                <option key={`a-${scan.id}`} value={scan.id}>
                                    {formatScanLabel(scan)}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-2">
                        <label htmlFor="scan-b" className="text-sm font-semibold text-foreground">Target Scan</label>
                        <select
                            id="scan-b"
                            value={selectedScanB}
                            onChange={(event) => setSelectedScanB(event.target.value)}
                            className="w-full rounded-xl border bg-background px-4 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                            disabled={loadingOptions || scanOptions.length === 0}
                        >
                            <option value="">Select second scan</option>
                            {scanOptions.map((scan) => (
                                <option key={`b-${scan.id}`} value={scan.id}>
                                    {formatScanLabel(scan)}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="mt-6 grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
                    <div className="rounded-2xl border border-dashed bg-muted/20 p-8 text-center xl:text-left">
                        <div className="mx-auto xl:mx-0 mb-4 flex size-14 items-center justify-center rounded-2xl bg-teal-500/10 text-teal-400">
                            {loadingOptions || loadingComparison ? <Loader2 className="size-7 animate-spin" /> : <GitCompareArrows className="size-7" />}
                        </div>
                        <h2 className="text-xl font-semibold">
                            {selectedA && selectedB ? "Diff view ready" : "Select two scans to compare"}
                        </h2>
                        <p className="mx-auto xl:mx-0 mt-2 max-w-2xl text-sm text-muted-foreground">
                            {selectedA && selectedB
                                ? "Use the baseline on the left and the target on the right to review what is new, what was fixed, and what still needs attention."
                                : "Choose a baseline scan and a target scan to inspect regressions, fixed findings, and severity drift."}
                        </p>
                        <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm text-muted-foreground">
                            <ScanSearch className="size-4" />
                            {scanOptions.length > 0 ? `${scanOptions.length} scans available for comparison` : "Waiting for scan history"}
                        </div>
                    </div>

                    <div className="rounded-2xl border bg-background/60 p-5 space-y-4">
                        <div>
                            <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Baseline</p>
                            <div className="mt-2 rounded-xl border border-border/80 bg-card px-4 py-3">
                                {selectedA ? (
                                    <>
                                        <p className="font-semibold text-sm">{selectedA.project_name}</p>
                                        <p className="text-xs text-muted-foreground mt-1">Scan #{selectedA.id} · {new Date(selectedA.started_at).toLocaleString()}</p>
                                    </>
                                ) : (
                                    <p className="text-sm text-muted-foreground">Select a baseline scan</p>
                                )}
                            </div>
                        </div>
                        <div>
                            <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Target</p>
                            <div className="mt-2 rounded-xl border border-border/80 bg-card px-4 py-3">
                                {selectedB ? (
                                    <>
                                        <p className="font-semibold text-sm">{selectedB.project_name}</p>
                                        <p className="text-xs text-muted-foreground mt-1">Scan #{selectedB.id} · {new Date(selectedB.started_at).toLocaleString()}</p>
                                    </>
                                ) : (
                                    <p className="text-sm text-muted-foreground">Select a target scan</p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {error && (
                <div className="rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                    {error}
                </div>
            )}

            {!loadingOptions && scanOptions.length === 0 && (
                <div className="rounded-2xl border border-dashed p-12 text-center">
                    <Sparkles className="mx-auto size-10 text-teal-400" />
                    <h3 className="mt-4 text-lg font-semibold">No scan history available</h3>
                    <p className="mt-2 text-sm text-muted-foreground">
                        Launch at least two scans to unlock the comparison workflow.
                    </p>
                    <Link
                        to="/launch"
                        className="mt-6 inline-flex items-center rounded-full border border-teal-500/30 bg-teal-500/10 px-4 py-2 text-sm font-semibold text-teal-400 transition-colors hover:bg-teal-500/15"
                    >
                        Launch a new scan →
                    </Link>
                </div>
            )}

            {selectedScanA === selectedScanB && selectedScanA !== "" && (
                <div className="rounded-xl border border-orange-500/20 bg-orange-500/10 px-4 py-3 text-sm text-orange-500 dark:text-orange-400">
                    Select two different scans to generate a diff.
                </div>
            )}

            {comparison && !loadingComparison && (
                <>
                    <div className="grid gap-4 md:grid-cols-3">
                        {DIFF_SECTIONS.map((section) => (
                            <div key={section.key} className={cn("rounded-2xl border p-5", section.accent)}>
                                <p className="text-sm font-medium opacity-80">{section.title}</p>
                                <p className="mt-1 text-3xl font-bold">{comparison[section.key].length}</p>
                                <p className="mt-2 text-xs opacity-80">{section.description}</p>
                            </div>
                        ))}
                    </div>

                    <div className="grid gap-6 xl:grid-cols-3">
                        {DIFF_SECTIONS.map((section) => {
                            const findings = comparison[section.key]

                            return (
                                <div key={section.key} className="rounded-2xl border bg-card shadow-sm overflow-hidden">
                                    <div className="border-b bg-muted/30 px-5 py-4">
                                        <h3 className="font-semibold">{section.title}</h3>
                                        <p className="mt-1 text-xs text-muted-foreground">{section.description}</p>
                                    </div>

                                    <div className="max-h-[28rem] overflow-y-auto p-4 space-y-3">
                                        {findings.length === 0 ? (
                                            <div className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
                                                No findings in this bucket.
                                            </div>
                                        ) : (
                                            findings.map((finding) => (
                                                <div key={`${section.key}-${finding.id}-${finding.title}`} className="rounded-xl border bg-background/70 p-4 space-y-3">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <span className={cn("inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider", getSeverityBadge(finding.severity))}>
                                                            {finding.severity}
                                                        </span>
                                                        {finding.owasp && (
                                                            <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-mono text-muted-foreground">
                                                                {finding.owasp}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div>
                                                        <h4 className="text-sm font-semibold leading-relaxed">{finding.title}</h4>
                                                        {finding.file && (
                                                            <p className="mt-2 truncate text-xs font-mono text-muted-foreground">
                                                                {finding.file}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                        <Link
                            to={`/scan/${comparison.scan_a.id}`}
                            className="flex items-center justify-between rounded-2xl border bg-card px-5 py-4 transition-colors hover:bg-muted/20"
                        >
                            <div>
                                <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Baseline report</p>
                                <p className="mt-1 font-semibold">Open scan #{comparison.scan_a.id}</p>
                            </div>
                            <ShieldCheck className="size-5 text-teal-400" />
                        </Link>
                        <Link
                            to={`/scan/${comparison.scan_b.id}`}
                            className="flex items-center justify-between rounded-2xl border bg-card px-5 py-4 transition-colors hover:bg-muted/20"
                        >
                            <div>
                                <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Target report</p>
                                <p className="mt-1 font-semibold">Open scan #{comparison.scan_b.id}</p>
                            </div>
                            <ShieldAlert className="size-5 text-orange-400" />
                        </Link>
                    </div>
                </>
            )}
        </div>
    )
}
