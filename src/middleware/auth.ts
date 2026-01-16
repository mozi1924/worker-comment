import { Context, Next } from 'hono';
import { verifyJwt } from '../lib/jwt';
import { errorResponse } from '../utils';
import { Env } from '../types';

export const adminAuth = async (c: Context<{ Bindings: Env }>, next: Next) => {
    const authHeader = c.req.header('Authorization');
    const secret = c.env.ADMIN_SECRET || 'changeme_to_something_secure_in_production';
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        const payload = await verifyJwt(token, secret);
        if (payload && payload.email) {
            // Valid Admin
            await next();
            return;
        }
    }
    
    return errorResponse('Unauthorized', 401);
};
