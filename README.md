# VU Game — Backend Proxy

Simple Express server jo Anthropic API key ko frontend se chhupa kar rakhta hai.

---

## Setup (Local Development)

### 1. Install karein
```bash
cd vu-backend
npm install
```

### 2. .env file banayein
```bash
cp .env.example .env
```
Phir `.env` file khol kar apni Anthropic API key paste karein:
```
ANTHROPIC_API_KEY=sk-ant-your-real-key-here
FRONTEND_URL=http://localhost:3000
PORT=5000
```

### 3. Backend chalayein
```bash
npm run dev      # development (auto-restart)
# ya
npm start        # production
```

Backend `http://localhost:5000` par chalu ho jayega.

---

## Frontend mein kya karna hai

### Step 1 — Quiz.jsx mein `fetchAIExplanation` replace karein
`fetchAIExplanation-frontend-snippet.js` se function copy karke Quiz.jsx mein purana function replace karein.

### Step 2 — React frontend `.env` mein add karein
Apni React project ke root mein `.env` file mein:
```
REACT_APP_API_URL=http://localhost:5000
```

---

## Project Structure (dono chalate waqt)

```
vu-game/          ← React frontend (port 3000)
vu-backend/       ← This Express server (port 5000)
  server.js
  package.json
  .env            ← API key yahan (git mein nahi jayegi)
  .env.example
  .gitignore
```

---

## API Endpoint

### `POST /api/explain`
**Request body:**
```json
{
  "question":  "What is a variable?",
  "options":   ["A. ...", "B. ...", "C. ...", "D. ..."],
  "answer":    "A. A named memory location",
  "subjectId": "CS101"
}
```
**Response:**
```json
{
  "explanation": "Is question mein... (AI ka jawab)"
}
```

### `GET /api/health`
Returns `{ "status": "ok" }` — check karne ke liye ke server chal raha hai.

---

## Production Deployment (Render / Railway)

1. `vu-backend` folder ko alag GitHub repo mein push karein (ya monorepo rakhein)
2. Render.com ya Railway.app par deploy karein
3. Environment variables mein set karein:
   - `ANTHROPIC_API_KEY` = your key
   - `FRONTEND_URL` = your Vercel/Netlify URL
4. Deploy ho jane ke baad jo URL mile, woh React ke `.env` mein set karein:
   ```
   REACT_APP_API_URL=https://your-backend.onrender.com
   ```
