import { Outlet } from "react-router-dom"
import { Sidebar } from "./Sidebar"

export function Layout() {
    return (
        <div className="flex min-h-screen bg-background text-foreground">
            <Sidebar />
            <main className="min-w-0 flex-1 p-8">
                <div className="mx-auto max-w-6xl">
                    <Outlet />
                </div>
            </main>
        </div>
    )
}
