import React, { useState, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';

interface Comment {
    id: number;
    site_id: string;
    content: string;
    author_name: string;
    email_md5: string;
    created_at: number;
    context_url?: string;
    ip_address?: string;
}

interface AdminPanelProps {
    workerUrl: string;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ workerUrl }) => {
    const [token, setToken] = useState(localStorage.getItem('admin_token') || '');
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [comments, setComments] = useState<Comment[]>([]);
    const [loading, setLoading] = useState(false);
    const [emailFilter, setEmailFilter] = useState('');
    const [siteFilter, setSiteFilter] = useState('');
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    // Initial Login Check (verify token validity by fetching)
    useEffect(() => {
        if (token) {
            fetchComments();
        }
    }, []);

    const fetchComments = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (emailFilter) params.append('email', emailFilter);
            if (siteFilter) params.append('site_id', siteFilter);

            const res = await fetch(`${workerUrl}/api/admin/comments?${params.toString()}`, {
                headers: {
                    'x-admin-token': token
                }
            });

            if (res.ok) {
                const data = await res.json();
                setComments(data);
                setIsLoggedIn(true);
                localStorage.setItem('admin_token', token);
            } else {
                if (res.status === 401) {
                    setIsLoggedIn(false);
                } else {
                    setMessage({ type: 'error', text: 'Failed to fetch comments' });
                }
            }
        } catch (error) {
            console.error(error);
            setMessage({ type: 'error', text: 'Network error' });
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Are you sure you want to delete this comment?')) return;
        try {
            const res = await fetch(`${workerUrl}/api/admin/comments/${id}`, {
                method: 'DELETE',
                headers: { 'x-admin-token': token }
            });
            if (res.ok) {
                setComments(comments.filter(c => c.id !== id));
                setMessage({ type: 'success', text: 'Comment deleted' });
            } else {
                setMessage({ type: 'error', text: 'Failed to delete' });
            }
        } catch (e) {
            setMessage({ type: 'error', text: 'Error deleting' });
        }
    };

    const handleBatchDelete = async () => {
        if (!emailFilter) return alert('Please enter an email to filter first');
        if (!confirm(`Delete ALL comments from ${emailFilter}?`)) return;

        try {
            const res = await fetch(`${workerUrl}/api/admin/comments/batch`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'x-admin-token': token
                },
                body: JSON.stringify({ email: emailFilter })
            });
            if (res.ok) {
                setMessage({ type: 'success', text: 'Batch delete successful' });
                fetchComments();
            } else {
                setMessage({ type: 'error', text: 'Batch delete failed' });
            }
        } catch (e) {
            setMessage({ type: 'error', text: 'Error' });
        }
    };

    if (!isLoggedIn) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh]">
                <div className="bg-white p-8 rounded-xl shadow-lg border border-gray-200 w-full max-w-md">
                    <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">Admin Login</h2>
                    <input
                        type="password"
                        value={token}
                        onChange={e => setToken(e.target.value)}
                        placeholder="Enter Admin Secret"
                        className="w-full px-4 py-3 rounded-lg border border-gray-300 mb-4 focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                    <button
                        onClick={fetchComments}
                        disabled={loading}
                        className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
                    >
                        {loading ? 'Verifying...' : 'Login'}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto p-6">
            <div className="flex justify-between items-center mb-8">
                <h2 className="text-3xl font-bold text-gray-800">Comment Management</h2>
                <button
                    onClick={() => { setToken(''); setIsLoggedIn(false); localStorage.removeItem('admin_token'); }}
                    className="text-red-600 hover:text-red-800 font-medium"
                >
                    Logout
                </button>
            </div>

            {message && (
                <div className={`mb-4 p-4 rounded-lg ${message.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {message.text}
                    <button onClick={() => setMessage(null)} className="float-right font-bold">&times;</button>
                </div>
            )}

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-8">
                <div className="flex flex-col md:flex-row gap-4">
                    <input
                        type="text"
                        placeholder="Filter by Email"
                        value={emailFilter}
                        onChange={e => setEmailFilter(e.target.value)}
                        className="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                    <input
                        type="text"
                        placeholder="Filter by Site ID"
                        value={siteFilter}
                        onChange={e => setSiteFilter(e.target.value)}
                        className="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                    <button
                        onClick={fetchComments}
                        className="bg-gray-800 text-white px-6 py-2 rounded-lg hover:bg-gray-900 transition-colors"
                    >
                        Search
                    </button>
                    {emailFilter && (
                        <button
                            onClick={handleBatchDelete}
                            className="bg-red-50 text-red-600 px-6 py-2 rounded-lg hover:bg-red-100 transition-colors border border-red-200"
                        >
                            Delete All by Email
                        </button>
                    )}
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-200 text-gray-600 text-sm uppercase tracking-wider">
                                <th className="p-4 font-semibold">Author</th>
                                <th className="p-4 font-semibold">Content</th>
                                <th className="p-4 font-semibold">Context</th>
                                <th className="p-4 font-semibold">Time</th>
                                <th className="p-4 font-semibold text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {comments.map(c => (
                                <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="p-4 align-top">
                                        <div className="font-semibold text-gray-900">{c.author_name}</div>
                                        <div className="text-xs text-gray-500 font-mono">{c.ip_address}</div>
                                    </td>
                                    <td className="p-4 align-top">
                                        <div className="max-w-xl text-sm text-gray-700 whitespace-pre-wrap">{c.content}</div>
                                    </td>
                                    <td className="p-4 align-top">
                                        <div className="text-sm text-gray-500 mb-1">{c.site_id}</div>
                                        {c.context_url ? (
                                            <a
                                                href={`${c.context_url}#comment-${c.id}`}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="text-blue-600 hover:underline text-xs"
                                            >
                                                View on Page &rarr;
                                            </a>
                                        ) : (
                                            <span className="text-gray-400 text-xs">-</span>
                                        )}
                                    </td>
                                    <td className="p-4 align-top whitespace-nowrap text-sm text-gray-500">
                                        {formatDistanceToNow(c.created_at)} ago
                                    </td>
                                    <td className="p-4 align-top text-right">
                                        <button
                                            onClick={() => handleDelete(c.id)}
                                            className="text-red-600 hover:text-red-900 text-sm font-medium px-3 py-1 rounded hover:bg-red-50 transition-colors"
                                        >
                                            Delete
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {comments.length === 0 && !loading && (
                                <tr>
                                    <td colSpan={5} className="p-8 text-center text-gray-500 italic">
                                        No comments found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default AdminPanel;
