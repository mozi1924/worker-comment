export async function validateTurnstile(token: string, secret: string, ip: string) {
    const formData = new FormData();
    formData.append('secret', secret);
    formData.append('response', token);
    formData.append('remoteip', ip);

    const url = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
    const result = await fetch(url, {
        body: formData,
        method: 'POST',
    });
    const outcome = await result.json<any>();
    if (!outcome.success) {
        console.error('Turnstile Validation Failed:', JSON.stringify(outcome));
    }
    return outcome.success;
}
