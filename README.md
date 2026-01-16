# Cloudflare Worker Comment System

A serverless comment backend built with Cloudflare Workers, Hono, D1 (Database), and KV (Caching).

## Features

- **Store Comments**: Persist comments in Cloudflare D1 (SQLite).
- **Avatar Caching**: Caches Gravatar/QQ avatars in KV to reduce external requests.
- **Spam Protection**: Turnstile integration.
- **Email Notifications**:
  - Supports sending emails via Cloudflare Email Routing (or other bindings).
  - Smart routing: Replies notify the parent author; new threads notify the admin.
  - **Multi-site Support**: Configure different sender and admin emails for different websites using the same worker.
- **Admin API**: View and delete comments.

## Deployment

### Prerequisites

1.  **Cloudflare Account**: You need a Cloudflare account.
2.  **Wrangler**: Install the Cloudflare CLI.
    ```bash
    npm install -g wrangler
    ```
3.  **Domain**: A domain on Cloudflare (for Email Routing and custom worker domain).

### Setup Steps

1.  **Clone & Install**

    ```bash
    git clone <your-repo-url>
    cd worker-comment
    npm install
    ```

2.  **Create Resources**

    - **D1 Database**:

      ```bash
      wrangler d1 create comments-db
      ```

      Copy the `database_id` and update `wrangler.toml` (under `[[d1_databases]]`).

    - **KV Namespace**:
      ```bash
      wrangler kv:namespace create AVATAR_KV
      ```
      Copy the `id` and update `wrangler.toml` (under `[[kv_namespaces]]`).

3.  **Initialize Database**

    ```bash
    wrangler d1 execute comments-db --file=./schema.sql
    ```

4.  **Configure Secrets**
    You need to set the following secrets in Cloudflare:

    ```bash
    # JWT Signing Secret (Secure string for signing tokens)
    wrangler secret put ADMIN_SECRET

    # Turnstile Secret Key
    wrangler secret put TURNSTILE_SECRET

    # Sender Email (see "Multi-site Configuration" below)
    wrangler secret put SENDER_EMAIL

    # Admin Email (Comma-separated list of allowed admin emails)
    # REQUIRED: Only emails in this list can log in.
    wrangler secret put ADMIN_EMAIL
    ```

5.  **Email Routing Setup**

    - Go to user dashboard > Email > Email Routing.
    - Enable it for your domain.
    - Create a "Catch-all" rule or specific addresses if needed.
    - **IMPORTANT**: For the Worker to _send_ emails, you must configure the "Send Email" binding.
      - In your Worker's Settings > Variables, ensure you add the `send_email` binding linking to your destination (or use Wrangler, but bindings usually need dashboard setup if not using MailChannels).
      - _Note_: The code expects a `send_email` binding named `SEB`.

6.  **Deploy**
    ```bash
    wrangler deploy
    ```

## Multi-site Configuration

You can use a single Worker instance for multiple websites (`site_id`). You can configure different Sender Names/Emails and different Admin notification emails for each site.

### 1. Sender Email (`SENDER_EMAIL`)

This variable determines who the email appears to be _from_.

**Option A: Single Sender (Simple)**
Just set the secret to a plain string:

```text
noreply@yourdomain.com
```

**Option B: Multi-site (JSON)**
Set the secret to a JSON string mapping `site_id` to email addresses.

```json
{
  "siteA": "noreply@siteA.com",
  "siteB": "contact@siteB.com",
  "default": "noreply@default.com"
}
```

### 2. Admin Email (`ADMIN_EMAIL`)

This variable determines who receives notifications for _new threads_ (or fallbacks when a parent author has no email).

**Option A: Single Admin (Simple)**
Comma-separated list of emails:

```text
admin@site.com, moderator@site.com
```

**Option B: Multi-site (JSON)**
Set the secret to a JSON string mapping `site_id` to emails.

```json
{
  "siteA": "admin@siteA.com",
  "siteB": "webmaster@siteB.com, owner@siteB.com",
  "default": "global-admin@yourdomain.com"
}
```

- When a request comes in with `?site_id=siteA` (or in the POST body), the worker looks up the matching key in your JSON configuration.
- If the key `siteA` isn't found, it looks for `default`.
- If `default` isn't found, it picks the first available value or falls back to a hardcoded default.

## Authentication & Admin Panel

The Admin Panel is protected by an Email OTP (One-Time Password) system with Turnstile spam protection.

1.  **Access**: Navigate to your site and click the "Admin" button (or append `?view=admin` to the URL).
2.  **Login**:
    - Enter any email address and complete the Turnstile challenge.
    - Click "Send Code". The system will email you a 6-digit code _regardless of whether you are an admin or not_ (to prevent email enumeration).
    - Enter the code to verify.
    - **Only if your email is in the `ADMIN_EMAIL` list will login succeed.**
3.  **Session**:
    - Upon verification, a JWT is issued and stored in your browser.
    - You will remain logged in for 7 days.

### Environment Variables for Admin Frontend

Ensure your `admin-frontend/.env` file has the following:

```bash
VITE_TURNSTILE_SITE_KEY=your_site_key_here
```
