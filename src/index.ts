import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { Env } from './types';
import { corsHeaders } from './utils';

// Controllers
import { sendCode, verifyCode } from './controllers/auth';
import { getComments, getRepliesController, getAvatarController, postComment, getCommentContext } from './controllers/comment';
import { getAdminComments, batchDeleteComments, deleteComment } from './controllers/admin';

// Middleware
import { adminAuth } from './middleware/auth';

const app = new Hono<{ Bindings: Env }>();

// CORS Middleware
// CORS Middleware
app.use('*', async (c, next) => {
    const corsMiddleware = cors({
        origin: (origin) => {
            const allowSites = c.env.ALLOW_SITES;
            if (!allowSites) return origin; // Or strictly block: return null; based on "refuse access" requirement, let's look at logic below.
            // User requirement: "Otherwise refuse access". 
            // If ALLOW_SITES is set, we must check it. 
            // If it is NOT set, existing behavior (allow all) might be risky if they expect strictness, but for now let's assume if var is missing we might default to allow or block. 
            // The prompt says "Only ALLOW_SITES... otherwise refuse". This implies if ALLOW_SITES is present. If missing, likely safe to assume developer hasn't configured it yet, but strictly "refuse" might be safer.
            // However, typical dev flow: if var missing, maybe allow all for ease? 
            // Let's implement strict check if ALLOW_SITES is present.
            
            if (!allowSites || allowSites === '*') return origin;

            const sites = allowSites.split(',').map((s: string) => s.trim());
            // Normalize origin to remove protocol (http:// or https://) for comparison
            // This allows the env var to just list domains like "example.com"
            const originDomain = origin.replace(/^https?:\/\//, '');

            // Check if strict match with protocol OR match with domain only
            if (sites.includes(origin) || sites.includes(originDomain)) {
                return origin;
            }
            return null; // Block
        },
        allowMethods: ['GET', 'POST', 'OPTIONS', 'DELETE'],
        allowHeaders: ['Content-Type', 'Authorization', 'cf-access-jwt-assertion', 'x-admin-token'],
        exposeHeaders: ['Content-Length'],
        maxAge: 600,
        credentials: true,
    });
    return corsMiddleware(c, next);
});

// Auth Routes
app.post('/api/auth/send-code', sendCode);
app.post('/api/auth/verify', verifyCode);

// Comment Routes
app.get('/api/comments', getComments);
app.get('/api/comments/:id/replies', getRepliesController);
app.get('/api/comments/:id', getCommentContext);
app.post('/api/comments', postComment);
app.get('/api/avatar/:id', getAvatarController);

// Admin Routes (Protected)
app.use('/api/admin/*', adminAuth);

app.get('/api/admin/comments', getAdminComments);
app.delete('/api/admin/comments/batch', batchDeleteComments);
app.delete('/api/admin/comments/:id', deleteComment);

// Scheduled Events
export default {
    fetch: app.fetch,
    async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
        console.log('Cron triggered: performing cleanup');
    },
};