export interface Env {
    DB: D1Database;
    AVATAR_KV: KVNamespace;
    SEB: any; // Cloudflare Email Binding
    TURNSTILE_SECRET?: string;
    SENDER_EMAIL: string;
    ADMIN_EMAIL: string;
    ADMIN_SECRET?: string;
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
