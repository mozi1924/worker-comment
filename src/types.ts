export interface Env {
    DB: D1Database;
    AVATAR_KV: KVNamespace;
    MAX_REQUESTS_PER_MINUTE?: number;
    EMAIL_API_URL: string;
    EMAIL_API_KEY: string;
    TURNSTILE_SECRET?: string;
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
