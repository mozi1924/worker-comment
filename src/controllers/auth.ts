import { Context } from 'hono';
import { Env } from '../types';
import { errorResponse, jsonResponse } from '../utils';
import { validateTurnstile } from '../lib/turnstile';
import { sendEmail } from '../lib/email';
import { signJwt } from '../lib/jwt';

export const sendCode = async (c: Context<{ Bindings: Env }>) => {
    try {
        const { email, turnstile_token } = await c.req.json<{ email: string, turnstile_token: string }>();
        const env = c.env;
        const ip = c.req.header('CF-Connecting-IP') || '127.0.0.1';

        // 1. Validate Turnstile
        const turnstileSecret = c.env.TURNSTILE_SECRET;
        if (!turnstileSecret) {
             console.error('SERVER CONFIG ERROR: TURNSTILE_SECRET is missing during Auth!');
             return errorResponse('Server configuration error', 500);
        }
        
        if (!turnstile_token) {
             return errorResponse('Turnstile token required', 400);
        }
 
        const turnstileValid = await validateTurnstile(turnstile_token, turnstileSecret, ip);
        if (!turnstileValid) {
            return errorResponse('Turnstile validation failed', 403);
        }

        // 2. Generate Code
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const key = `auth_otp:${email.trim().toLowerCase()}`;
        
        // 3. Store in KV (TTL 10 mins)
        await env.AVATAR_KV.put(key, code, { expirationTtl: 600 });
        
        // 4. Send Email
        const sent = await sendEmail(
            env,
            email,
            'Your Login Code',
            `Your login verification code is: <strong>${code}</strong><br>It expires in 10 minutes.<br><br>If you did not request this, please ignore this email.`,
            `Your login verification code is: ${code}`,
            'Admin Login'
        );

        if (!sent) {
            return errorResponse('Failed to send verification email. Please contact support.', 500);
        }

        return jsonResponse({ success: true, message: 'Code sent (if email is valid)' });
    } catch (e: any) {
        console.error('Auth Send Code Error:', e);
        return errorResponse('Internal Server Error', 500);
    }
};

export const verifyCode = async (c: Context<{ Bindings: Env }>) => {
    try {
        const { email, code } = await c.req.json<{ email: string, code: string }>();
        const key = `auth_otp:${email.trim().toLowerCase()}`;
        
        const storedCode = await c.env.AVATAR_KV.get(key);
        if (!storedCode || storedCode !== code) {
            return errorResponse('Invalid or expired code', 403);
        }
        
        // Consume code
        await c.env.AVATAR_KV.delete(key);
        
        // Check Admin
        const env = c.env;
        const adminConfig = env.ADMIN_EMAIL || '';
        const allowedAdmins = adminConfig.split(',').map(r => r.trim().toLowerCase());
        
        if (!allowedAdmins.includes(email.trim().toLowerCase())) {
            return errorResponse('Access Denied: This email is not authorized as an administrator.', 403);
        }

        // Generate Token
        const secret = c.env.ADMIN_SECRET || 'changeme_to_something_secure_in_production';
        const token = await signJwt({ email, exp: Math.floor(Date.now()/1000) + (7 * 24 * 60 * 60) }, secret); // 7 days
        
        return jsonResponse({ success: true, token });
    } catch (e: any) {
        return errorResponse(e.message, 500);
    }
};
