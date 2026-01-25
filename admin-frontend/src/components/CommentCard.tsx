import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Trash2, ExternalLink, Globe, Calendar, RefreshCw } from 'lucide-react';
import type { Comment } from '../types';

interface CommentCardProps {
    comment: Comment;
    onDelete: (id: number) => void;
    onRefreshAvatar: (email: string, siteId: string) => void;
}

export const CommentCard: React.FC<CommentCardProps> = ({ comment, onDelete, onRefreshAvatar }) => {
    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow duration-200">
            <div className="flex justify-between items-start mb-4">
                <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-100 to-indigo-100 flex items-center justify-center text-blue-600 font-semibold text-lg border border-blue-50">
                        {comment.author_name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                             {comment.author_name}
                             {comment.email && <span className="text-xs text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full hidden sm:inline-block">{comment.email}</span>}
                             {!comment.email && comment.email_md5 && <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full font-mono hidden sm:inline-block">MD5: {comment.email_md5.substring(0,6)}...</span>}
                        </h3>
                        <div className="flex items-center text-xs text-gray-500 space-x-3 mt-1">
                             <span className="flex items-center" title="Site ID">
                                <Globe className="w-3 h-3 mr-1" />
                                {comment.site_id}
                             </span>
                             <span className="flex items-center">
                                <Calendar className="w-3 h-3 mr-1" />
                                {formatDistanceToNow(comment.created_at)} ago
                             </span>
                             {comment.ip_address && (
                                <span className="font-mono bg-gray-50 px-1 rounded">
                                    {comment.ip_address}
                                </span>
                             )}
                        </div>
                    </div>
                </div>
                <button
                    onClick={() => onDelete(comment.id)}
                    className="text-gray-400 hover:text-red-500 transition-colors p-1 rounded-full hover:bg-red-50"
                    title="Delete Comment"
                >
                    <Trash2 className="w-5 h-5" />
                </button>
                    {comment.email && (
                    <button
                        onClick={() => onRefreshAvatar(comment.email!, comment.site_id)}
                        className="text-gray-400 hover:text-blue-500 transition-colors p-1 rounded-full hover:bg-blue-50 ml-1"
                        title="Refresh Avatar"
                    >
                        <RefreshCw className="w-4 h-4" />
                    </button>
                    )}
            </div>

            <div className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap ml-0 sm:ml-13 pl-0 sm:pl-3 border-l-2 border-gray-100 sm:border-l-2">
                {comment.content}
            </div>

            <div className="mt-4 flex items-center justify-end">
                {comment.context_url ? (
                    <a
                        href={`${comment.context_url}#comment-${comment.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs font-medium text-indigo-600 hover:text-indigo-800 flex items-center hover:underline"
                    >
                        View Context <ExternalLink className="ml-1 w-3 h-3" />
                    </a>
                ) : (
                    <span className="text-xs text-gray-400 flex items-center cursor-not-allowed">
                        No Context <ExternalLink className="ml-1 w-3 h-3" />
                    </span>
                )}
            </div>
        </div>
    );
};
