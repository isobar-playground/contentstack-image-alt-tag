export const DEFAULT_SESSION_KEY_FILENAME = 'session.key';

export function downloadSessionKey(key: string, filename = DEFAULT_SESSION_KEY_FILENAME) {
    const blob = new Blob([key], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    setTimeout(() => {
        URL.revokeObjectURL(url);
    }, 0);
}

export async function readSessionKeyFile(file: File): Promise<string> {
    const text = await file.text();
    return text.trim();
}
