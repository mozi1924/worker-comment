export interface Env {
    DB: D1Database;
    AVATAR_KV: KVNamespace;
    SEB: any; // Cloudflare Email Binding
    TURNSTILE_SECRET?: string;
    SENDER_EMAIL: string;
    ADMIN_EMAIL: string;
    ADMIN_SECRET?: string; // Added for simple auth
    [key: string]: any;
}

export interface Comment {
    id?: number;
    site_id: string;
    parent_id: number | null;
    content: string;
    author_name: string;
    email?: string; // Raw email
    email_md5: string;
    avatar_id: string;
    ip_address: string;
    user_agent: string;
    context_url?: string;
    created_at: number;
}

export async function insertComment(db: D1Database, comment: Comment) {
    return await db.prepare(
        `INSERT INTO comments (site_id, parent_id, content, author_name, email, email_md5, avatar_id, ip_address, user_agent, context_url, created_at) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
        comment.site_id,
        comment.parent_id,
        comment.content,
        comment.author_name,
        comment.email || null, // Store raw email
        comment.email_md5,
        comment.avatar_id,
        comment.ip_address,
        comment.user_agent,
        comment.context_url || null,
        comment.created_at
    ).run();
}

export async function getComments(db: D1Database, siteId: string, page: number = 1, pageSize: number = 10) {
    const offset = (page - 1) * pageSize;
    // NOTE: We deliberately do NOT select 'email' here to prevent leaking it to the frontend
    const results = await db.prepare(
        `SELECT id, site_id, parent_id, content, author_name, email_md5, avatar_id, context_url, created_at 
     FROM comments 
     WHERE site_id = ? 
     ORDER BY created_at DESC 
     LIMIT ? OFFSET ?`
    ).bind(siteId, pageSize, offset).all();

    const countResult = await db.prepare(
        `SELECT COUNT(*) as count FROM comments WHERE site_id = ?`
    ).bind(siteId).first();

    return {
        comments: results.results,
        total: countResult?.count || 0,
        page,
        pageSize
    };
}

export async function getCommentAuthor(db: D1Database, commentId: number): Promise<{ email: string, author_name: string } | null> {
    return await db.prepare(
        `SELECT email, author_name FROM comments WHERE id = ?`
    ).bind(commentId).first<{ email: string, author_name: string } | null>();
}