import { Context } from 'hono';
import { Env } from '../types';
import { errorResponse, jsonResponse, md5 } from '../utils';

export const getAdminComments = async (c: Context<{ Bindings: Env }>) => {
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
};

export const batchDeleteComments = async (c: Context<{ Bindings: Env }>) => {
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
};

export const deleteComment = async (c: Context<{ Bindings: Env }>) => {
    const id = c.req.param('id');
    await c.env.DB.prepare('DELETE FROM comments WHERE id = ?').bind(id).run();
    return jsonResponse({ success: true });
};
