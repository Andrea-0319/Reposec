export default function ProjectDetail() {
    return (
        <div className="space-y-6 animate-in fade-in zoom-in-95 duration-500">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Project Details</h1>
                <p className="text-muted-foreground mt-2">
                    Analytics and details for the selected project.
                </p>
            </div>
            <div className="h-[400px] rounded-xl border bg-card shadow-sm flex items-center justify-center p-6">
                <p className="text-muted-foreground">Chart Placeholder</p>
            </div>
        </div>
    )
}
