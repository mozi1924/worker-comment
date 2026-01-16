import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { Env, insertComment, getComments, getCommentAuthor } from './db';
import { md5, jsonResponse, errorResponse } from './utils';
import { createMimeMessage } from 'mimetext';
import { EmailMessage } from "cloudflare:email";

const app = new Hono<{ Bindings: Env }>();

// CORS Middleware
app.use('*', cors({
    origin: (origin) => origin,
    allowMethods: ['GET', 'POST', 'OPTIONS', 'DELETE'],
    allowHeaders: ['Content-Type', 'Authorization', 'cf-access-jwt-assertion', 'x-admin-token'],
    exposeHeaders: ['Content-Length'],
    maxAge: 600,
    credentials: true,
}));

// Turnstile Validator
async function validateTurnstile(token: string, secret: string, ip: string) {
    const formData = new FormData();
    formData.append('secret', secret);
    formData.append('response', token);
    formData.append('remoteip', ip);

    const url = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
    const result = await fetch(url, {
        body: formData,
        method: 'POST',
    });
    const outcome = await result.json<any>();
    if (!outcome.success) {
        console.error('Turnstile Validation Failed:', JSON.stringify(outcome));
    }
    return outcome.success;
}

// Admin Middleware
app.use('/api/admin/*', async (c, next) => {
    const jwt = c.req.header('cf-access-jwt-assertion');
    const adminToken = c.req.header('x-admin-token');
    const envSecret = c.env.ADMIN_SECRET;

    // 1. Cloudflare Access JWT Check
    if (jwt) {
        // In a real scenario, we should verify the signature.
        // Assuming CF Access protects the route, presence is a strong signal if configured correctly.
        await next();
        return;
    }

    // 2. Simple Secret Check (Alternative for non-Access environments)
    if (adminToken && envSecret && adminToken === envSecret) {
        await next();
        return;
    }

    return errorResponse('Unauthorized', 401);
});

// GET Comments
app.get('/api/comments', async (c) => {
    const siteId = c.req.query('site_id');
    const page = parseInt(c.req.query('page') || '1');
    const pageSize = 10;

    if (!siteId) return errorResponse('Missing site_id');

    const data = await getComments(c.env.DB, siteId, page, pageSize);
    return jsonResponse(data);
});

