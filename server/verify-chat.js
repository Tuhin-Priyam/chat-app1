const { io } = require("socket.io-client");

const socket1 = io("http://localhost:3001");
const socket2 = io("http://localhost:3001");

let checks = {
    connected1: false,
    connected2: false,
    joined: false,
    received: false
};

function checkDone() {
    if (checks.connected1 && checks.connected2 && checks.joined && checks.received) {
        console.log("SUCCESS: All checks passed!");
        socket1.disconnect();
        socket2.disconnect();
        process.exit(0);
    }
}

socket1.on("connect", () => {
    console.log("Socket 1 connected");
    checks.connected1 = true;
    socket1.emit("join_room", "test-room");
    checks.joined = true;
    checkDone();
});

socket2.on("connect", () => {
    console.log("Socket 2 connected");
    checks.connected2 = true;
    socket2.emit("join_room", "test-room");

    // Wait a bit for join to process then send
    setTimeout(() => {
        socket1.emit("send_message", { room: "test-room", message: "Hello", author: "Tester" });
    }, 500);
    checkDone();
});

socket2.on("receive_message", (data) => {
    if (data.message === "Hello") {
        console.log("Socket 2 received message");
        checks.received = true;
        checkDone();
    }
});

setTimeout(() => {
    console.error("TIMEOUT: Test failed to complete in 5 seconds.");
    console.log("Status:", checks);
    process.exit(1);
}, 5000);
