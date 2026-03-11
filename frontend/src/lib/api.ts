import { getDefaultApiBaseUrl, getStoredSettings } from "@/lib/preferences"

export function getApiBaseUrl() {
    return getStoredSettings().apiBaseUrl || getDefaultApiBaseUrl()
}

export function apiUrl(path: string) {
    const normalizedPath = path.startsWith("/") ? path : `/${path}`
    return `${getApiBaseUrl()}${normalizedPath}`
}
