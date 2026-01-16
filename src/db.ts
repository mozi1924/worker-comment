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

// New optimized fetch for Root Comments
export async function getRootComments(db: D1Database, siteId: string, page: number = 1, pageSize: number = 10) {
    const offset = (page - 1) * pageSize;
    // 1. Fetch Root Comments
    const { results } = await db.prepare(
        `SELECT id, site_id, parent_id, content, author_name, email_md5, avatar_id, context_url, created_at, is_admin
     FROM comments 
     WHERE site_id = ? AND parent_id IS NULL
     ORDER BY created_at DESC 
     LIMIT ? OFFSET ?`
    ).bind(siteId, pageSize, offset).all<Comment & { is_admin: number }>();

    // 2. Fetch Metadata (Reply Count & Admin Reply) for each root comment
    // We use Promise.all to parallelize these sub-queries. D1 handles this well.
    const commentsWithMeta = await Promise.all(results.map(async (c) => {
        // Count all replies
        const countRes = await db.prepare(
            `SELECT COUNT(*) as count FROM comments WHERE parent_id = ?`
        ).bind(c.id).first<{ count: number }>();

        // Get one admin reply if exists
        const adminReply = await db.prepare(
            `SELECT id, site_id, parent_id, content, author_name, email_md5, avatar_id, context_url, created_at, is_admin
       FROM comments 
       WHERE parent_id = ? AND is_admin = 1 
       ORDER BY created_at ASC 
       LIMIT 1`
        ).bind(c.id).first<Comment>();

        return {
            ...c,
            reply_count: countRes?.count || 0,
            admin_reply: adminReply || null
        };
    }));

    // 3. Get Total Root Count for pagination
    const countResult = await db.prepare(
        `SELECT COUNT(*) as count FROM comments WHERE site_id = ? AND parent_id IS NULL`
    ).bind(siteId).first<{ count: number }>();

    return {
        comments: commentsWithMeta,
        total: countResult?.count || 0,
        page,
        pageSize
    };
}

// Lazy load replies with cursor pagination (limit + 1 to check for next page)
export async function getReplies(db: D1Database, parentId: number, lastId?: number, limit: number = 10) {
    let query = `SELECT id, site_id, parent_id, content, author_name, email_md5, avatar_id, context_url, created_at, is_admin
               FROM comments 
               WHERE parent_id = ?`;
    const params: any[] = [parentId];

    if (lastId) {
        query += ` AND id < ?`;
        params.push(lastId);
    }

    query += ` ORDER BY id DESC LIMIT ?`;
    params.push(limit + 1); // Fetch one extra to determine if there are more

    const { results } = await db.prepare(query).bind(...params).all<Comment>();
    
    const hasMore = results.length > limit;
    const replies = hasMore ? results.slice(0, limit) : results;

    return {
        replies,
        hasMore,
        lastId: replies.length > 0 ? replies[replies.length - 1].id : null
    };
}

export async function getCommentAuthor(db: D1Database, commentId: number): Promise<{ email: string, author_name: string } | null> {
    return await db.prepare(
        `SELECT email, author_name FROM comments WHERE id = ?`
    ).bind(commentId).first<{ email: string, author_name: string } | null>();
}