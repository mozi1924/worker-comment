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

    let siteIds: string[] = [];

    if (body.email) {
        const emailMd5 = await md5(body.email.trim().toLowerCase());
        // Get sites to invalidate
        const sites = await c.env.DB.prepare('SELECT DISTINCT site_id FROM comments WHERE email_md5 = ?').bind(emailMd5).all<{ site_id: string }>();
        siteIds = sites.results.map(s => s.site_id);

        await c.env.DB.prepare('DELETE FROM comments WHERE email_md5 = ?').bind(emailMd5).run();
        
        // Invalidate
        const nowStr = new Date().toUTCString();
        c.executionCtx.waitUntil(Promise.all(siteIds.map(sid => c.env.AVATAR_KV.put(`cache:site:${sid}`, nowStr))));

        return jsonResponse({ success: true, message: `Deleted comments for ${body.email}` });
    }

    if (body.ids && Array.isArray(body.ids) && body.ids.length > 0) {
        const placeholders = body.ids.map(() => '?').join(',');
        
        // Get sites to invalidate
        const sites = await c.env.DB.prepare(`SELECT DISTINCT site_id FROM comments WHERE id IN (${placeholders})`).bind(...body.ids).all<{ site_id: string }>();
        siteIds = sites.results.map(s => s.site_id);

        await c.env.DB.prepare(`DELETE FROM comments WHERE id IN (${placeholders})`)
            .bind(...body.ids)
            .run();

        // Invalidate
        const nowStr = new Date().toUTCString();
        c.executionCtx.waitUntil(Promise.all(siteIds.map(sid => c.env.AVATAR_KV.put(`cache:site:${sid}`, nowStr))));

        return jsonResponse({ success: true, message: `Deleted ${body.ids.length} comments` });
    }

    return errorResponse('Missing ids or email');
};

export const deleteComment = async (c: Context<{ Bindings: Env }>) => {
    const id = c.req.param('id');
    
    // Get site_id to invalidate
    const comment = await c.env.DB.prepare('SELECT site_id FROM comments WHERE id = ?').bind(id).first<{ site_id: string }>();
    
    await c.env.DB.prepare('DELETE FROM comments WHERE id = ?').bind(id).run();
    
    if (comment && comment.site_id) {
        const nowStr = new Date().toUTCString();
        c.executionCtx.waitUntil(c.env.AVATAR_KV.put(`cache:site:${comment.site_id}`, nowStr));
    }
    
    return jsonResponse({ success: true });
};
