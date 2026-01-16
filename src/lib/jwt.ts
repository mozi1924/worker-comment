export async function signJwt(payload: any, secret: string) {
    const header = { alg: 'HS256', typ: 'JWT' };
    const encodedHeader = btoa(JSON.stringify(header));
    const encodedPayload = btoa(JSON.stringify(payload));
    const signatureInput = `${encodedHeader}.${encodedPayload}`;
    
    const key = await crypto.subtle.importKey(
        'raw', 
        new TextEncoder().encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false, 
        ['sign']
    );
    const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signatureInput));
    const encodedSignature = btoa(String.fromCharCode(...new Uint8Array(signature))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    
    return `${signatureInput}.${encodedSignature}`;
}

export async function verifyJwt(token: string, secret: string) {
    try {
        const [encodedHeader, encodedPayload, encodedSignature] = token.split('.');
        if (!encodedHeader || !encodedPayload || !encodedSignature) return null;

        const signatureInput = `${encodedHeader}.${encodedPayload}`;
        const key = await crypto.subtle.importKey(
            'raw', 
            new TextEncoder().encode(secret),
            { name: 'HMAC', hash: 'SHA-256' },
            false, 
            ['verify']
        );
        
        // Fix base64url to base64
        let base64Signature = encodedSignature.replace(/-/g, '+').replace(/_/g, '/');
        while (base64Signature.length % 4) base64Signature += '=';
        
        const signature = Uint8Array.from(atob(base64Signature), c => c.charCodeAt(0));
        const isValid = await crypto.subtle.verify('HMAC', key, signature, new TextEncoder().encode(signatureInput));
        
        if (!isValid) return null;
        return JSON.parse(atob(encodedPayload));
    } catch (e) {
        return null;
    }
}
