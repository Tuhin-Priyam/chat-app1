import React, { useEffect, useRef, useState } from 'react';

const VideoCall = ({ socket, room, username, incomingOffer, onClose }) => {
    const localVideoRef = useRef(null);
    const remoteVideoRef = useRef(null);
    const peerConnectionRef = useRef(null);
    const [callStatus, setCallStatus] = useState('initializing'); // initializing, calling, connected, ended

    const iceServers = {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
        ],
    };

    useEffect(() => {
        const initCall = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                if (localVideoRef.current) localVideoRef.current.srcObject = stream;

                peerConnectionRef.current = new RTCPeerConnection(iceServers);

                stream.getTracks().forEach(track => {
                    peerConnectionRef.current.addTrack(track, stream);
                });

                peerConnectionRef.current.ontrack = (event) => {
                    if (remoteVideoRef.current) {
                        remoteVideoRef.current.srcObject = event.streams[0];
                    }
                };

                peerConnectionRef.current.onicecandidate = (event) => {
                    if (event.candidate) {
                        socket.emit('ice_candidate', { room, candidate: event.candidate });
                    }
                };

                // Listen for signals
                socket.on('call_answer', async (data) => {
                    if (!incomingOffer) { // Only caller handles 'call_answer'
                        await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(data.answer));
                        setCallStatus('connected');
                    }
                });

                socket.on('ice_candidate', async (data) => {
                    if (data.candidate && peerConnectionRef.current) {
                        try {
                            await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
                        } catch (e) {
                            console.error("Error adding ice candidate", e);
                        }
                    }
                });

                if (incomingOffer) {
                    // We are the Answerer
                    await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(incomingOffer));
                    const answer = await peerConnectionRef.current.createAnswer();
                    await peerConnectionRef.current.setLocalDescription(answer);
                    socket.emit('call_answer', { room, answer });
                    setCallStatus('connected');
                } else {
                    // We are the Caller
                    // Create Offer
                    const offer = await peerConnectionRef.current.createOffer();
                    await peerConnectionRef.current.setLocalDescription(offer);
                    socket.emit('call_offer', { room, offer });
                    setCallStatus('calling');
                }

            } catch (err) {
                console.error("Error starting call:", err);
                setCallStatus('ended');
            }
        };

        // If we are answering, we wait for offer passed as prop? 
        // Or we assume this component is launched when starting a call?
        // Let's assume this component is for the Caller OR Callee.
        // Wait, the logic above assumes Caller. We need to handle Callee state.
        // For simplicity, let's just make this component generic and handle role externally or via initial props?
        // Actually, simplest is: if we mount this, we are starting a call.
        // But what if we are RECEIVING a call? 
        // We will mount this component when user clicks "Answer".

        initCall();

        return () => {
            // Cleanup
            if (peerConnectionRef.current) {
                peerConnectionRef.current.close();
            }
            // Stop tracks
            if (localVideoRef.current && localVideoRef.current.srcObject) {
                localVideoRef.current.srcObject.getTracks().forEach(track => track.stop());
            }
            socket.off('call_answer');
            socket.off('ice_candidate');
        };
    }, []);

    // NOTE: This implementation is simplified. It acts as the "Caller". 
    // The "Receiver" logic needs to be handled too.
    // Ideally user A clicks "Call", user B sees "Incoming Call", clicks "Answer", then THIS component mounts for both?
    // Let's fix this in App.jsx integration.

    return (
        <div className="video-call-overlay">
            <div className="video-grid">
                <div className="video-container local">
                    <video ref={localVideoRef} autoPlay playsInline muted />
                    <span>You</span>
                </div>
                <div className="video-container remote">
                    <video ref={remoteVideoRef} autoPlay playsInline />
                    <span>Remote</span>
                </div>
            </div>
            <div className="call-controls">
                <button className="end-call-btn danger-btn" onClick={onClose}>End Call</button>
            </div>

            <style>{`
                .video-call-overlay {
                    position: fixed;
                    top: 0; left: 0; right: 0; bottom: 0;
                    background: #0f172a;
                    z-index: 2000;
                    display: flex;
                    flex-direction: column;
                }
                .video-grid {
                    flex: 1;
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 20px;
                    padding: 20px;
                    align-items: center;
                }
                .video-container {
                    position: relative;
                    width: 100%;
                    height: 100%;
                    background: black;
                    border-radius: 16px;
                    overflow: hidden;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                }
                video {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                }
                .call-controls {
                    padding: 20px;
                    display: flex;
                    justify-content: center;
                    background: rgba(0,0,0,0.5);
                }
                .end-call-btn {
                    padding: 15px 40px;
                    font-size: 1.2rem;
                    border-radius: 30px;
                }
            `}</style>
        </div>
    );
};

export default VideoCall;
