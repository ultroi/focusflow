# FocusFlow AI

ADHD-friendly productivity companion for Chrome. This prototype helps reduce overwhelm by turning large tasks into tiny next actions, offering a gentle stuck flow, a focus timer, page summarization, and distraction nudges.

> FocusFlow AI is a productivity tool, not a medical diagnosis or treatment application.

## Stack
- Chrome MV3 + React + Vite + Lucide
- Node.js + Express + MongoDB Atlas + JWT
- Groq primary AI + OpenRouter fallback

## Setup

### 1) Server
```bash
cd server
cp .env.example .env
npm install
npm run dev
```
Fill `MONGODB_URI`, `JWT_SECRET`, and at least one AI key. AI is optional for the timer/tasks.

### 2) Extension
```bash
cd extension
npm install
npm run build
```
Then open `chrome://extensions`, enable Developer mode, choose **Load unpacked**, and select `extension/dist`.
Set the dashboard/API URL in the extension Settings if you are not using `http://localhost:5000`.

### 3) Dashboard
```bash
cd dashboard
npm install
npm run dev
```

## Free AI usage
The server counts successful AI requests per user per day and defaults to 25. Set `AI_DAILY_LIMIT` as needed. Groq is tried first; OpenRouter is attempted as a fallback. API keys never belong in the extension.

## Deployment
- Server: Render or another Node host
- Dashboard: Vercel/Netlify
- Database: MongoDB Atlas
- Extension: build and upload the `extension/dist` folder to Chrome Web Store later

For production, set `CLIENT_URL` to your deployed dashboard origin(s), use a strong `JWT_SECRET`, and keep provider keys server-side only.
