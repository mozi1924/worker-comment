
export async function md5(text: string): Promise<string> {
    const msgUint8 = new TextEncoder().encode(text);
    const hashBuffer = await crypto.subtle.digest('MD5', msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
}

export function jsonResponse(data: any, status = 200, extraHeaders = {}) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            'Content-Type': 'application/json',
            ...extraHeaders,
        },
    });
}

export function errorResponse(message: string, status = 400, extraHeaders = {}) {
    return jsonResponse({ error: message }, status, extraHeaders);
}

export const corsHeaders = (origin: string) => ({
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, DELETE',
    'Access-Control-Allow-Headers': 'Content-Type, Custom-Auth',
});

export const getSiteConfig = (config: string | object | undefined, siteId: string | undefined, defaultVal: string): string => {
    if (!config) return defaultVal;
    
    let confObj: any = config;

    // Handle string input (JSON or plain string)
    if (typeof config === 'string') {
        try {
            const trimmed = config.trim();
            if (trimmed.startsWith('{')) {
                confObj = JSON.parse(trimmed);
            } else {
                return config; // It's a plain string value
            }
        } catch (e) {
            return config; // Start with { but invalid JSON? Return as is.
        }
    }

    // Handle Object (Already object or parsed JSON)
    if (typeof confObj === 'object' && confObj !== null) {
        if (siteId && confObj[siteId]) {
            return confObj[siteId];
        }
        if (confObj['default']) {
            return confObj['default'];
        }
        // Fallback to first value if no default and no specific match
        const values = Object.values(confObj);
        if (values.length > 0 && typeof values[0] === 'string') {
            return values[0] as string;
        }
    }

    return defaultVal;
};
