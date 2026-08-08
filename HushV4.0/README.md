# Single-page Signup

This is a small single-page site combining the provided signup/login HTML and the logo image into `index.html`.

How to run locally (quick methods):

Option A — Python simple server (no install beyond Python):

1. Make sure you have Python installed and `python` is on PATH.
2. In this folder run:

```powershell
python -m http.server 8000
```

3. Open http://localhost:8000 in your browser.

Option B — Node + Express (supports extensionless routes like `/register`):

1. Make sure Node.js and npm are installed.
2. From this folder run:

```powershell
npm install
npm start
```

3. Open http://localhost:8000 in your browser. The Express server will serve static files and will rewrite extensionless routes to their `.html` counterparts (so `/register` will serve `register.html`).

Notes:
- The site now includes a small Express + Socket.IO server for real-time lobby updates. Run `npm install` to install dependencies (Express and Socket.IO).
- The forms are handled by client-side scripts and do not send data to a server in this demo; registration and login use browser storage (localStorage / sessionStorage). Lobby state is synced in real-time via Socket.IO while the server is running (server-side state is ephemeral).
- Replace the image `Explosive Logo with Charcoal and Midnight Background.png` or rename it if needed.

Quick exact Node/PowerShell steps

1. Install Node.js (LTS) if you don't have it. Download from https://nodejs.org/ or use winget/choco.

2. In PowerShell, from the project root run the exact commands below to install deps and start the server:

```powershell
cd 'C:\Users\ampbo\Website'
npm install
npm start
```

3. Open the site in your browser at:

```
http://localhost:8000
```

PowerShell helper (start-and-open.ps1)

If you prefer a single command that will install dependencies if missing, start the server, wait for it to be ready, and open the default browser automatically, use the included `start-and-open.ps1` script:

```powershell
.\start-and-open.ps1
```

The script will:
- run `npm install` if `node_modules` is missing,
- start `npm start` in a subprocess,
- wait for the server to print the "Server listening" line,
- then open your default browser to the correct localhost URL.
