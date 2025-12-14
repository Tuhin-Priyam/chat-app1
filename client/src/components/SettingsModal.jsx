import React, { useState } from 'react';

const SettingsModal = ({ avatar, username, phone, onClose, onUpdateAvatar }) => {
    const [uploading, setUploading] = useState(false);

    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setUploading(true);
        const formData = new FormData();
        formData.append('file', file);

        try {
            // Assuming server running on relative path via proxy or same origin
            // In App.jsx we use / but here we might need full URL if proxy not set perfectly for POST
            // But usually proxy handles it.
            const res = await fetch('/upload', { // Hardcoded PORT 3001 ? check server
                method: 'POST',
                body: formData
            });
            const data = await res.json();
            if (data.url) {
                onUpdateAvatar(data.url);
            }
        } catch (err) {
            console.error("Upload failed", err);
            alert("Upload failed");
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="settings-modal" style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.8)', zIndex: 2000,
            display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
            <div className="glass-panel" style={{ padding: '30px', width: '400px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <h2>Profile Settings</h2>

                <div style={{ display: 'flex', alignItems: 'center', flexDirection: 'column', gap: '10px' }}>
                    <div style={{
                        width: '100px', height: '100px', borderRadius: '50%',
                        background: 'var(--glass-surface)', overflow: 'hidden',
                        display: 'flex', justifyContent: 'center', alignItems: 'center',
                        border: '2px solid var(--primary-color)'
                    }}>
                        {avatar ? (
                            <img src={avatar} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                            <span style={{ fontSize: '3rem' }}>👤</span>
                        )}
                    </div>
                    {uploading ? <p>Uploading...</p> : (
                        <label className="secondary-btn" style={{ cursor: 'pointer' }}>
                            Change Avatar
                            <input type="file" accept="image/*" hidden onChange={handleFileChange} />
                        </label>
                    )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <label>Name</label>
                    <input type="text" value={username} disabled />
                    <label>Phone</label>
                    <input type="text" value={phone} disabled />
                </div>

                <button className="primary-btn" onClick={onClose}>Close</button>
            </div>
        </div>
    );
};

export default SettingsModal;
