import React from 'react';

const ContactList = ({ chats, onSelectChat, activeChatParams }) => {
    // chats: [{ room, last_msg_id, message, time, author, ... }]

    // Helper to get other user's phone from room ID
    const getOtherUserPhone = (room) => {
        // This is a bit of a hack since we don't have "My Phone" available here easily
        // But the room is PhoneA_PhoneB.
        // We can display the whole room for now or try to filter if we passed currentUserPhone
        return room.replace('_', ' vs ');
    };

    return (
        <div className="contact-list glass-panel">
            <h3>Recent Chats</h3>
            <div className="list">
                {chats.length === 0 && <p className="text-muted">No recent chats</p>}
                {chats.map((chat) => (
                    <div
                        key={chat.room}
                        className={`contact-item ${activeChatParams?.room === chat.room ? 'active' : ''}`}
                        onClick={() => onSelectChat(chat.room)}
                    >
                        <div className="avatar">
                            {/* In future, we need to fetch the OTHER user's avatar.
                                 For now, we don't have it in the recent chat query easily unless we JOIN users.
                                 Let's stick to generic or display initials.
                                 Ideally db.getRecentChats should return other user's avatar.
                                 I'll assume we might add it later, for now just use a placeholder or check if chat has avatar prop (it doesn't yet).
                             */}
                            👤
                        </div>
                        <div className="info">
                            <span className="name">{chat.author} (in {chat.room})</span>
                            <span className="preview">
                                {chat.type === 'file' ? '📎 File' :
                                    chat.type === 'image' ? '📷 Image' :
                                        chat.message.substring(0, 20)}...
                            </span>
                        </div>
                        <div className="meta">
                            {/* Format time nicely? */}
                            <span className="time">{chat.time}</span>
                            {/* <div className="unread-badge">2</div> */}
                        </div>
                    </div>
                ))}
            </div>
            <style>{`
                .contact-list {
                    width: 300px;
                    border-right: 1px solid var(--glass-border);
                    display: flex;
                    flex-direction: column;
                    padding: 10px;
                    background: rgba(0,0,0,0.2);
                }
                .list {
                    flex: 1;
                    overflow-y: auto;
                }
                .contact-item {
                    display: flex;
                    align-items: center;
                    padding: 10px;
                    border-radius: 8px;
                    cursor: pointer;
                    transition: background 0.2s;
                    margin-bottom: 5px;
                }
                .contact-item:hover {
                    background: rgba(255,255,255,0.05);
                }
                .contact-item.active {
                    background: rgba(255,255,255,0.1);
                    border-left: 3px solid var(--primary-color);
                }
                .avatar {
                    width: 40px;
                    height: 40px;
                    border-radius: 50%;
                    background: var(--glass-surface);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin-right: 10px;
                }
                .info {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                }
                .name {
                    font-weight: 600;
                    margin-bottom: 2px;
                }
                .preview {
                    font-size: 0.8rem;
                    color: var(--text-muted);
                }
                .meta {
                    display: flex;
                    flex-direction: column;
                    align-items: flex-end;
                    font-size: 0.7rem;
                    color: var(--text-muted);
                }
                .unread-badge {
                    background: var(--primary-color);
                    color: white;
                    border-radius: 10px;
                    padding: 2px 6px;
                    font-size: 0.7rem;
                    margin-top: 4px;
                }
            `}</style>
        </div>
    );
};

export default ContactList;