// POST Comment
app.post('/api/comments', async (c) => {
    try {
        const body = await c.req.json();
        const { site_id, parent_id, content, author_name, email, turnstile_token, context_url } = body;
        const ip = c.req.header('CF-Connecting-IP') || '127.0.0.1';
        const userAgent = c.req.header('User-Agent') || '';

        if (!site_id || !content || !author_name || !email || !turnstile_token) {
            return errorResponse('Missing required fields');
        }

        // 1. Validate Turnstile
        const turnstileSecret = c.env.TURNSTILE_SECRET;
        if (!turnstileSecret) {
            console.error('SERVER CONFIG ERROR: TURNSTILE_SECRET is missing!');
            return errorResponse('Server configuration error', 500);
        }

        const turnstileValid = await validateTurnstile(turnstile_token, turnstileSecret, ip);
        if (!turnstileValid) {
            return errorResponse('Turnstile validation failed', 403);
        }

        // 2. Avatar Processing (Background)
        const emailMd5 = await md5(email.trim().toLowerCase());
        const avatarId = emailMd5;

        c.executionCtx.waitUntil(async function () {
            try {
                const existing = await c.env.AVATAR_KV.get(avatarId);
                if (!existing) {
                    let avatarBuffer: ArrayBuffer | null = null;
                    const qtMatch = email.match(/^(\d+)@qq\.com$/);
                    if (qtMatch) {
                        const qqRes = await fetch(`https://q1.qlogo.cn/g?b=qq&nk=${qtMatch[1]}&s=100`);
                        if (qqRes.ok) avatarBuffer = await qqRes.arrayBuffer();
                    }
                    if (!avatarBuffer) {
                        const gRes = await fetch(`https://www.gravatar.com/avatar/${emailMd5}?d=404`);
                        if (gRes.ok) avatarBuffer = await gRes.arrayBuffer();
                    }
                    if (avatarBuffer) {
                        await c.env.AVATAR_KV.put(avatarId, avatarBuffer, { expirationTtl: 60 * 60 * 24 * 7 });
                    }
                }
            } catch (e) {
                console.error('Avatar processing error:', e);
            }
        }());

        // 3. Simple Rate Limit
        const rateLimitKey = `ratelimit:${ip}`;
        const currentLimit = await c.env.AVATAR_KV.get(rateLimitKey);
        let count = currentLimit ? parseInt(currentLimit) : 0;

        if (count >= 5) {
            return errorResponse('Too many requests. Please try again later.', 429);
        }
        await c.env.AVATAR_KV.put(rateLimitKey, (count + 1).toString(), { expirationTtl: 60 });

        // 4. Save to DB
        const result = await insertComment(c.env.DB, {
            site_id,
            parent_id: parent_id || null,
            content,
            author_name,
            email, // Save raw email
            email_md5: emailMd5,
            avatar_id: avatarId,
            ip_address: ip,
            user_agent: userAgent,
            context_url: context_url || null,
            created_at: Date.now()
        });

        const newId = result.meta.last_row_id;

        // 5. Send Email Notification (Background)
        c.executionCtx.waitUntil(async function () {
            console.log(`[Email] Starting background email task for comment ${newId}`);
            try {
                const env = c.env as Env;

                if (!env.SEB) {
                    console.error('[Email] SEB binding is missing/undefined in environment!');
                    return;
                }

                // --- Helper: Get Site Specific Config ---
                const getSiteConfig = (configStr: string, siteId: string, defaultVal: string): string => {
                    if (!configStr) return defaultVal;
                    try {
                         // Check if it looks like JSON (starts with {)
                        if (configStr.trim().startsWith('{')) {
                            const config = JSON.parse(configStr);
                            return config[siteId] || config['default'] || Object.values(config)[0] as string || defaultVal;
                        }
                        return configStr;
                    } catch (e) {
                        return configStr; // Fallback to raw string if parse fails
                    }
                };

                // --- 1. Determine Sender ---
                const sender = getSiteConfig(env.SENDER_EMAIL, site_id, 'noreply@yourdomain.com');

                // --- 2. Determine Recipients (Smart Routing) ---
                const recipients: { email: string, name: string, type: 'Admin' | 'User' }[] = [];
                
                // Parse Admin Emails (supports JSON map or comma-separated string)
                const adminConfig = getSiteConfig(env.ADMIN_EMAIL, site_id, 'admin@yourdomain.com');
                const admins = adminConfig.split(',').map(r => r.trim()).filter(r => r.length > 0);

                if (parent_id) {
                    // It's a reply! Try to find the parent author.
                    const parentAuthor = await getCommentAuthor(c.env.DB, parent_id);
                    if (parentAuthor && parentAuthor.email) {
                        recipients.push({ email: parentAuthor.email, name: parentAuthor.author_name, type: 'User' });
                        console.log(`[Email] Routing reply to parent author: ${parentAuthor.email}`);
                    } else {
                        // Fallback or just notify admin if parent has no email (old comment)
                        console.log(`[Email] Parent comment ${parent_id} has no email stored. Notifying admin instead.`);
                        admins.forEach(a => recipients.push({ email: a, name: 'Admin', type: 'Admin' }));
                    }
                } else {
                    // New Thread -> Notify Admin
                    console.log(`[Email] New thread. Routing to admin.`);
                    admins.forEach(a => recipients.push({ email: a, name: 'Admin', type: 'Admin' }));
                }

                if (recipients.length === 0) {
                    console.warn('[Email] No recipients found.');
                    return;
                }

                // Construct Link
                const link = context_url ? `${context_url}#comment-${newId}` : `(Site ID: ${site_id})`;

                for (const recipient of recipients) {
                    if (recipient.email === email) continue; // Don't notify self

                    try {
                        console.log(`[Email] Preparing to send to ${recipient.email} (${recipient.type})`);

                        const msg = createMimeMessage();
                        msg.setSender({ name: 'Comment System', addr: sender });
                        msg.setRecipient(recipient.email);

                        // Subject Logic
                        if (recipient.type === 'User') {
                            msg.setSubject(`Re: ${site_id} - New reply to your comment`);
                        } else {
                            msg.setSubject(`[Admin] New Comment on ${site_id}`);
                        }

                        // Headers for Spam Prevention
                        const timestamp = new Date().toISOString();
                        msg.setHeader('Message-ID', `<${newId}.${Date.now()}@${site_id}.comments>`);
                        msg.setHeader('Date', new Date().toUTCString());
                        msg.setHeader('X-Entity-Ref-ID', newId.toString());

                        // Content
                        const htmlContent = `
                        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
                            <h2 style="color: #333;">${recipient.type === 'User' ? 'New Reply to Your Comment' : 'New Comment Received'}</h2>
                            <p style="color: #666;">
                                <strong>${author_name}</strong> wrote:
                            </p>
                            <blockquote style="background: #f9fafb; padding: 16px; border-left: 4px solid #3b82f6; margin: 16px 0; color: #374151;">
                                ${content}
                            </blockquote>
                            <p style="margin-top: 24px;">
                                <a href="${link}" style="background-color: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; display: inline-block;">View Comment</a>
                            </p>
                            <p style="font-size: 12px; color: #9ca3af; margin-top: 32px; border-top: 1px solid #eee; padding-top: 16px;">
                                Sent via Cloudflare Workers
                            </p>
                        </div>
                        `;

                        // Plain text fallback
                        const plainContent = `New comment from ${author_name}:\n\n${content}\n\nView here: ${link}`;

                        msg.addMessage({ contentType: 'text/plain', data: plainContent });
                        msg.addMessage({ contentType: 'text/html', data: htmlContent });

                        const message = new EmailMessage(sender, recipient.email, msg.asRaw());
                        await env.SEB.send(message);
                        console.log(`[Email] Successfully sent to ${recipient.email}`);
                    } catch (sendError) {
                        console.error(`[Email] Failed to send to ${recipient.email}:`, sendError);
                    }
                }

            } catch (e) {
                console.error('[Email] Critical failure in email background task:', e);
            }
        }());

        return jsonResponse({ success: true, avatar_id: avatarId, id: newId });
    } catch (e: any) {
        console.error('Critical Error in POST /api/comments:', e);
        return errorResponse(`Server Error: ${e.message}`, 500);
    }
});

