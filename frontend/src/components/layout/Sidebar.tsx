import { Link, useLocation } from "react-router-dom"
import { LayoutDashboard, History, Settings, Moon, Sun, Rocket, GitCompareArrows } from "lucide-react"
import { useTheme } from "../theme-provider"
import { cn } from "@/lib/utils"

export function Sidebar() {
    const { theme, setTheme } = useTheme()
    const location = useLocation()

    const links = [
        { name: "Dashboard", href: "/", icon: LayoutDashboard },
        { name: "Launch Scan", href: "/launch", icon: Rocket },
        { name: "All Scans", href: "/scans", icon: History },
        { name: "Compare Scans", href: "/compare", icon: GitCompareArrows },
        { name: "Settings", href: "/settings", icon: Settings },
    ]

    return (
        <aside className="sticky top-0 flex h-screen w-64 shrink-0 flex-col overflow-y-auto border-r border-white/5 bg-card px-4 py-6">
            <div className="relative overflow-hidden rounded-2xl border border-teal-500/15 bg-gradient-to-b from-slate-900 via-slate-950 to-slate-950 px-3 py-3 shadow-[0_0_0_1px_rgba(20,184,166,0.05),0_18px_40px_-26px_rgba(45,212,191,0.8)]">
                <div className="absolute inset-x-8 top-4 h-12 rounded-full bg-teal-400/10 blur-2xl" aria-hidden="true" />
                <div className="relative flex items-center justify-center px-1 text-center">
                    <img
                        src="/reposec-logo.png"
                        alt="RepoSec logo"
                        className="h-auto w-full max-w-[8.5rem] drop-shadow-[0_0_18px_rgba(45,212,191,0.32)]"
                    />
                </div>
            </div>

            <nav className="mt-8 flex flex-1 flex-col gap-1.5">
                {links.map((link) => {
                    const Icon = link.icon
                    const isActive = location.pathname === link.href || (location.pathname.startsWith(link.href) && link.href !== "/")
                    return (
                        <Link
                            key={link.href}
                            to={link.href}
                            className={cn(
                                "flex items-center gap-3 rounded-md border-l-2 px-3 py-2.5 text-sm font-medium transition-all hover:bg-muted/80",
                                isActive
                                    ? "border-teal-400 bg-teal-500/10 text-teal-300 shadow-sm"
                                    : "border-transparent text-muted-foreground"
                            )}
                        >
                            <Icon className="size-4" />
                            {link.name}
                        </Link>
                    )
                })}
            </nav>

            <div className="mt-auto space-y-3 border-t pt-4">
                <div className="px-3">
                    <span className="inline-flex rounded-full border border-teal-500/20 bg-teal-500/10 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-teal-400">
                        v1.0.0
                    </span>
                </div>
                <button
                    onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                    className="flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-muted text-muted-foreground"
                >
                    <span>Theme</span>
                    {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
                </button>
            </div>
        </aside>
    )
}
