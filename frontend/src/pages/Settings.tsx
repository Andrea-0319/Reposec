import { Settings as SettingsIcon, Moon, Sun, Monitor, Save, Server } from "lucide-react"
import { useTheme } from "../components/theme-provider"

export default function Settings() {
    const { setTheme } = useTheme()

    return (
        <div className="space-y-6 animate-in fade-in zoom-in-95 duration-500 max-w-4xl mx-auto pb-12">
            <div className="flex flex-col gap-2 border-b pb-6">
                <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                    <SettingsIcon className="size-8" />
                    Settings
                </h1>
                <p className="text-muted-foreground">
                    Manage your application preferences and local connection details.
                </p>
            </div>

            <div className="grid gap-8">
                {/* Appearance Settings */}
                <div className="space-y-4">
                    <h3 className="text-xl font-semibold">Appearance</h3>
                    <p className="text-sm text-muted-foreground">Customize the local theme of the UI dashboard.</p>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <button
                            onClick={() => setTheme("default" as any)} // Forcing default fallback to light for button UI but handling logic properly
                            className="flex flex-col items-center gap-3 p-4 border-2 rounded-xl bg-card hover:bg-muted/50 transition-colors ring-offset-background focus-visible:outline-none focus-visible:ring-2 disabled:opacity-50"
                        >
                            <div className="size-24 rounded-md bg-muted/50 border flex items-center justify-center p-2 w-full">
                                <div className="w-full h-full bg-white rounded shadow-sm flex flex-col gap-2 p-2">
                                    <div className="w-full h-2 bg-slate-200 rounded" />
                                    <div className="w-3/4 h-2 bg-slate-200 rounded" />
                                </div>
                            </div>
                            <div className="flex items-center gap-2 font-medium">
                                <Sun className="size-4 text-foreground" /> Light
                            </div>
                        </button>

                        <button
                            onClick={() => setTheme("dark")}
                            className="flex flex-col items-center gap-3 p-4 border-2 border-primary rounded-xl bg-card hover:bg-muted/50 transition-colors ring-offset-background focus-visible:outline-none focus-visible:ring-2 disabled:opacity-50"
                        >
                            <div className="size-24 rounded-md bg-slate-950 border border-slate-800 flex items-center justify-center p-2 w-full">
                                <div className="w-full h-full bg-slate-900 border border-slate-800 rounded shadow-sm flex flex-col gap-2 p-2">
                                    <div className="w-full h-2 bg-slate-800 rounded" />
                                    <div className="w-3/4 h-2 bg-slate-800 rounded" />
                                </div>
                            </div>
                            <div className="flex items-center gap-2 font-medium">
                                <Moon className="size-4 text-foreground" /> Dark
                            </div>
                        </button>

                        <button
                            onClick={() => setTheme("system")}
                            className="flex flex-col items-center gap-3 p-4 border-2 rounded-xl bg-card hover:bg-muted/50 transition-colors ring-offset-background focus-visible:outline-none focus-visible:ring-2 disabled:opacity-50"
                        >
                            <div className="size-24 rounded-md bg-gradient-to-br from-white to-slate-950 border flex items-center justify-center p-2 w-full overflow-hidden relative">
                                <div className="absolute inset-x-2 top-2 h-1/2 bg-white rounded-t shadow border-x border-t" />
                                <div className="absolute inset-x-2 bottom-2 h-1/2 bg-slate-950 rounded-b shadow border-x border-b border-slate-800" />
                            </div>
                            <div className="flex items-center gap-2 font-medium">
                                <Monitor className="size-4 text-foreground" /> System
                            </div>
                        </button>
                    </div>
                </div>

                <hr className="border-border" />

                {/* API Settings */}
                <div className="space-y-4">
                    <h3 className="text-xl font-semibold">Backend Connection</h3>
                    <p className="text-sm text-muted-foreground">Review the FastAPI backend URI.</p>

                    <div className="max-w-xl space-y-4">
                        <div className="flex flex-col gap-2">
                            <label className="text-sm font-medium">API Base URL</label>
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <Server className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                                    <input
                                        className="w-full bg-muted border rounded-md pl-9 pr-4 py-2 text-sm text-muted-foreground cursor-not-allowed"
                                        value="http://localhost:8000"
                                        disabled
                                    />
                                </div>
                                <button className="bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-md font-medium text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed" disabled>
                                    <Save className="size-4" /> Save
                                </button>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">Currently, the API endpoint is hardcoded to the local FastAPI instance for development.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
