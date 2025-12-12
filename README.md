# Premium Real-Time Chat App

A beautiful, glassmorphism-themed chat application built with **React**, **Node.js**, **Socket.io**, and **Vanilla CSS**.

## 🚀 How to Run Locally

### Prerequisites
- Node.js installed.

### 1. Start the Backend
Open a terminal in the `server` directory:
```bash
cd server
npm start
```
The server will start on `http://localhost:3001`.

### 2. Start the Frontend
Open a new terminal in the `client` directory:
```bash
cd client
npm run dev
```
The app will open at `http://localhost:5173`.

---

## 💬 How to Use
1.  Open the app in your browser (`http://localhost:5173`).
2.  Open a **second tab** or a **different browser** to simulate another user.
3.  **Login**:
    *   Enter a **Username** (e.g., "Alice").
    *   Enter a **Room ID** (e.g., "general"). **Both users must enter the same Room ID.**
    *   Click "Join Room".
4.  **Chat**: Type a message and hit Send. The message will appear instantly in the other window.

---

## 🌐 How to Share with Others

### Option 1: Local Network (WiFi)
To let people on the same WiFi network use your app:

1.  Find your computer's **Local IP Address**:
    *   **Windows**: Open Command Prompt, type `ipconfig`, look for `IPv4 Address` (e.g., `192.168.1.5`).
    *   **Mac/Linux**: Terminal -> `ifconfig` or `ip a`.

2.  Run the frontend with the Host flag:
    ```bash
    cd client
    npm run dev -- --host
    ```

3.  Share the URL:
    Tell your friends to open `http://<YOUR_IP_ADDRESS>:5173` on their phones or laptops.
    *Example: `http://192.168.1.5:5173`*

### Final Deployment Steps (Recommended)

Since this is a real-time app with a backend, **Netlify alone will not work** (it only hosts static sites).
The best way is to use **Render.com** (or Railway) which hosts both the frontend and backend together for free.

**1. Upload to GitHub**
(If you haven't already)
*   Create a repository on GitHub.
*   Run these commands in your `chat-app` terminal:
    ```bash
    git init
    git add .
    git commit -m "Ready for deploy"
    git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
    git push -u origin master
    ```

**2. Deploy to Render**
*   Go to dashboard.render.com
*   Click **New +** > **Web Service**.
*   Connect your GitHub repo.
*   **Important Configurations**:
    *   **Build Command**: `npm install && npm install --prefix client && npm run build --prefix client`
    *   **Start Command**: `npm start`
*   Click **Create Web Service**.

Render will now:
1.  Download your code.
2.  Build the React frontend.
3.  Start the Node.js backend.
4.  Give you a URL (e.g., `https://my-chat.onrender.com`).

That's it! Your app is live.
