import { createMimeMessage } from 'mimetext';
import { EmailMessage } from "cloudflare:email";
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
    const getSiteConfig = (configStr: string, siteId: string | undefined, defaultVal: string): string => {
        if (!configStr) return defaultVal;
        try {
            if (configStr.trim().startsWith('{')) {
                const config = JSON.parse(configStr);
                return (siteId && config[siteId]) || config['default'] || Object.values(config)[0] as string || defaultVal;
            }
            return configStr;
        } catch (e) {
            return configStr; 
        }
    };

    const sender = getSiteConfig(env.SENDER_EMAIL, siteId, 'noreply@yourdomain.com');

    try {
        const msg = createMimeMessage();
        msg.setSender({ name: senderName, addr: sender });
        msg.setRecipient(to);
        msg.setSubject(subject);
        
        Object.entries(extraHeaders).forEach(([key, value]) => {
            msg.setHeader(key, value);
        });

        msg.addMessage({ contentType: 'text/plain', data: plainContent });
        msg.addMessage({ contentType: 'text/html', data: htmlContent });

        const message = new EmailMessage(sender, to, msg.asRaw());
        await env.SEB.send(message);
        console.log(`[Email] Successfully sent to ${to}`);
        return true;
    } catch (e) {
        console.error(`[Email] Failed to send to ${to}:`, e);
        return false;
    }
}
