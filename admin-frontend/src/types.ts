export interface Comment {
    id: number;
    site_id: string;
    content: string;
    author_name: string;
    email_md5: string;
    created_at: number;
    context_url?: string;
    ip_address?: string;
}
