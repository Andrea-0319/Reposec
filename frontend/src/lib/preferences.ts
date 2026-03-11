export type BackendType = "cli" | "sdk"

export interface DashboardSettings {
    apiBaseUrl: string
    sdkUrl: string
    defaultModel: string
    defaultBackend: BackendType
    defaultParallel: number
    defaultTimeout: number
}

export const SETTINGS_STORAGE_KEY = "security-review-settings:v1"
export const DEFAULT_API_BASE_URL = "http://localhost:8000"

const ENV_API_BASE_URL = (import.meta.env.VITE_API_URL || DEFAULT_API_BASE_URL).replace(/\/$/, "")

const DEFAULT_SETTINGS: DashboardSettings = {
    apiBaseUrl: ENV_API_BASE_URL,
    sdkUrl: "",
    defaultModel: "",
    defaultBackend: "cli",
    defaultParallel: 1,
    defaultTimeout: 1800,
}

function clampParallel(value: unknown): number {
    const parsed = Number(value)
    if (!Number.isFinite(parsed)) {
        return DEFAULT_SETTINGS.defaultParallel
    }

    return Math.min(4, Math.max(1, Math.round(parsed)))
}

function normalizeTimeout(value: unknown): number {
    const parsed = Number(value)
    if (!Number.isFinite(parsed) || parsed < 1) {
        return DEFAULT_SETTINGS.defaultTimeout
    }

    return Math.round(parsed)
}

function normalizeBaseUrl(value: unknown): string {
    if (typeof value !== "string") {
        return DEFAULT_SETTINGS.apiBaseUrl
    }

    const normalized = value.trim().replace(/\/$/, "")
    return normalized || DEFAULT_SETTINGS.apiBaseUrl
}

export function getStoredSettings(): DashboardSettings {
    if (typeof window === "undefined") {
        return DEFAULT_SETTINGS
    }

    try {
        const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY)
        if (!raw) {
            return DEFAULT_SETTINGS
        }

        const parsed = JSON.parse(raw) as Partial<DashboardSettings>
        return {
            apiBaseUrl: normalizeBaseUrl(parsed.apiBaseUrl),
            sdkUrl: typeof parsed.sdkUrl === "string" ? parsed.sdkUrl.trim() : DEFAULT_SETTINGS.sdkUrl,
            defaultModel: typeof parsed.defaultModel === "string" ? parsed.defaultModel.trim() : DEFAULT_SETTINGS.defaultModel,
            defaultBackend: parsed.defaultBackend === "sdk" ? "sdk" : "cli",
            defaultParallel: clampParallel(parsed.defaultParallel),
            defaultTimeout: normalizeTimeout(parsed.defaultTimeout),
        }
    } catch {
        return DEFAULT_SETTINGS
    }
}

export function saveStoredSettings(nextSettings: Partial<DashboardSettings>): DashboardSettings {
    const merged: DashboardSettings = {
        ...getStoredSettings(),
        ...nextSettings,
    }

    const normalized: DashboardSettings = {
        apiBaseUrl: normalizeBaseUrl(merged.apiBaseUrl),
        sdkUrl: merged.sdkUrl.trim(),
        defaultModel: merged.defaultModel.trim(),
        defaultBackend: merged.defaultBackend === "sdk" ? "sdk" : "cli",
        defaultParallel: clampParallel(merged.defaultParallel),
        defaultTimeout: normalizeTimeout(merged.defaultTimeout),
    }

    if (typeof window !== "undefined") {
        window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(normalized))
    }

    return normalized
}

export function getDefaultApiBaseUrl(): string {
    return ENV_API_BASE_URL
}