import React, { useState, useEffect } from 'react';
import Turnstile from 'react-turnstile';
import { formatDistanceToNow } from 'date-fns';

// Types
interface Comment {
    id: number;
    site_id: string;
    parent_id: number | null;
    content: string;
    author_name: string;
    avatar_id: string;
    created_at: number;
    children?: Comment[];
}

interface CommentSystemProps {
    siteId: string;
    workerUrl: string;
    turnstileSiteKey: string;
}

const CommentSystem: React.FC<CommentSystemProps> = ({ siteId, workerUrl, turnstileSiteKey }) => {
    const [comments, setComments] = useState<Comment[]>([]);
    const [loading, setLoading] = useState(false);
    const [initialLoadDone, setInitialLoadDone] = useState(false);

    // Fetch Comments
    const fetchComments = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${workerUrl}/api/comments?site_id=${siteId}`);
            if (res.ok) {
                const data = (await res.json()) as { comments: Comment[] };
                const flat = data.comments || [];
                const nested = buildCommentTree(flat);
                setComments(nested);
            }
        } catch (err) {
            console.error('Failed to load comments', err);
        } finally {
            setLoading(false);
            setInitialLoadDone(true);
        }
    };

    useEffect(() => {
        fetchComments();
    }, [siteId]);

    // Handle Deep Linking / Anchor Scrolling
    useEffect(() => {
        if (initialLoadDone && comments.length > 0 && window.location.hash) {
            // specific comment anchor e.g. #comment-123
            const hash = window.location.hash;
            if (hash.startsWith('#comment-')) {
                const el = document.getElementById(hash.substring(1));
                if (el) {
                    setTimeout(() => {
                        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        el.classList.add('highlight-comment'); // Optional: Add a flash effect
                    }, 100);
                }
            }
        }
    }, [initialLoadDone, comments]);

    return (
        <div className="max-w-4xl mx-auto p-6 font-sans text-slate-800">
            <h2 className="text-3xl font-bold mb-8 text-slate-900 tracking-tight">Discussion</h2>

            {/* New Comment Form (Root) */}
            <CommentForm
                siteId={siteId}
                workerUrl={workerUrl}
                parentId={null}
                onSuccess={fetchComments}
                turnstileSiteKey={turnstileSiteKey}
            />

            {/* Comment List */}
            <div className="mt-10 space-y-8">
                {loading && !initialLoadDone ? (
                    <div className="flex justify-center py-10">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    </div>
                ) : comments.length === 0 ? (
                    <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                        <p className="text-slate-500 text-lg">No comments yet.</p>
                        <p className="text-slate-400 text-sm mt-1">Start the conversation!</p>
                    </div>
                ) : (
                    comments.map(c => (
                        <CommentItem
                            key={c.id}
                            comment={c}
                            workerUrl={workerUrl}
                            siteId={siteId}
                            turnstileSiteKey={turnstileSiteKey}
                            onReplySuccess={fetchComments}
                        />
                    ))
                )}
            </div>
            <style>{`
                .highlight-comment {
                    animation: highlight 2s ease-out;
                }
                @keyframes highlight {
                    0% { background-color: rgba(59, 130, 246, 0.2); }
                    100% { background-color: transparent; }
                }
            `}</style>
        </div>
    );
};

// Helper to build tree
function buildCommentTree(flat: Comment[]): Comment[] {
    const map = new Map<number, Comment>();
    const roots: Comment[] = [];
    flat.forEach(c => map.set(c.id, { ...c, children: [] }));
    flat.forEach(c => {
        const node = map.get(c.id)!;
        if (c.parent_id && map.has(c.parent_id)) {
            map.get(c.parent_id)!.children!.push(node);
        } else {
            roots.push(node);
        }
    });
    return roots;
}

// Single Comment Item
const CommentItem: React.FC<{
    comment: Comment;
    workerUrl: string;
    siteId: string;
    turnstileSiteKey: string;
    onReplySuccess: () => void;
}> = ({ comment, workerUrl, siteId, turnstileSiteKey, onReplySuccess }) => {
    const [replying, setReplying] = useState(false);
    const avatarSrc = `${workerUrl}/api/avatar/${comment.avatar_id}`;

    return (
        <div id={`comment-${comment.id}`} className="group transition-all duration-500 ease-in-out">
            <div className="flex gap-4 sm:gap-5">
                <div className="flex-shrink-0 pt-1">
                    <img
                        src={avatarSrc}
                        onError={(e) => { (e.target as HTMLImageElement).src = '/default.webp'; }}
                        alt={comment.author_name}
                        className="w-10 h-10 sm:w-12 sm:h-12 rounded-full ring-2 ring-white shadow-md object-cover bg-slate-100"
                    />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow duration-200">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                                <span className="font-bold text-slate-900 text-sm sm:text-base">{comment.author_name}</span>
                                <span className="text-xs font-medium text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full">
                                    {formatDistanceToNow(comment.created_at)} ago
                                </span>
                            </div>
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                <a href={`#comment-${comment.id}`} className="text-slate-300 hover:text-blue-500 text-xs">
                                    #{comment.id}
                                </a>
                            </div>
                        </div>

                        <div className="text-slate-700 whitespace-pre-wrap leading-relaxed text-sm sm:text-base">
                            {comment.content}
                        </div>

                        <div className="mt-4 flex items-center gap-4">
                            <button
                                onClick={() => setReplying(!replying)}
                                className="text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors flex items-center gap-1 group/btn"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 transform group-hover/btn:-scale-x-100 transition-transform" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M7.707 3.293a1 1 0 010 1.414L5.414 7H11a7 7 0 017 7v2a1 1 0 11-2 0v-2a5 5 0 00-5-5H5.414l2.293 2.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                                {replying ? 'Cancel' : 'Reply'}
                            </button>
                        </div>
                    </div>

                    {replying && (
                        <div className="mt-4 animate-fadeIn">
                            <CommentForm
                                siteId={siteId}
                                workerUrl={workerUrl}
                                parentId={comment.id}
                                onSuccess={() => { setReplying(false); onReplySuccess(); }}
                                turnstileSiteKey={turnstileSiteKey}
                                autoFocus
                            />
                        </div>
                    )}

                    {/* Nested Children */}
                    {comment.children && comment.children.length > 0 && (
                        <div className="mt-6 space-y-6 ml-4 sm:ml-8 relative">
                            {/* Visual Thread Line */}
                            <div className="absolute left-[-20px] top-0 bottom-0 w-px bg-slate-200 hidden sm:block"></div>
                            {comment.children.map(child => (
                                <CommentItem
                                    key={child.id}
                                    comment={child}
                                    workerUrl={workerUrl}
                                    siteId={siteId}
                                    turnstileSiteKey={turnstileSiteKey}
                                    onReplySuccess={onReplySuccess}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// Form Component
interface CommentFormProps {
    siteId: string;
    workerUrl: string;
    parentId: number | null;
    onSuccess: () => void;
    turnstileSiteKey: string;
    autoFocus?: boolean;
}

const CommentForm: React.FC<CommentFormProps> = ({ siteId, workerUrl, parentId, onSuccess, turnstileSiteKey, autoFocus }) => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [content, setContent] = useState('');
    const [token, setToken] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!token) {
            setError('Please verify you are human.');
            return;
        }

        setSubmitting(true);
        setError(null);

        try {
            const context_url = window.location.href; // Capture current URL

            const res = await fetch(`${workerUrl}/api/comments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    site_id: siteId,
                    parent_id: parentId,
                    author_name: name,
                    email,
                    content,
                    turnstile_token: token,
                    context_url // Send URL
                })
            });

            if (!res.ok) {
                const errData = (await res.json()) as { error: string };
                throw new Error(errData.error || 'Failed to submit');
            }

            setName('');
            setEmail('');
            setContent('');
            setToken(null);
            onSuccess();
        } catch (err: any) {
            setError(err.message || 'Error occurred');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
             {/* Decorative background element */}
            <div className="absolute top-0 right-0 w-20 h-20 bg-blue-50 rounded-bl-full -mr-10 -mt-10 pointer-events-none"></div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5 relative">
                <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Name</label>
                    <input
                        type="text"
                        required
                        value={name}
                        onChange={e => setName(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all placeholder:text-slate-400 bg-slate-50 focus:bg-white"
                        placeholder="Your name"
                        autoFocus={autoFocus}
                    />
                </div>
                <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Email</label>
                    <input
                        type="email"
                        required
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all placeholder:text-slate-400 bg-slate-50 focus:bg-white"
                        placeholder="email@example.com"
                    />
                </div>
            </div>

            <div className="mb-6 relative">
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Comment</label>
                <textarea
                    required
                    value={content}
                    onChange={e => setContent(e.target.value)}
                    rows={4}
                    className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all resize-y placeholder:text-slate-400 bg-slate-50 focus:bg-white"
                    placeholder="What are your thoughts?"
                />
            </div>

            {error && (
                <div className="mb-5 p-4 bg-red-50 text-red-600 rounded-xl text-sm border border-red-100 flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    {error}
                </div>
            )}

            <div className="flex flex-col sm:flex-row items-center justify-between gap-5">
                <div className="transform origin-left scale-[0.85] sm:scale-100">
                    <Turnstile
                        sitekey={turnstileSiteKey}
                        onVerify={(t) => setToken(t)}
                        onExpire={() => setToken(null)}
                    />
                </div>

                <button
                    type="submit"
                    disabled={submitting || !token}
                    className={`w-full sm:w-auto px-8 py-3 rounded-xl font-bold text-white transition-all transform shadow-lg hover:shadow-blue-200
                        ${submitting || !token
                            ? 'bg-slate-300 cursor-not-allowed shadow-none'
                            : 'bg-blue-600 hover:bg-blue-700 active:scale-95'
                        }`}
                >
                    {submitting ? (
                        <span className="flex items-center gap-2 justify-center">
                            <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Posting...
                        </span>
                    ) : 'Post Comment'}
                </button>
            </div>
        </form>
    );
};

export default CommentSystem;