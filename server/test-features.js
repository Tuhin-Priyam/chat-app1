const io = require('socket.io-client');

const URL = 'http://localhost:3001';

function createClient(name) {
    return io(URL, {
        reconnectionDelayMax: 10000,
        forceNew: true,
    });
}

async function runTest() {
    console.log('--- Starting Warp Chat Feature Test ---');

    // 1. Setup Clients
    const host = createClient('Host');
    const userA = createClient('User A');
    const userB = createClient('User B');

    let roomId = null;

    // Helper to wrap socket events in promises
    const output = (name, msg) => console.log(`[${name}] ${msg}`);

    try {
        // 2. Host Creates Room
        await new Promise(resolve => {
            host.on('connect', () => {
                output('Host', 'Connected');
                host.emit('create_room', (res) => {
                    roomId = res.roomId;
                    output('Host', `Created Room: ${roomId}`);
                    host.emit('join_room', roomId);
                    resolve();
                });
            });
        });

        // 3. Users Join Room
        await new Promise(resolve => {
            userA.on('connect', () => {
                userA.emit('join_room', roomId);
                output('User A', `Joined Room: ${roomId}`);
                resolve();
            });
        });

        await new Promise(resolve => {
            userB.on('connect', () => {
                userB.emit('join_room', roomId);
                output('User B', `Joined Room: ${roomId}`);
                resolve();
            });
        });

        // 4. Test Media Message
        const mediaPromise = new Promise(resolve => {
            let receivedCount = 0;
            const checkDone = () => {
                receivedCount++;
                if (receivedCount >= 2) resolve(); // Host + UserB
            };

            host.on('receive_message', (data) => {
                if (data.type === 'image') {
                    output('Host', 'Received Image Message');
                    checkDone();
                }
            });

            userB.on('receive_message', (data) => {
                if (data.type === 'image') {
                    output('User B', 'Received Image Message');
                    checkDone();
                }
            });
        });

        const imageMsg = {
            room: roomId,
            author: 'User A',
            message: 'data:image/png;base64,fakeimagedata',
            type: 'image',
            time: '12:00'
        };

        userA.emit('send_message', imageMsg);
        output('User A', 'Sent Image Message');

        await mediaPromise;
        output('System', 'Media Message Verified');

        // 5. Test Host Disconnect -> Room Close
        const roomClosedPromise = new Promise(resolve => {
            let closedCount = 0;
            const checkDone = () => {
                closedCount++;
                if (closedCount >= 2) resolve(); // UserA + UserB
            };

            userA.on('room_closed', () => {
                output('User A', 'Received room_closed event');
                checkDone();
            });
            userB.on('room_closed', () => {
                output('User B', 'Received room_closed event');
                checkDone();
            });
        });

        output('Host', 'Disconnecting...');
        host.disconnect();

        await roomClosedPromise;
        output('System', 'Host Disconnect Logic Verified: Room Closed for all users.');

        console.log('\n✅ TEST PASSED: All features (Host Logic, Media Msg) verified.');
        process.exit(0);

    } catch (err) {
        console.error('\n❌ TEST FAILED:', err);
        process.exit(1);
    } finally {
        userA.close();
        userB.close();
        if (host.connected) host.close();
    }
}

// Wait for server to be likely ready if we just started it (manual delay if needed)
setTimeout(runTest, 1000);
