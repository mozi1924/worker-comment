-- Drop table if exists during development (handle with care in prod)
-- DROP TABLE IF EXISTS comments;

CREATE TABLE IF NOT EXISTS comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id TEXT NOT NULL,
  parent_id INTEGER,
  content TEXT NOT NULL,

  author_name TEXT NOT NULL,
  email TEXT, -- Raw email for notifications (Admin/Reply)
  email_md5 TEXT NOT NULL, -- Stored as MD5, never raw
  avatar_id TEXT, -- ID pointing to KV
  ip_address TEXT,
  user_agent TEXT,
  context_url TEXT, -- URL where the comment was posted
  is_admin BOOLEAN DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_site_time ON comments (site_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_md5 ON comments (email_md5);