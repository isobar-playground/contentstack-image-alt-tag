import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { ContentstackAPIError } from "./types";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

export function parseContentstackError(error: unknown): string {
    if (typeof error !== 'object' || error === null) {
        return String(error);
    }

    const apiError = error as ContentstackAPIError;

    try {
        if (apiError.message?.includes('errorMessage')) {
            const parsed = JSON.parse(apiError.message);
            if (parsed.errorMessage) return parsed.errorMessage;
            if (Array.isArray(parsed.errors) && parsed.errors.length > 0) {
                return parsed.errors.map((err: any) => err?.message || JSON.stringify(err)).join(', ');
            }
        }
    } catch {
    }

    return apiError.errorMessage || apiError.message || 'An unknown error occurred.';
}
