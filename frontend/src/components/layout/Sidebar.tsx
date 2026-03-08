import { Link, useLocation } from "react-router-dom"
import { Shield, LayoutDashboard, History, Settings, Moon, Sun } from "lucide-react"
import { useTheme } from "../theme-provider"
import { cn } from "@/lib/utils"

export function Sidebar() {
    const { theme, setTheme } = useTheme()
    const location = useLocation()

    const links = [
        { name: "Dashboard", href: "/", icon: LayoutDashboard },
        { name: "All Scans", href: "/scans", icon: History },
        { name: "Settings", href: "/settings", icon: Settings },
    ]

    return (
        <div className="flex h-screen w-64 flex-col border-r bg-card px-4 py-6">
            <div className="flex items-center gap-3 px-2">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
                    <Shield className="size-5" />
                </div>
                <span className="font-semibold text-lg tracking-tight">SecReview</span>
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
                                "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-all hover:bg-muted/80",
                                isActive ? "bg-secondary text-secondary-foreground shadow-sm" : "text-muted-foreground"
                            )}
                        >
                            <Icon className="size-4" />
                            {link.name}
                        </Link>
                    )
                })}
            </nav>

            <div className="mt-auto pt-4 border-t">
                <button
                    onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                    className="flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-muted text-muted-foreground"
                >
                    <span>Theme</span>
                    {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
                </button>
            </div>
        </div>
    )
}
