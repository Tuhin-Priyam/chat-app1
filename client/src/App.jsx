import { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import MediaCapture from './components/MediaCapture';
import VideoCall from './components/VideoCall';
import ContactList from './components/ContactList';
import SettingsModal from './components/SettingsModal';


const socket = io('/', {
    path: '/socket.io'
});

const PUBLIC_VAPID_KEY = 'BOdgol5VfCcNrxrYnZshOZ7lCLbmwq0-0Hk-IqHoxDvBlQEW0prdXeB1Y5DcIw4EL5xpNifLZ4Qr5R1oXMlCDR8';

function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/\-/g, '+')
        .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

function App() {
    // App State: 'auth', 'chat' (combined room-select + chat area)
    const [view, setView] = useState('auth');

    // Data State
    const [username, setUsername] = useState("");
    const [phone, setPhone] = useState("");
    const [password, setPassword] = useState("");
    const [myAvatar, setMyAvatar] = useState(""); // URL/path

    // room is now the roomId returned by server (phone_phone)
    const [room, setRoom] = useState("");
    const [targetPhone, setTargetPhone] = useState(""); // Phone number to chat with
    const [message, setMessage] = useState("");
    const [messageList, setMessageList] = useState([]);

    // Phase 1 Features State
    const [recentChats, setRecentChats] = useState([]);
    const [isTyping, setIsTyping] = useState(false); // Am I typing?
    const [otherIsTyping, setOtherIsTyping] = useState(false); // Is other person typing?
    // Presence map not strictly needed if we just broadcast online status, 
    // but for ContactList it's good to know. For MVP, we pass simple online list?
    // Actually simplicity: ContactList just shows static for now, or we listen to events
    // Let's implement a simple Map or Set for online phones
    const [onlinePhones, setOnlinePhones] = useState(new Set());


    // UI State
    const [showMediaCapture, setShowMediaCapture] = useState(false);
    const [showVideoCall, setShowVideoCall] = useState(false);
    const [isVoiceCall, setIsVoiceCall] = useState(false);
    const [incomingCall, setIncomingCall] = useState(null); // { offer, from, isVoiceOnly }

    const [showSettings, setShowSettings] = useState(false);


    // Auth Mode: 'login' or 'register'
    const [authMode, setAuthMode] = useState('login');
    const [error, setError] = useState("");


    const messagesEndRef = useRef(null);
    const typingTimeoutRef = useRef(null);
    const fileInputRef = useRef(null); // Reference for attachment input

    useEffect(() => {
        function onReceiveMessage(data) {
            setMessageList((list) => {
                // Determine if this message belongs to current room
                if (data.room === room) {
                    // Mark as read immediately if we are in this room
                    socket.emit('mark_read', { room });
                    return [...list, data]; // data now includes .avatar of sender
                }
                return list;
            });
            refreshRecentChats();
        }

        function onLoadMessages(messages) {
            setMessageList(messages);
            // Mark last messages as read
            if (messages.length > 0) {
                socket.emit('mark_read', { room: messages[0].room });
            }
        }

        function onMessageDeleted(id) {
            setMessageList((list) => list.filter(msg => msg.id !== id));
            refreshRecentChats();
        }

        function onRoomReset() {
            setMessageList([]);
            refreshRecentChats();
        }

        function onRoomClosed() {
            alert("The host has left the room based on old logic. Ignoring or handling gracefully.");
            // window.location.reload(); 
        }

        function onCallOffer(data) {
            setIncomingCall(data);
        }

        // Phase 1 Listeners
        function onUserTyping({ phone: typingPhone }) {
            // Check if typingPhone is the person we are chatting with
            // Heuristic: check if room contains phone
            if (room && room.includes(typingPhone)) {
                setOtherIsTyping(true);
            }
        }

        function onUserStopTyping({ phone: typingPhone }) {
            if (room && room.includes(typingPhone)) {
                setOtherIsTyping(false);
            }
        }

        function onMessagesReadUpdate({ room: readRoom, readBy }) {
            if (room === readRoom) {
                setMessageList(list => list.map(msg =>
                    (msg.status !== 'read' && msg.author !== readBy)
                        ? { ...msg, status: 'read' }
                        : msg
                ));
            }
        }

        function onUserPresence({ phone, isOnline }) {
            setOnlinePhones(prev => {
                const newSet = new Set(prev);
                if (isOnline) newSet.add(phone);
                else newSet.delete(phone);
                return newSet;
            });
        }

        socket.on('receive_message', onReceiveMessage);
        socket.on('load_messages', onLoadMessages);
        socket.on('message_deleted', onMessageDeleted);
        socket.on('room_reset', onRoomReset);
        socket.on('room_closed', onRoomClosed);
        socket.on('call_offer', onCallOffer);

        socket.on('user_typing', onUserTyping);
        socket.on('user_stop_typing', onUserStopTyping);
        socket.on('messages_read_update', onMessagesReadUpdate);
        socket.on('user_presence', onUserPresence);


        return () => {
            socket.off('receive_message', onReceiveMessage);
            socket.off('load_messages', onLoadMessages);
            socket.off('message_deleted', onMessageDeleted);
            socket.off('room_reset', onRoomReset);
            socket.off('room_closed', onRoomClosed);
            socket.off('call_offer', onCallOffer);

            socket.off('user_typing', onUserTyping);
            socket.off('user_stop_typing', onUserStopTyping);
            socket.off('messages_read_update', onMessagesReadUpdate);
            socket.off('user_presence', onUserPresence);
        };
    }, [room]); // Re-bind when room changes to capture correct 'room' in closures if needed

    // Auto-reconnect auth (In-Memory Only)
    // This handles server restarts or network drops while the user is using the app.
    // It does NOT persist across page refreshes (for privacy).
    useEffect(() => {
        function attemptReLogin() {
            if (phone && password) {
                console.log("Restoring session (in-memory)...");
                socket.emit('login', { phone, password }, (response) => {
                    if (response.status === 'ok') {
                        console.log("Session restored!");
                        if (room) socket.emit('join_room', room);
                    }
                });
            }
        }

        if (socket.connected) {
            // We don't want to spam login if already connected and authed,
            // but if server restarted, we might need to.
            // For now, let's rely on 'connect' event mostly, or simple check.
            // Actually, we can just let it run. Server handles idempotent logins fine.
            attemptReLogin();
        }

        socket.on('connect', attemptReLogin);
        return () => socket.off('connect', attemptReLogin);
    }, [phone, password, room]);

    // Auto-scroll
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messageList, otherIsTyping]);

    // Validation Helper
    const validateIndianPhone = (ph) => {
        const digits = ph.replace(/\D/g, '');
        let normalized = "";
        if (digits.length === 10) normalized = digits;
        else if (digits.length === 11 && digits.startsWith('0')) normalized = digits.substring(1);
        else if (digits.length === 12 && digits.startsWith('91')) normalized = digits.substring(2);
        else return null;
        if (/^[6-9]/.test(normalized)) return normalized;
        return null;
    };

    // Data Fetcher
    const refreshRecentChats = () => {
        socket.emit('get_recent_chats', (chats) => {
            setRecentChats(chats);
        });
    };

    const handleAuth = async () => {
        if (!phone || !password || (authMode === 'register' && !username)) {
            setError("Please fill in all fields");
            return;
        }

        const normalizedPhone = validateIndianPhone(phone);
        if (!normalizedPhone) {
            setError("Please enter a valid Indian mobile number");
            return;
        }

        const event = authMode === 'login' ? 'login' : 'register';
        const payload = authMode === 'login'
            ? { phone: normalizedPhone, password }
            : { username, phone: normalizedPhone, password };

        socket.emit(event, payload, (response) => {
            if (response.status === 'ok') {
                // Save creds logic REMOVED for privacy

                setError("");
                setPhone(normalizedPhone);
                if (response.username) setUsername(response.username);
                if (response.avatar) setMyAvatar(response.avatar);
                setView('chat'); // Go directly to main view (which has sidebar)
                refreshRecentChats();

                // --- Push Subscription ---
                if ('serviceWorker' in navigator) {
                    subscribeToPush(normalizedPhone);
                }
            } else {
                setError(response.message);
            }
        });
    };

    const subscribeToPush = async (userPhone) => {
        try {
            const register = await navigator.serviceWorker.register('/sw.js', {
                scope: '/'
            });
            console.log("Service Worker Registered...");

            const subscription = await register.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(PUBLIC_VAPID_KEY)
            });
            console.log("Push Registered...");

            // Send Subscription to Server
            await fetch('/subscribe', {
                method: 'POST',
                body: JSON.stringify({
                    subscription: subscription,
                    phone: userPhone
                }),
                headers: {
                    'content-type': 'application/json'
                }
            });
            console.log("Subscription sent to server.");
        } catch (err) {
            console.error("Push Error", err);
        }
    };

    // Update Avatar Handler
    const handleUpdateAvatar = (newAvatarUrl) => {
        setMyAvatar(newAvatarUrl);
        socket.emit('update_profile', { avatar: newAvatarUrl }, () => {
            // Re-fetch or nothing really needed, local state updated
        });
    };

    // Called when clicking "Start Chat" in sidebar or entering new number
    const startChat = (numberToChat) => {
        // If numberToChat is passed (from list), use it. Else use targetPhone state.
        const target = numberToChat || targetPhone;

        const normalizedTarget = validateIndianPhone(target);
        if (!normalizedTarget) {
            if (!numberToChat) {
                const msg = "Invalid Phone Number. Please enter a 10-digit Indian number.";
                setError(msg);
                alert(msg);
            }
            return;
        }
        if (normalizedTarget === phone) {
            if (!numberToChat) {
                const msg = "You cannot chat with yourself.";
                setError(msg);
                alert(msg);
            }
            return;
        }

        const handleSuccess = (res) => {
            setRoom(res.roomId);
            setTargetPhone(normalizedTarget);
            setError("");
            refreshRecentChats();
        };

        socket.emit('start_chat', { targetPhone: normalizedTarget }, (response) => {
            if (response.status === 'ok') {
                handleSuccess(response);
            } else if (response.message === 'Not authenticated') {
                console.log("Auth session lost, attempting transparent re-login...");
                // Retry Logic: Use in-memory credentials to re-auth
                if (phone && password) {
                    socket.emit('login', { phone, password }, (loginRes) => {
                        if (loginRes.status === 'ok') {
                            // Re-auth success, retry original action
                            socket.emit('start_chat', { targetPhone: normalizedTarget }, (retryRes) => {
                                if (retryRes.status === 'ok') {
                                    handleSuccess(retryRes);
                                } else {
                                    alert(retryRes.message);
                                }
                            });
                        } else {
                            alert("Session expired. Please re-login.");
                            setView('auth');
                        }
                    });
                } else {
                    alert("Not authenticated. Please login again.");
                    setView('auth');
                }
            } else {
                alert(response.message);
            }
        });
    };

    const sendMessage = async (msgContent, type = 'text') => {
        if (msgContent !== "") {
            const messageData = {
                room: room,
                author: username,
                message: msgContent,
                type: type,
                time: new Date(Date.now()).getHours() + ":" + new Date(Date.now()).getMinutes(),
            };

            await socket.emit("send_message", messageData);
            setMessage("");
            // Stop typing immediately
            handleTyping(false);
        }
    };

    // File Upload Handler
    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);

        try {
            // const serverUrl = process.env.REACT_APP_SERVER_URL || '';
            const res = await fetch('/upload', { // Relative path for proxy
                method: 'POST',
                body: formData
            });
            const data = await res.json();
            if (data.url) {
                // Determine type
                let type = 'file';
                if (data.type.startsWith('image/')) type = 'image';
                else if (data.type.startsWith('video/')) type = 'video';
                else if (data.type.startsWith('audio/')) type = 'audio';

                // If it is a generic file, we might want to store name in message or content?
                // For now, message stores URL. We might need logic in render to show Name.
                // Let's rely on data.name returned but we need to store it?
                // Current DB message column stores string.
                // We can store generic file as: "URL|NAME" or just URL and let Client parse name from URL?
                // Simple: Just URL. Client parses filename from URL path.
                sendMessage(data.url, type);
            }
        } catch (err) {
            console.error("File upload failed", err);
            alert("File upload error");
        }
    };

    const handleTyping = (isTypingNow) => {
        if (!room) return;
        if (isTypingNow) {
            socket.emit('typing_start', { room });
            // Auto stop after 3s
            clearTimeout(typingTimeoutRef.current);
            typingTimeoutRef.current = setTimeout(() => handleTyping(false), 3000);
        } else {
            clearTimeout(typingTimeoutRef.current);
            socket.emit('typing_stop', { room });
        }
    };

    // Wrapper for text input
    const sendTextMessage = () => sendMessage(message, 'text');

    const handleMediaCaptured = (media) => {
        sendMessage(media.data, media.type);
    };

    const deleteMessage = (id) => {
        socket.emit('delete_message', { id, room });
    };

    // Legacy reset
    const resetRoom = () => {
        socket.emit('reset_room', room);
    };

    // Status Icon Helper
    const renderStatusFn = (msg) => {
        if (msg.author !== username) return null; // Only show for my messages
        if (msg.status === 'read') return <span title="Read" style={{ color: '#3b82f6', marginLeft: '5px' }}>✓✓</span>;
        if (msg.status === 'sent') return <span title="Sent" style={{ color: '#9ca3af', marginLeft: '5px' }}>✓</span>;
        return null;
    };

    // Render message content helper
    const renderMessageContent = (msg) => {
        // Handle server relative URLs
        const content = msg.message;

        switch (msg.type) {
            case 'image': return <img src={content} alt="shared" style={{ maxWidth: '100%', borderRadius: '8px' }} />;
            case 'video': return <video src={content} controls style={{ maxWidth: '100%', borderRadius: '8px' }} />;
            case 'audio': return <audio src={content} controls style={{ width: '200px' }} />;
            case 'file':
                const fileName = msg.message.split('/').pop();
                return (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '8px' }}>
                        <span style={{ fontSize: '1.5rem' }}>📄</span>
                        <a href={content} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary-color)', textDecoration: 'none' }}>
                            {fileName || "Download File"}
                        </a>
                    </div>
                );
            case 'text': default: return <p>{msg.message}</p>;
        }
    };

    return (
        <div className="app-container">
            {/* OVERLAYS */}
            {showMediaCapture && <MediaCapture onMediaCaptured={handleMediaCaptured} onClose={() => setShowMediaCapture(false)} />}
            {showVideoCall && <VideoCall socket={socket} room={room} username={username} incomingOffer={incomingCall?.offer} isVoiceOnly={isVoiceCall || incomingCall?.isVoiceOnly} onClose={() => { setShowVideoCall(false); setIsVoiceCall(false); setIncomingCall(null); }} />}
            {incomingCall && !showVideoCall && (
                <div className="incoming-call-modal glass-panel">
                    <h3>Incoming Call...</h3>
                    <div className="modal-actions">
                        <button className="primary-btn" onClick={() => { setShowVideoCall(true); }}>Answer Video</button>
                        <button className="primary-btn" onClick={() => { setIsVoiceCall(true); setShowVideoCall(true); }}>Answer Voice</button>
                        <button className="danger-btn" onClick={() => setIncomingCall(null)}>Reject</button>
                    </div>
                </div>
            )}

            {showSettings && (
                <SettingsModal
                    avatar={myAvatar}
                    username={username}
                    phone={phone}
                    onClose={() => setShowSettings(false)}
                    onUpdateAvatar={handleUpdateAvatar}
                />
            )}

            {/* AUTH VIEW */}
            {view === 'auth' && (
                <div className="auth-container glass-panel">
                    <h1>Warp Chat</h1>
                    <h2>{authMode === 'login' ? 'Login' : 'Register'}</h2>
                    {error && <p style={{ color: 'var(--danger)' }}>{error}</p>}
                    {authMode === 'register' && <input type="text" placeholder="Username (Display Name)" onChange={(e) => setUsername(e.target.value)} />}
                    <input type="tel" placeholder="Mobile Number (e.g. 9876543210)" value={phone} onChange={(e) => setPhone(e.target.value)} />
                    <input type="password" placeholder="Password" onChange={(e) => setPassword(e.target.value)} />
                    <button className="primary-btn" onClick={handleAuth}>{authMode === 'login' ? 'Enter' : 'Create Account'}</button>
                    <button className="secondary-btn" onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}>{authMode === 'login' ? "Register" : "Login"}</button>
                </div>
            )}

            {/* CHAT MAIN VIEW (Sidebar + Chat) */}
            {view === 'chat' && (
                <div className="main-layout" style={{ display: 'flex', width: '100%', height: '100vh' }}>

                    {/* SIDEBAR */}
                    <div className="sidebar" style={{ width: '320px', background: 'rgba(0,0,0,0.3)', borderRight: '1px solid rgba(255,255,255,0.1)', display: 'flex', flexDirection: 'column' }}>
                        <div className="sidebar-header" style={{ padding: '20px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                {/* My Avatar - Click to Open Settings */}
                                <div onClick={() => setShowSettings(true)} style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--glass-surface)', cursor: 'pointer', overflow: 'hidden', border: '1px solid var(--primary-color)' }}>
                                    {myAvatar ? <img src={myAvatar} alt="Me" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center' }}>⚙️</span>}
                                </div>
                                <h3 style={{ margin: 0 }}>Chats</h3>
                            </div>
                            <button onClick={() => startChat(null)} className="primary-btn" style={{ padding: '5px 10px', width: 'auto' }}>+</button>
                        </div>
                        <div style={{ padding: '10px' }}>
                            <input type="tel" placeholder="Search / New Phone..." value={targetPhone} onChange={(e) => { setTargetPhone(e.target.value); setError(""); }} style={{ padding: '10px' }} />
                            {error && <p style={{ color: '#ff6b6b', fontSize: '0.8rem', marginTop: '5px' }}>{error}</p>}
                        </div>

                        <ContactList
                            chats={recentChats}
                            onSelectChat={(r) => {
                                // Extract phone from room if needed, but endpoint uses room
                                // Ideally we map room to other user phone
                                // For now, simple switch
                                setRoom(r);
                                socket.emit('join_room', r); // Re-join just in case
                            }}
                            activeChatParams={{ room }}
                        />
                        <div style={{ padding: '10px', marginTop: 'auto' }}>
                            <p>Logged as: {username}</p>
                            <button className="secondary-btn" onClick={() => window.location.reload()}>Logout</button>
                        </div>
                    </div>

                    {/* CHAT AREA */}
                    <div className="chat-area" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                        {!room ? (
                            <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#94a3b8' }}>
                                <p>Select a chat to start messaging</p>
                            </div>
                        ) : (
                            <div className="chat-window" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                                <div className="chat-header">
                                    <div className="header-info">
                                        <h3>{targetPhone || room} {onlinePhones.has(targetPhone) && <span style={{ fontSize: '0.8em', color: '#4ade80' }}>● Online</span>}</h3>
                                        {otherIsTyping && <span style={{ fontSize: '0.8rem', color: '#3b82f6', fontStyle: 'italic' }}>typing...</span>}
                                    </div>
                                    <div className="header-controls">
                                        <button className="danger-btn" onClick={resetRoom}>Clear</button>
                                        <button className="secondary-btn" onClick={() => { setIsVoiceCall(false); setShowVideoCall(true); }}>📞</button>
                                        <button className="secondary-btn" onClick={() => { setIsVoiceCall(true); setShowVideoCall(true); }}>🎙️</button>
                                    </div>
                                </div>

                                <div className="chat-body" style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
                                    {messageList.map((messageContent, index) => {
                                        const isMyMessage = username === messageContent.author;
                                        // Use optional chaining for avatar just in case
                                        const avatarUrl = messageContent.avatar ? messageContent.avatar : null;

                                        return (
                                            <div className={`message ${isMyMessage ? "you" : "other"}`} key={index}>
                                                {!isMyMessage && (
                                                    <div className="msg-avatar" style={{ width: '30px', height: '30px', borderRadius: '50%', background: '#ccc', marginRight: '8px', overflow: 'hidden' }}>
                                                        {avatarUrl ? <img src={avatarUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span>👤</span>}
                                                    </div>
                                                )}
                                                <div className="message-content-wrapper" style={{ display: 'flex', flexDirection: 'column', alignItems: isMyMessage ? 'flex-end' : 'flex-start' }}>
                                                    <div className="message-content">
                                                        {renderMessageContent(messageContent)}
                                                    </div>
                                                    <div className="message-meta">
                                                        <span>{messageContent.time}</span>
                                                        {renderStatusFn(messageContent)}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    <div ref={messagesEndRef} />
                                </div>

                                <div className="chat-footer">
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        hidden
                                        onChange={handleFileUpload}
                                    />
                                    <button className="secondary-btn" title="Attach File" onClick={() => fileInputRef.current?.click()}>📎</button>
                                    <button className="secondary-btn" title="Send Media" onClick={() => setShowMediaCapture(true)}>📷</button>
                                    <input
                                        type="text"
                                        value={message}
                                        placeholder="Type a message..."
                                        onChange={(event) => { setMessage(event.target.value); handleTyping(true); }}
                                        onKeyPress={(event) => event.key === "Enter" && sendTextMessage()}
                                    />
                                    <button onClick={sendTextMessage}>&#10148;</button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

export default App;
