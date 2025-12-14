import React, { useRef, useState } from 'react';

const MediaCapture = ({ onMediaCaptured, onClose }) => {
    const videoRef = useRef(null);
    const mediaRecorderRef = useRef(null);
    const [stream, setStream] = useState(null);
    const [isRecording, setIsRecording] = useState(false);
    const [mode, setMode] = useState('photo'); // 'photo' | 'video' | 'audio'

    const startCamera = async (constraints = { video: true, audio: true }) => {
        try {
            const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
            setStream(mediaStream);
            if (videoRef.current) {
                videoRef.current.srcObject = mediaStream;
            }
        } catch (err) {
            console.error("Error accessing media devices:", err);
            alert("Could not access camera/microphone.");
        }
    };

    const stopCamera = () => {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            setStream(null);
        }
    };

    const takePhoto = () => {
        if (!videoRef.current) return;
        const canvas = document.createElement('canvas');
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        canvas.getContext('2d').drawImage(videoRef.current, 0, 0);
        const dataUrl = canvas.toDataURL('image/jpeg');
        onMediaCaptured({ type: 'image', data: dataUrl });
        stopCamera();
        onClose();
    };

    const startRecording = () => {
        if (!stream) return;
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        const chunks = [];

        mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) chunks.push(e.data);
        };

        mediaRecorder.onstop = () => {
            const blob = new Blob(chunks, { type: 'video/webm' });
            const reader = new FileReader();
            reader.readAsDataURL(blob);
            reader.onloadend = () => {
                onMediaCaptured({ type: 'video', data: reader.result }); // Sending as DataURL for simplicity in this demo
                stopCamera();
                onClose();
            };
        };

        mediaRecorder.start();
        setIsRecording(true);
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
        }
    };

    React.useEffect(() => {
        startCamera();
        return () => stopCamera();
    }, []);

    return (
        <div className="media-capture-overlay">
            <div className="media-capture-modal glass-panel">
                <button className="close-btn" onClick={() => { stopCamera(); onClose(); }}>X</button>

                <div className="video-preview">
                    <video ref={videoRef} autoPlay playsInline muted />
                </div>

                <div className="controls">
                    <div className="mode-switch">
                        <button className={mode === 'photo' ? 'active' : ''} onClick={() => setMode('photo')}>Photo</button>
                        <button className={mode === 'video' ? 'active' : ''} onClick={() => setMode('video')}>Video</button>
                    </div>

                    {mode === 'photo' ? (
                        <button className="capture-btn" onClick={takePhoto}>📸</button>
                    ) : (
                        <button
                            className={`record-btn ${isRecording ? 'recording' : ''}`}
                            onClick={isRecording ? stopRecording : startRecording}
                        >
                            {isRecording ? '⏹' : '🔴'}
                        </button>
                    )}
                </div>
            </div>

            <style>{`
                .media-capture-overlay {
                    position: fixed;
                    top: 0; left: 0; right: 0; bottom: 0;
                    background: rgba(0,0,0,0.8);
                    z-index: 1000;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                }
                .media-capture-modal {
                    width: 90%;
                    max-width: 500px;
                    padding: 20px;
                    background: #1e293b;
                    border-radius: 16px;
                    position: relative;
                }
                .close-btn {
                    position: absolute;
                    top: 10px;
                    right: 10px;
                    background: none;
                    border: none;
                    color: white;
                    font-size: 1.5rem;
                    cursor: pointer;
                    z-index: 10;
                }
                .video-preview video {
                    width: 100%;
                    border-radius: 12px;
                    background: black;
                }
                .controls {
                    margin-top: 20px;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 15px;
                }
                .mode-switch {
                    display: flex;
                    gap: 10px;
                    background: rgba(255,255,255,0.1);
                    padding: 5px;
                    border-radius: 20px;
                }
                .mode-switch button {
                    background: none;
                    border: none;
                    color: #94a3b8;
                    padding: 8px 16px;
                    border-radius: 16px;
                    cursor: pointer;
                }
                .mode-switch button.active {
                    background: var(--primary-color);
                    color: white;
                }
                .capture-btn, .record-btn {
                    width: 60px;
                    height: 60px;
                    border-radius: 50%;
                    border: 4px solid white;
                    background: transparent;
                    font-size: 1.5rem;
                    cursor: pointer;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    transition: all 0.2s;
                }
                .record-btn {
                    border-color: #ef4444;
                    color: #ef4444;
                }
                .record-btn.recording {
                    background: #ef4444;
                    color: white;
                    animation: pulse 1s infinite;
                }
                @keyframes pulse {
                    0% { transform: scale(1); }
                    50% { transform: scale(1.1); }
                    100% { transform: scale(1); }
                }
            `}</style>
        </div>
    );
};

export default MediaCapture;
