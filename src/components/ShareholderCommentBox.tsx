'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { Send } from 'lucide-react';

function ShareholderCommentBox({ shareholderId, shareholderName }: { shareholderId: string; shareholderName: string }) {
    const [comment, setComment] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [sendingRequest, setSendingRequest] = useState(false);

    useEffect(() => {
        setLoading(true);
        fetch(`/api/shareholders/${shareholderId}/comment`)
        .then(res => res.json())
        .then(data => {
            setComment(data.comment || '');
            setLoading(false);
        })
        .catch(() => {
            setError('Failed to load comment');
            setLoading(false);
        });
    }, [shareholderId]);

    const handleSave = async () => {
        setSaving(true);
        setSaved(false);
        setError(null);
        try {
            const res = await fetch(`/api/shareholders/${shareholderId}/comment`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ comment }),
            });
            if (!res.ok) throw new Error('Failed to save');
            setSaved(true);
        } catch {
            setError('Failed to save comment');
        } finally {
            setSaving(false);
        }
    };

    const handleSendRequest = async () => {
        if (!comment.trim()) {
            toast({
                title: "Error",
                description: "Please enter a comment before sending a request to admin",
                variant: "destructive"
            });
            return;
        }

        setSendingRequest(true);
        try {
            // First save the comment
            const saveRes = await fetch(`/api/shareholders/${shareholderId}/comment`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ comment }),
            });
            
            if (!saveRes.ok) {
                throw new Error('Failed to save comment');
            }

            // Then send the admin request
            const requestRes = await fetch('/api/admin-requests', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    shareholderId,
                    shareholderName,
                    reason: comment
                }),
            });
            
            if (!requestRes.ok) {
                const data = await requestRes.json();
                throw new Error(data.error || 'Failed to send request');
            }

            // Update the saved state
            setSaved(true);

            toast({
                title: "Success",
                description: "Comment saved and request sent to admin successfully. They will review your request.",
            });
        } catch (error) {
            toast({
                title: "Error",
                description: error instanceof Error ? error.message : "Failed to send request to admin",
                variant: "destructive"
            });
        } finally {
            setSendingRequest(false);
        }
    };

    return (
        <div
            className="mb-6 p-4 rounded-lg bg-gray-50 border border-gray-200 shadow-sm"
            style={{ minWidth: 320, maxWidth: '100%' }}
        >
            <h2 className="text-2xl font-bold mb-2">Comment</h2>
            {loading ? (
                <div className="text-muted-foreground mb-2">Loading...</div>
            ) : (
                <>
                    <textarea
                        className="w-full min-h-[120px] border border-gray-300 rounded-md p-3 text-base mb-2 bg-white focus:outline-primary focus:ring-2 focus:ring-primary/30"
                        value={comment}
                        onChange={e => setComment(e.target.value)}
                        disabled={saving}
                        placeholder="Enter notes or comments about this shareholder..."
                        style={{ resize: 'vertical' }}
                    />
                    <div className="flex items-center justify-between gap-4 mt-2">
                        <div className="flex items-center gap-2">
                            {saved && <span className="text-green-600">Saved!</span>}
                            {error && <span className="text-red-600">{error}</span>}
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleSendRequest}
                                disabled={sendingRequest || !comment.trim()}
                            >
                                <Send className="w-4 h-4 mr-1" />
                                {sendingRequest ? 'Sending...' : 'Send Request to Admin'}
                            </Button>
                            <button
                                className="bg-primary text-white px-6 py-2 rounded shadow hover:bg-primary/90 disabled:opacity-60 transition-all"
                                onClick={handleSave}
                                disabled={saving}
                                type="button"
                            >
                                {saving ? 'Saving...' : 'Save'}
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

export default ShareholderCommentBox;