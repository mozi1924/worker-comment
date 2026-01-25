import React, { useState, useEffect } from 'react';
import type { Comment } from '../types';
import { CommentCard } from './CommentCard';
import { Search, Loader2, LogOut, Trash2, Filter, Menu, X } from 'lucide-react';

interface DashboardProps {
    workerUrl: string;
    token: string;
    onLogout: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ workerUrl, token, onLogout }) => {
    const [comments, setComments] = useState<Comment[]>([]);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const [emailFilter, setEmailFilter] = useState('');
    const [siteFilter, setSiteFilter] = useState('');
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    const fetchComments = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (emailFilter) params.append('email', emailFilter);
            if (siteFilter) params.append('site_id', siteFilter);

            const res = await fetch(`${workerUrl}/api/admin/comments?${params.toString()}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (res.ok) {
                const data = await res.json();
                setComments(data);
            } else {
                 if (res.status === 401) {
                    onLogout(); // Token expired
                 } else {
                    setMessage({ type: 'error', text: 'Failed to fetch comments' });
                 }
            }
        } catch (error) {
            setMessage({ type: 'error', text: 'Network connection error' });
        } finally {
            setLoading(false);
        }
    };

    // Initial fetch
    useEffect(() => {
        fetchComments();
    }, []);

    const handleDelete = async (id: number) => {
        if (!confirm('Are you sure you want to delete this comment?')) return;
        try {
            const res = await fetch(`${workerUrl}/api/admin/comments/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                setComments(comments.filter(c => c.id !== id));
                setMessage({ type: 'success', text: 'Comment deleted successfully' });
                setTimeout(() => setMessage(null), 3000);
            } else {
                setMessage({ type: 'error', text: 'Failed to delete' });
            }
        } catch (e) {
            setMessage({ type: 'error', text: 'Error deleting comment' });
        }
    };
    
    const handleRefreshAvatar = async (email: string, siteId: string) => {
        try {
            const res = await fetch(`${workerUrl}/api/admin/refresh-avatar`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ email, site_id: siteId })
            });
            if (res.ok) {
                setMessage({ type: 'success', text: 'Avatar refreshed. You may need to clear cache.' });
                setTimeout(() => setMessage(null), 4000);
            } else {
                setMessage({ type: 'error', text: 'Failed to refresh avatar' });
            }
        } catch (e) {
            setMessage({ type: 'error', text: 'Error refreshing avatar' });
        }
    };

    const handleBatchDelete = async () => {
        if (!emailFilter) return;
        if (!confirm(`CAUTION: Delete ALL comments from ${emailFilter}?`)) return;

        try {
            const res = await fetch(`${workerUrl}/api/admin/comments/batch`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ email: emailFilter })
            });
            if (res.ok) {
                setMessage({ type: 'success', text: 'Batch delete successful' });
                fetchComments();
                setTimeout(() => setMessage(null), 3000);
            } else {
                setMessage({ type: 'error', text: 'Batch delete failed' });
            }
        } catch (e) {
             setMessage({ type: 'error', text: 'Error executing batch delete' });
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            {/* Header */}
            <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16 items-center">
                        <div className="flex items-center">
                            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">
                                Worker Comments
                            </span>
                        </div>
                         
                        {/* Desktop Actions */}
                        <div className="hidden md:flex items-center space-x-4">
                            <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">{comments.length} comments</span>
                            <button onClick={onLogout} className="text-sm text-gray-600 hover:text-red-600 font-medium flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors">
                                <LogOut className="w-4 h-4" /> Logout
                            </button>
                        </div>

                         {/* Mobile Menu Button */}
                         <div className="md:hidden">
                            <button 
                                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                                className="p-2 text-gray-500 hover:text-gray-700"
                            > 
                                {mobileMenuOpen ? <X className="w-6 h-6"/> : <Menu className="w-6 h-6"/> }
                            </button>
                        </div>
                    </div>
                </div>
                
                 {/* Mobile Menu */}
                 {mobileMenuOpen && (
                    <div className="md:hidden bg-white border-b border-gray-200 px-4 py-2 space-y-2">
                        <div className="text-sm text-gray-500 py-2">{comments.length} comments loaded</div>
                        <button onClick={onLogout} className="w-full text-left text-sm text-red-600 font-medium py-2 flex items-center gap-2">
                                <LogOut className="w-4 h-4" /> Logout
                        </button>
                    </div>
                 )}
            </header>

            <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
                
                {message && (
                    <div className={`fixed top-20 right-4 max-w-sm w-full p-4 rounded-lg shadow-lg border-l-4 z-50 animate-fade-in ${message.type === 'success' ? 'bg-white border-green-500 text-green-700' : 'bg-white border-red-500 text-red-700'}`}>
                        <div className="flex justify-between items-start">
                           <p className="font-medium">{message.text}</p>
                           <button onClick={() => setMessage(null)} className="ml-4 hover:opacity-70"><X className="w-4 h-4"/></button>
                        </div>
                    </div>
                )}

                {/* Filters */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mb-8">
                     <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                        <div className="md:col-span-4">
                            <label className="block text-xs font-medium text-gray-500 mb-1 ml-1">Email Filter</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Filter className="h-4 w-4 text-gray-400" />
                                </div>
                                <input 
                                    type="text" 
                                    placeholder="Filter by email..." 
                                    className="block w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                    value={emailFilter}
                                    onChange={(e) => setEmailFilter(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="md:col-span-4">
                            <label className="block text-xs font-medium text-gray-500 mb-1 ml-1">Site ID</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Filter className="h-4 w-4 text-gray-400" />
                                </div>
                                <input 
                                    type="text" 
                                    placeholder="Filter by site..." 
                                    className="block w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                    value={siteFilter}
                                    onChange={(e) => setSiteFilter(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="md:col-span-4 flex gap-2">
                             <button 
                                onClick={fetchComments}
                                className="flex-1 bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
                             >
                                <Search className="w-4 h-4" /> Search
                             </button>
                             {emailFilter && (
                                <button 
                                    onClick={handleBatchDelete}
                                    className="flex-shrink-0 bg-red-50 text-red-600 border border-red-200 px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors flex items-center gap-2"
                                    title="Delete all comments from this email"
                                >
                                    <Trash2 className="w-4 h-4" /> Del All
                                </button>
                             )}
                        </div>
                     </div>
                </div>

                {/* Content */}
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                        <Loader2 className="w-10 h-10 animate-spin mb-4 text-blue-500" />
                        <p>Loading comments...</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {comments.length > 0 ? (
                            <div className="grid grid-cols-1 gap-4">
                                {comments.map(comment => (
                                    <CommentCard 
                                        key={comment.id} 
                                        comment={comment} 
                                        onDelete={handleDelete}
                                        onRefreshAvatar={handleRefreshAvatar}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-20 bg-white rounded-xl border border-dashed border-gray-300">
                                <p className="text-gray-500 text-lg">No comments found matching your filters.</p>
                                <button onClick={() => {setEmailFilter(''); setSiteFilter(''); fetchComments();}} className="mt-4 text-blue-600 hover:text-blue-800 font-medium">Clear Filters</button>
                            </div>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
};
