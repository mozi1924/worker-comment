import { md5 } from '../utils';

export async function processAvatar(KV: KVNamespace, email: string) {
    const emailMd5 = await md5(email.trim().toLowerCase());
    const avatarId = emailMd5;

    // Background processing
    try {
        const existing = await KV.get(avatarId);
        if (!existing) {
            let avatarBuffer: ArrayBuffer | null = null;
            const qtMatch = email.match(/^(\d+)@qq\.com$/);
            if (qtMatch) {
                const qqRes = await fetch(`https://q1.qlogo.cn/g?b=qq&nk=${qtMatch[1]}&s=100`);
                if (qqRes.ok) avatarBuffer = await qqRes.arrayBuffer();
            }
            if (!avatarBuffer) {
                const gRes = await fetch(`https://www.gravatar.com/avatar/${emailMd5}?d=404`);
                if (gRes.ok) avatarBuffer = await gRes.arrayBuffer();
            }
            if (avatarBuffer) {
                await KV.put(avatarId, avatarBuffer, { expirationTtl: 60 * 60 * 24 * 7 });
            }
        }
    } catch (e) {
        console.error('Avatar processing error:', e);
    }
    
    return avatarId;
}

export async function getAvatar(KV: KVNamespace, id: string) {
    const avatar = await KV.get(id, 'arrayBuffer');
    return avatar;
}
