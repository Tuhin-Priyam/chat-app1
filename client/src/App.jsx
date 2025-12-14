import { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';

const socket = io('/', {
    path: '/socket.io'
});

function App() {
    const [isConnected, setIsConnected] = useState(socket.connected);
    const [room, setRoom] = useState("");
    const [message, setMessage] = useState("");
    const [messageList, setMessageList] = useState([]);
    const [username, setUsername] = useState("");
    const [chatActive, setChatActive] = useState(false);

    const messagesEndRef = useRef(null);

    useEffect(() => {
        function onConnect() {
            setIsConnected(true);
        }

        function onDisconnect() {
            setIsConnected(false);
        }

        function onReceiveMessage(data) {
            setMessageList((list) => [...list, data]);
        }

        function onLoadMessages(messages) {
            setMessageList(messages);
        }

        socket.on('connect', onConnect);
        socket.on('disconnect', onDisconnect);
        socket.on('receive_message', onReceiveMessage);
        socket.on('load_messages', onLoadMessages);

        return () => {
            socket.off('connect', onConnect);
            socket.off('disconnect', onDisconnect);
            socket.off('receive_message', onReceiveMessage);
            socket.off('load_messages', onLoadMessages);
        };
    }, []);

    // Auto-scroll
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messageList]);


    const joinRoom = () => {
        if (room !== "" && username !== "") {
            socket.emit("join_room", room);
            setChatActive(true);
        }
    };

    const sendMessage = async () => {
        if (message !== "") {
            const messageData = {
                room: room,
                author: username,
                message: message,
                time: new Date(Date.now()).getHours() + ":" + new Date(Date.now()).getMinutes(),
            };

            await socket.emit("send_message", messageData);
            setMessageList((list) => [...list, messageData]);
            setMessage("");
        }
    };

    return (
        <div className="app-container">
            {!chatActive ? (
                <div className="join-container glass-panel">
                    <h1>Welcome</h1>
                    <p>Join a room to start chatting</p>
                    <input
                        type="text"
                        placeholder="Username..."
                        onChange={(event) => setUsername(event.target.value)}
                    />
                    <input
                        type="text"
                        placeholder="Room ID..."
                        onChange={(event) => setRoom(event.target.value)}
                    />
                    <button onClick={joinRoom} className="primary-btn">Join Room</button>
                </div>
            ) : (
                <div className="chat-window glass-panel">
                    <div className="chat-header">
                        <p>Live Chat: <strong>{room}</strong></p>
                        <div className={`status-indicator ${isConnected ? 'online' : 'offline'}`}></div>
                    </div>
                    <div className="chat-body">
                        {messageList.map((messageContent, index) => {
                            return (
                                <div
                                    className={`message ${username === messageContent.author ? "you" : "other"}`}
                                    key={index}
                                >
                                    <div className="message-content">
                                        <p>{messageContent.message}</p>
                                    </div>
                                    <div className="message-meta">
                                        <p id="time">{messageContent.time}</p>
                                        <p id="author">{messageContent.author}</p>
                                    </div>
                                </div>
                            );
                        })}
                        <div ref={messagesEndRef} />
                    </div>
                    <div className="chat-footer">
                        <input
                            type="text"
                            value={message}
                            placeholder="Type a message..."
                            onChange={(event) => setMessage(event.target.value)}
                            onKeyPress={(event) => {
                                event.key === "Enter" && sendMessage();
                            }}
                        />
                        <button onClick={sendMessage}>&#9658;</button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default App;