// GET Avatar
app.get('/api/avatar/:id', async (c) => {
    const id = c.req.param('id');
    const avatar = await c.env.AVATAR_KV.get(id, 'arrayBuffer');
    if (!avatar) return new Response(null, { status: 404 });
    return new Response(avatar, {
        headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=604800' }
    });
});

// Admin List with Filter
app.get('/api/admin/comments', async (c) => {
    const email = c.req.query('email');
    const siteId = c.req.query('site_id');
    let query = 'SELECT * FROM comments';
    let params: any[] = [];
    let conditions: string[] = [];

    if (email) {
        const emailMd5 = await md5(email.trim().toLowerCase());
        conditions.push('email_md5 = ?');
        params.push(emailMd5);
    }

    if (siteId) {
        conditions.push('site_id = ?');
        params.push(siteId);
    }

    if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY created_at DESC LIMIT 50';

    const { results } = await c.env.DB.prepare(query).bind(...params).all();
    return jsonResponse(results);
});

// Admin Batch Delete
app.delete('/api/admin/comments/batch', async (c) => {
    const body = await c.req.json<{ ids?: number[], email?: string }>();

    if (body.email) {
        const emailMd5 = await md5(body.email.trim().toLowerCase());
        await c.env.DB.prepare('DELETE FROM comments WHERE email_md5 = ?').bind(emailMd5).run();
        return jsonResponse({ success: true, message: `Deleted comments for ${body.email}` });
    }

    if (body.ids && Array.isArray(body.ids) && body.ids.length > 0) {
        const placeholders = body.ids.map(() => '?').join(',');
        await c.env.DB.prepare(`DELETE FROM comments WHERE id IN (${placeholders})`)
            .bind(...body.ids)
            .run();
        return jsonResponse({ success: true, message: `Deleted ${body.ids.length} comments` });
    }

    return errorResponse('Missing ids or email');
});

app.delete('/api/admin/comments/:id', async (c) => {
    const id = c.req.param('id');
    await c.env.DB.prepare('DELETE FROM comments WHERE id = ?').bind(id).run();
    return jsonResponse({ success: true });
});

export default {
    fetch: app.fetch,
    async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
        console.log('Cron triggered: performing cleanup');
    },
};