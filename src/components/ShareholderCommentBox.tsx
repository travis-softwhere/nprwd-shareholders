'use client';

import React, { useState, useEffect } from 'react';

function ShareholderCommentBox({ shareholderId }: { shareholderId: string }) {
    const [comment, setComment] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState<string | null>(null);

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
                    <div className="flex items-center justify-end gap-4 mt-2">
                        {saved && <span className="text-green-600">Saved!</span>}
                        {error && <span className="text-red-600">{error}</span>}
                        <button
                            className="bg-primary text-white px-6 py-2 rounded shadow hover:bg-primary/90 disabled:opacity-60 transition-all"
                            onClick={handleSave}
                            disabled={saving}
                            type="button"
                        >
                            {saving ? 'Saving...' : 'Save'}
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}

export default ShareholderCommentBox;