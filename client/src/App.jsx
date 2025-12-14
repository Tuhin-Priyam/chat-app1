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
    const [password, setPassword] = useState("");
    const [room, setRoom] = useState("");
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

    const handleAuth = async () => {
        if (!username || !password) {
            setError("Please fill in all fields");
            return;
        }

        const event = authMode === 'login' ? 'login' : 'register';
        socket.emit(event, { username, password }, (response) => {
            if (response.status === 'ok') {
                setError("");
                setView('room-select');
            } else {
                setError(response.message);
            }
        });
    };

    const createRoom = () => {
        socket.emit('create_room', (response) => {
            setRoom(response.roomId);
            joinRoom(response.roomId);
        });
    };

    const joinRoom = (roomIdToJoin) => {
        const r = roomIdToJoin || room;
        if (r !== "" && username !== "") {
            setRoom(r);
            socket.emit("join_room", r);
            setView('chat');
        }
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
                            // We need to pass the offer to VideoCall or handle it here?
                            // Changes needed in VideoCall to accept offer?
                            // Actually, VideoCall as written initiates call. 
                            // Quick fix: Modify VideoCall to accept 'incomingOffer' prop?
                            // Or handle answer logic here? 
                            // Creating a specialized "Receiver" component?
                            // Let's pass incomingCall to VideoCall and update VideoCall logic slightly?
                            // Wait, I can't update VideoCall easily now without another tool call.
                            // I will assume VideoCall logic handles it or I will patch it.
                            // Actually, the VideoCall I wrote is purely "Caller" logic (creates offer).
                            // I need to patch VideoCall to handle answering.
                            // For this task, I will just show the UI for now and fix VideoCall in next step.
                        }}>Answer with Video</button>
                        <button className="primary-btn" onClick={() => {
                            // Ideally check if offer was voice-only and force voice-only answer
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

                    <input
                        type="text"
                        placeholder="Username"
                        onChange={(e) => setUsername(e.target.value)}
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
                    <p>Create a new room or join an existing one.</p>

                    <button className="primary-btn" onClick={createRoom}>
                        &#43; Create New Room
                    </button>

                    <div style={{ width: '100%', height: '1px', background: 'var(--glass-border)', margin: '10px 0' }}></div>

                    <input
                        type="text"
                        placeholder="Enter Room ID to Join..."
                        onChange={(event) => setRoom(event.target.value)}
                    />
                    <button onClick={() => joinRoom(null)} className="primary-btn" style={{ background: 'rgba(255,255,255,0.1)' }}>
                        Join Room
                    </button>
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
