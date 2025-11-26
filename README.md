<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1jlhKBLukSTKSaZ9kd5G4qReM8ji7V0_X

## Run Locally

### 1. Backend (Python + MCP)

**Prerequisites:** Python 3.11+

```
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\\Scripts\\activate
pip install -r requirements.txt
cp .env.example .env
```

Fill in `AMADEUS_CLIENT_ID` / `AMADEUS_CLIENT_SECRET` inside `backend/.env`, then start the API:

```
uvicorn backend.app:app --reload
```

> Need the MCP server for tooling? Run `python -m backend.mcp_server` in another terminal.

### 2. Frontend (Vite + React)

**Prerequisites:** Node.js

1. Install dependencies: `npm install`
2. Create `.env.local` with the keys you need:
   ```
   VITE_BACKEND_URL=http://localhost:8000
   GEMINI_API_KEY=your_gemini_key
   ```
3. Start the dev server: `npm run dev`
