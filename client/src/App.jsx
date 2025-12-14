import { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import MediaCapture from './components/MediaCapture';
import VideoCall from './components/VideoCall';


const socket = io('/', {
    path: '/socket.io'
});

function App() {
    // App State: 'auth', 'room-select', 'chat'
    const [view, setView] = useState('auth');

    // Data State
    const [username, setUsername] = useState("");
    const [phone, setPhone] = useState("");
    const [password, setPassword] = useState("");
    // room is now the roomId returned by server (phone_phone)
    const [room, setRoom] = useState("");
    const [targetPhone, setTargetPhone] = useState(""); // Phone number to chat with
    const [message, setMessage] = useState("");
    const [messageList, setMessageList] = useState([]);

    // UI State
    const [showMediaCapture, setShowMediaCapture] = useState(false);
    const [showVideoCall, setShowVideoCall] = useState(false);
    const [isVoiceCall, setIsVoiceCall] = useState(false);
    const [incomingCall, setIncomingCall] = useState(null); // { offer, from, isVoiceOnly }


    // Auth Mode: 'login' or 'register'
    const [authMode, setAuthMode] = useState('login');
    const [error, setError] = useState("");


    const messagesEndRef = useRef(null);

    useEffect(() => {
        function onReceiveMessage(data) {
            setMessageList((list) => [...list, data]);
        }

        function onLoadMessages(messages) {
            setMessageList(messages);
        }

        function onMessageDeleted(id) {
            setMessageList((list) => list.filter(msg => msg.id !== id));
        }

        function onRoomReset() {
            setMessageList([]);
        }

        function onRoomClosed() {
            alert("The host has left the room. The room is now closed.");
            window.location.reload();
        }

        function onCallOffer(data) {
            setIncomingCall(data);
        }

        socket.on('receive_message', onReceiveMessage);
        socket.on('load_messages', onLoadMessages);
        socket.on('message_deleted', onMessageDeleted);
        socket.on('room_reset', onRoomReset);
        socket.on('room_closed', onRoomClosed);
        socket.on('call_offer', onCallOffer);


        return () => {
            socket.off('receive_message', onReceiveMessage);
            socket.off('load_messages', onLoadMessages);
            socket.off('message_deleted', onMessageDeleted);
            socket.off('room_reset', onRoomReset);
            socket.off('room_closed', onRoomClosed);
            socket.off('call_offer', onCallOffer);

        };
    }, []);

    // Auto-scroll
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messageList]);

    // Validation Helper
    const validateIndianPhone = (ph) => {
        // Strip non-digits
        const digits = ph.replace(/\D/g, '');

        let normalized = "";
        // Check lengths
        if (digits.length === 10) {
            normalized = digits;
        } else if (digits.length === 11 && digits.startsWith('0')) {
            normalized = digits.substring(1);
        } else if (digits.length === 12 && digits.startsWith('91')) {
            normalized = digits.substring(2);
        } else {
            return null; // Invalid length
        }

        // Check if valid mobile start (6,7,8,9)
        if (/^[6-9]/.test(normalized)) {
            return normalized;
        }
        return null; // Invalid prefix
    };

    const handleAuth = async () => {
        if (!phone || !password || (authMode === 'register' && !username)) {
            setError("Please fill in all fields");
            return;
        }

        const normalizedPhone = validateIndianPhone(phone);
        if (!normalizedPhone) {
            setError("Please enter a valid Indian mobile number (e.g., 9876543210)");
            return;
        }

        const event = authMode === 'login' ? 'login' : 'register';
        const payload = authMode === 'login'
            ? { phone: normalizedPhone, password }
            : { username, phone: normalizedPhone, password };

        socket.emit(event, payload, (response) => {
            if (response.status === 'ok') {
                setError("");
                // Set normalized phone back to state to ensure consistency
                setPhone(normalizedPhone);
                if (response.username) setUsername(response.username);
                // response.phone should be same as normalizedPhone
                setView('room-select');
            } else {
                setError(response.message);
            }
        });
    };

    const startChat = () => {
        if (targetPhone === "") {
            setError("Please enter a phone number to chat with");
            return;
        }

        const normalizedTarget = validateIndianPhone(targetPhone);
        if (!normalizedTarget) {
            setError("Invalid India Phone Number. Use 10-digit format.");
            return;
        }
        if (normalizedTarget === phone) {
            setError("You cannot chat with yourself.");
            return;
        }

        socket.emit('start_chat', { targetPhone: normalizedTarget }, (response) => {
            if (response.status === 'ok') {
                setRoom(response.roomId);
                setTargetPhone(normalizedTarget); // Keep UI consistent
                setView('chat');
                setError("");
            } else {
                alert(response.message);
            }
        });
    };

    const sendMessage = async (msgContent, type = 'text') => {
        if (msgContent !== "") {
            const messageData = {
                room: room,
                author: username, // Consider sending phone too if needed for uniqueness
                message: msgContent,
                type: type,
                time: new Date(Date.now()).getHours() + ":" + new Date(Date.now()).getMinutes(),
            };

            await socket.emit("send_message", messageData);
            setMessage("");
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

    const resetRoom = () => {
        if (confirm("Are you sure you want to delete all messages in this room?")) {
            socket.emit('reset_room', room);
        }
    };

    return (
        <div className="app-container">
            {/* OVERLAYS */}
            {showMediaCapture && (
                <MediaCapture
                    onMediaCaptured={handleMediaCaptured}
                    onClose={() => setShowMediaCapture(false)}
                />
            )}

            {showVideoCall && (
                <VideoCall
                    socket={socket}
                    room={room}
                    username={username}
                    incomingOffer={incomingCall?.offer}
                    isVoiceOnly={isVoiceCall || incomingCall?.isVoiceOnly}
                    onClose={() => {
                        setShowVideoCall(false);
                        setIsVoiceCall(false);
                    }}
                />
            )}


            {incomingCall && !showVideoCall && (
                <div className="incoming-call-modal glass-panel">
                    <h3>Incoming Call...</h3>
                    <div className="modal-actions">
                        <button className="primary-btn" onClick={() => {
                            setShowVideoCall(true);
                            setIncomingCall(null);
                        }}>Answer with Video</button>
                        <button className="primary-btn" onClick={() => {
                            setIsVoiceCall(true);
                            setShowVideoCall(true);
                            setIncomingCall(null);
                        }}>Answer with Voice</button>
                        <button className="danger-btn" onClick={() => setIncomingCall(null)}>Reject</button>

                    </div>
                </div>
            )}

            {/* AUTH VIEW */}
            {view === 'auth' && (
                <div className="auth-container glass-panel">
                    <h1>Warp Chat</h1>
                    <h2>{authMode === 'login' ? 'Login' : 'Register'}</h2>

                    {error && <p style={{ color: 'var(--danger)' }}>{error}</p>}

                    {authMode === 'register' && (
                        <input
                            type="text"
                            placeholder="Username (Display Name)"
                            onChange={(e) => setUsername(e.target.value)}
                        />
                    )}
                    <input
                        type="tel"
                        placeholder="Mobile Number (e.g. 9876543210)"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                    />
                    <input
                        type="password"
                        placeholder="Password"
                        onChange={(e) => setPassword(e.target.value)}
                    />

                    <button className="primary-btn" onClick={handleAuth}>
                        {authMode === 'login' ? 'Enter' : 'Create Account'}
                    </button>

                    <button
                        className="secondary-btn"
                        onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
                    >
                        {authMode === 'login' ? "Don't have an account? Register" : "Already have an account? Login"}
                    </button>
                </div>
            )}

            {/* ROOM SELECT VIEW */}
            {view === 'room-select' && (
                <div className="join-container glass-panel">
                    <h1>Welcome, {username}</h1>
                    <p>Start a secure conversation.</p>

                    <div style={{ width: '100%', height: '1px', background: 'var(--glass-border)', margin: '10px 0' }}></div>

                    <input
                        type="tel"
                        placeholder="Friend's Mobile Number..."
                        value={targetPhone}
                        onChange={(event) => setTargetPhone(event.target.value)}
                    />
                    <button onClick={startChat} className="primary-btn">
                        Start Chat
                    </button>

                    {/* Optional: Add list of recent chats here in future */}
                </div>
            )}

            {/* CHAT VIEW */}
            {view === 'chat' && (
                <div className="chat-window glass-panel">
                    <div className="chat-header">
                        <div className="header-info">
                            <h3>Room: <span style={{ color: 'var(--success)' }}>{room}</span></h3>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Logged in as {username}</span>
                        </div>
                        <div className="header-controls">
                            <button className="danger-btn" onClick={resetRoom}>Clear Room</button>
                            <button className="secondary-btn" onClick={() => window.location.reload()}>Leave</button>
                        </div>
                    </div>

                    <div className="chat-body">
                        {messageList.length === 0 && (
                            <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '20px' }}>
                                No messages yet. Say hello!
                            </div>
                        )}
                        {messageList.map((messageContent, index) => {
                            const isMyMessage = username === messageContent.author;
                            return (
                                <div
                                    className={`message ${isMyMessage ? "you" : "other"}`}
                                    key={index}
                                >
                                    <div className="message-content">
                                        {messageContent.type === 'text' && <p>{messageContent.message}</p>}
                                        {messageContent.type === 'image' && <img src={messageContent.message} alt="shared" style={{ maxWidth: '100%', borderRadius: '8px' }} />}
                                        {messageContent.type === 'video' && <video src={messageContent.message} controls style={{ maxWidth: '100%', borderRadius: '8px' }} />}
                                        {messageContent.type === 'audio' && <audio src={messageContent.message} controls style={{ width: '200px' }} />}
                                    </div>

                                    <div className="message-meta">
                                        <span>{messageContent.time}</span>
                                        <span>•</span>
                                        <span>{messageContent.author}</span>
                                        {isMyMessage && (
                                            <button
                                                className="delete-btn"
                                                onClick={() => deleteMessage(messageContent.id)}
                                                title="Delete Message"
                                            >
                                                &#10005;
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                        <div ref={messagesEndRef} />
                    </div>

                    <div className="chat-footer">
                        <button className="secondary-btn" title="Send Media" onClick={() => setShowMediaCapture(true)}>📷</button>
                        <button className="secondary-btn" title="Video Call" onClick={() => { setIsVoiceCall(false); setShowVideoCall(true); }}>📞</button>
                        <button className="secondary-btn" title="Voice Call" onClick={() => { setIsVoiceCall(true); setShowVideoCall(true); }}>🎙️</button>

                        <input
                            type="text"
                            value={message}
                            placeholder="Type a message..."
                            onChange={(event) => setMessage(event.target.value)}
                            onKeyPress={(event) => {
                                event.key === "Enter" && sendTextMessage();
                            }}
                        />
                        <button onClick={sendTextMessage}>&#10148;</button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default App;
