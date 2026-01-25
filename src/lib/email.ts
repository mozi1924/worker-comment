import { Env } from '../types';

export async function sendEmail(
    env: Env, 
    to: string, 
    subject: string, 
    htmlContent: string, 
    plainContent: string,
    senderName: string = 'Comment System',
    siteId?: string,
    extraHeaders: Record<string, string> = {}
) {
    if (!env.EMAIL_API_URL || !env.EMAIL_API_KEY) {
        console.error('[Email] API Configuration Missing: EMAIL_API_URL or EMAIL_API_KEY not set.');
        return false;
    }

    try {
        console.log(`[Email] Sending to ${to} via External API...`);
        
        const payload = {
            to: to,
            subject: subject,
            html: htmlContent,
            text: plainContent,
            headers: extraHeaders
        };

        const response = await fetch(env.EMAIL_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': env.EMAIL_API_KEY
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[Email] External API Error: ${response.status} ${response.statusText} - ${errorText}`);
            return false;
        }

        const result = await response.json();
        console.log(`[Email] Successfully sent to ${to}. Response:`, result);
        return true;
    } catch (e) {
        console.error(`[Email] Failed to send to ${to}:`, e);
        return false;
    }
}
