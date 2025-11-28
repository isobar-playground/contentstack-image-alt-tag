import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { ContentstackAPIError } from "./types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function parseContentstackError(error: unknown): string {
    let message = 'An unknown error occurred.';

    try {
        if (typeof error === 'object' && error !== null) {
            const apiError = error as ContentstackAPIError;
            if (apiError.message) {
                // Try to parse if message contains JSON for more details
                if (apiError.message.includes('errorMessage')) {
                    try {
                        const parsed = JSON.parse(apiError.message);
                        if (parsed.errorMessage) {
                            message = parsed.errorMessage;
                        } else if (parsed.errors && Array.isArray(parsed.errors) && parsed.errors.length > 0) {
                            message = parsed.errors.map((err: unknown) => {
                                if (typeof err === 'object' && err !== null && 'message' in err && typeof err.message === 'string') {
                                    return err.message;
                                }
                                return JSON.stringify(err);
                            }).join(', ');
                        }
                    } catch {
                        // Fallback to original message if JSON parsing fails
                        message = apiError.message;
                    }
                } else {
                    message = apiError.message;
                }
            } else if (apiError.errorMessage) {
                // Sometimes errorMessage is a direct property
                message = apiError.errorMessage;
            }
        } else {
            // Handle non-object errors (e.g., string literals)
            message = String(error);
        }
    } catch (e) {
        console.error('Error while processing error object in parseContentstackError:', e);
        // Fallback message remains
    }

    return message;
}
