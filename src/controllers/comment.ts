import { Context } from 'hono';
import { Env, Comment } from '../types';
import { errorResponse, jsonResponse, md5, getSiteConfig } from '../utils';
import { validateTurnstile } from '../lib/turnstile';
import { processAvatar, getAvatar } from '../lib/avatar';
import { sendEmail } from '../lib/email';
import { insertComment, getRootComments, getReplies, getCommentAuthor } from '../db';

export const getComments = async (c: Context<{ Bindings: Env }>) => {
    const siteId = c.req.query('site_id');
    const page = parseInt(c.req.query('page') || '1');
    const pageSize = 10;

    if (!siteId) return errorResponse('Missing site_id');

    // Smart Caching: Check Last-Modified
    const cacheKey = `cache:site:${siteId}`;
    let lastUpdated = await c.env.AVATAR_KV.get(cacheKey);

    // If never set before, default to "now" so we set it for future
    if (!lastUpdated) {
        lastUpdated = new Date().toUTCString();
        // WaitUntil not critical here, but good practice to seed if missing? 
        // Actually if missing, we just fetch DB. We'll set it on next POST.
        // For now, let's treat "missing" as "fresh content available".
    }

    const ifModifiedSince = c.req.header('If-Modified-Since');
    
    // Only use cache if we found a timestamp AND it matches
    if (lastUpdated && ifModifiedSince === lastUpdated) {
        return new Response(null, {
            status: 304,
            headers: {
                'Cache-Control': 'public, no-cache', // Must revalidate
                'Last-Modified': lastUpdated
            }
        });
    }

    const contextUrl = c.req.query('context_url');
    const data = await getRootComments(c.env.DB, siteId, page, pageSize, contextUrl);

    return jsonResponse(data, 200, {
        'Cache-Control': 'public, no-cache',
        'Last-Modified': lastUpdated || new Date().toUTCString() // Fallback if KV empty
    });
};

export const getRepliesController = async (c: Context<{ Bindings: Env }>) => {
    const parentId = parseInt(c.req.param('id'));
    const lastId = c.req.query('last_id') ? parseInt(c.req.query('last_id')!) : undefined;
    const limit = parseInt(c.req.query('limit') || '10');

    if (isNaN(parentId)) return errorResponse('Invalid comment ID');

    const data = await getReplies(c.env.DB, parentId, lastId, limit);
    return jsonResponse(data);
};

export const getAvatarController = async (c: Context<{ Bindings: Env }>) => {
    const id = c.req.param('id');
    const avatar = await getAvatar(c.env.AVATAR_KV, id);
    if (!avatar) return new Response(null, { status: 404 });
    return new Response(avatar, {
        headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=604800' }
    });
};

export const postComment = async (c: Context<{ Bindings: Env }>) => {
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
        let avatarId = '';
        c.executionCtx.waitUntil(async function () {
            avatarId = await processAvatar(c.env.AVATAR_KV, email);
        }());
        // We need avatarId synchronously for DB though, simplified processAvatar logic?
        // Actually processAvatar returns avatarId but also does async fetch.
        // Let's call it to get the ID, and let it run background tasks.
        const emailMd5 = await md5(email.trim().toLowerCase());
        avatarId = emailMd5;
        c.executionCtx.waitUntil(processAvatar(c.env.AVATAR_KV, email));


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
            email, 
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
                if (!env.EMAIL_API_URL || !env.EMAIL_API_KEY) return;

                const recipients: { email: string, name: string, type: 'Admin' | 'User' }[] = [];
                
                // Parse Admin Emails (using shared utility)
                const adminConfig = getSiteConfig(env.ADMIN_EMAIL, site_id, 'admin@yourdomain.com');
                const admins = adminConfig.split(',').map((r: string) => r.trim()).filter((r: string) => r.length > 0);

                if (parent_id) {
                    const parentAuthor = await getCommentAuthor(c.env.DB, parent_id);
                    if (parentAuthor && parentAuthor.email) {
                        recipients.push({ email: parentAuthor.email, name: parentAuthor.author_name, type: 'User' });
                    }
                    
                    admins.forEach((a: string) => {
                        if (!recipients.find(r => r.email === a)) {
                            recipients.push({ email: a, name: 'Admin', type: 'Admin' });
                        }
                    });
                } else {
                    admins.forEach((a: string) => recipients.push({ email: a, name: 'Admin', type: 'Admin' }));
                }

                if (recipients.length === 0) return;

                const link = context_url ? `${context_url}#comment-${newId}` : `(Site ID: ${site_id})`;

                for (const recipient of recipients) {
                    if (recipient.email === email) continue;

                    const subject = recipient.type === 'User' 
                        ? `Re: ${site_id} - New reply to your comment` 
                        : `[Admin] New Comment on ${site_id}`;

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

                    const plainContent = `New comment from ${author_name}:\n\n${content}\n\nView here: ${link}`;

                    await sendEmail(
                        env, 
                        recipient.email, 
                        subject, 
                        htmlContent, 
                        plainContent, 
                        recipient.type === 'User' ? 'Comment System' : 'Comment System',
                        site_id,
                        {
                            'Message-ID': `<${newId}.${Date.now()}@${site_id}.comments>`,
                            'X-Entity-Ref-ID': newId.toString()
                        }
                    );
                }

            } catch (e) {
                console.error('[Email] Critical failure in email background task:', e);
            }
        }());

        // 6. Update Smart Cache Timestamp
        const nowStr = new Date().toUTCString();
        c.executionCtx.waitUntil(c.env.AVATAR_KV.put(`cache:site:${site_id}`, nowStr));

        return jsonResponse({ success: true, avatar_id: avatarId, id: newId });
    } catch (e: any) {
        console.error('Critical Error in POST /api/comments:', e);
        return errorResponse(`Server Error: ${e.message}`, 500);
    }
};
