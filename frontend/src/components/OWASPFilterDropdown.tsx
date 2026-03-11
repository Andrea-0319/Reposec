import { useEffect, useRef, useState } from "react"
import { ChevronDown, ShieldAlert } from "lucide-react"
import { cn } from "@/lib/utils"

interface OWASPFilterDropdownProps {
    categories: string[]
    activeFilters: Set<string>
    onToggle: (category: string) => void
    onClear: () => void
}

export function OWASPFilterDropdown({ categories, activeFilters, onToggle, onClear }: OWASPFilterDropdownProps) {
    const [open, setOpen] = useState(false)
    const containerRef = useRef<HTMLDivElement | null>(null)

    useEffect(() => {
        const handleOutsideClick = (event: MouseEvent) => {
            if (!containerRef.current?.contains(event.target as Node)) {
                setOpen(false)
            }
        }

        document.addEventListener("mousedown", handleOutsideClick)
        return () => document.removeEventListener("mousedown", handleOutsideClick)
    }, [])

    return (
        <div ref={containerRef} className="relative">
            <button
                type="button"
                onClick={() => setOpen((current) => !current)}
                className="rounded-md border bg-background px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
                aria-expanded={open}
                disabled={categories.length === 0}
            >
                <span className="flex items-center gap-2">
                    <ShieldAlert className="size-4 text-teal-500" />
                    <span>OWASP Filter</span>
                    {activeFilters.size > 0 && (
                        <span className="bg-teal-500 text-white rounded-full px-1.5 text-xs">
                            {activeFilters.size}
                        </span>
                    )}
                    <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", open && "rotate-180")} />
                </span>
            </button>

            {open && (
                <div className="absolute right-0 mt-1 w-72 bg-card border rounded-lg shadow-lg p-2 z-50">
                    <div className="max-h-80 space-y-1 overflow-y-auto">
                        {categories.map((category) => {
                            const active = activeFilters.has(category)

                            return (
                                <label
                                    key={category}
                                    className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-muted cursor-pointer text-sm"
                                >
                                    <span className={cn(
                                        "flex size-4 items-center justify-center rounded border transition-colors",
                                        active ? "bg-teal-500/10 border-teal-500" : "border-border bg-background"
                                    )}>
                                        <input
                                            type="checkbox"
                                            checked={active}
                                            onChange={() => onToggle(category)}
                                            className="sr-only"
                                        />
                                        {active && <span className="size-2 rounded-full bg-teal-500" />}
                                    </span>
                                    <span className="font-medium text-foreground">{category}</span>
                                </label>
                            )
                        })}
                    </div>

                    {activeFilters.size > 0 && (
                        <div className="mt-2 border-t pt-2">
                            <button
                                type="button"
                                onClick={onClear}
                                className="w-full rounded-md border border-teal-500/20 bg-teal-500/10 px-3 py-2 text-sm font-medium text-teal-500 transition-colors hover:bg-teal-500/15"
                            >
                                Clear All
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}