import React from "react"

interface ErrorBoundaryProps {
    children: React.ReactNode
    fallback?: React.ReactNode
    resetKey?: string
}

interface ErrorBoundaryState {
    hasError: boolean
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
    state: ErrorBoundaryState = {
        hasError: false,
    }

    static getDerivedStateFromError(): ErrorBoundaryState {
        return { hasError: true }
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error("Unhandled frontend error", error, errorInfo)
    }

    componentDidUpdate(prevProps: ErrorBoundaryProps) {
        if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
            this.setState({ hasError: false })
        }
    }

    private handleReload = () => {
        window.location.assign("/")
    }

    render() {
        if (this.state.hasError) {
            return this.props.fallback ?? (
                <div className="flex min-h-[60vh] items-center justify-center px-6">
                    <div className="max-w-md rounded-2xl border bg-card p-8 text-center shadow-sm">
                        <h2 className="text-2xl font-bold tracking-tight">Something went wrong</h2>
                        <p className="mt-3 text-sm text-muted-foreground">
                            The current page crashed unexpectedly. You can return to the dashboard and keep using the app.
                        </p>
                        <div className="mt-6 flex items-center justify-center gap-3">
                            <button
                                type="button"
                                onClick={this.handleReload}
                                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                            >
                                Back to Dashboard
                            </button>
                            <button
                                type="button"
                                onClick={() => window.location.reload()}
                                className="rounded-md border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
                            >
                                Reload Page
                            </button>
                        </div>
                    </div>
                </div>
            )
        }

        return this.props.children
    }
}