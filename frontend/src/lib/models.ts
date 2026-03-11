import { apiUrl } from "@/lib/api"

export interface ModelOption {
    id: string
    name: string
}

interface ModelsResponse {
    models?: ModelOption[]
    error?: string | null
}

export async function fetchAvailableModels(signal?: AbortSignal): Promise<ModelsResponse> {
    const response = await fetch(apiUrl("/api/models"), { signal })
    const payload = await response.json().catch(() => ({ models: [], error: "Invalid API response" })) as ModelsResponse

    if (!response.ok) {
        throw new Error(payload.error || "Failed to load available models")
    }

    return {
        models: Array.isArray(payload.models) ? payload.models : [],
        error: payload.error || null,
    }
}