# Deployment

This project is ready to run as a single Node service in production:

- the backend reads PORT, MONGO_URI, JWT_SECRET, and optional CORS_ORIGIN
- the backend serves the built frontend from frontend/dist
- the frontend uses VITE_API_BASE_URL when provided, otherwise it falls back to the current site origin in production

## 1. Install dependencies

```powershell
npm install
npm --prefix backend install
npm --prefix frontend install
```

## 2. Build the frontend

```powershell
npm --prefix frontend run build
```

## 3. Start the backend

```powershell
npm --prefix backend start
```

## Required environment variables

Backend:

- MONGO_URI
- JWT_SECRET
- PORT
- CORS_ORIGIN only if frontend is hosted on a different domain

Frontend:

- VITE_API_BASE_URL only if frontend is hosted separately from backend

## One-service hosting layout

Use these commands on a Node hosting platform:

- Install/build:
  npm install && npm --prefix backend install && npm --prefix frontend install && npm --prefix frontend run build
- Start:
  npm --prefix backend start

## Notes

- For MongoDB in production, use a hosted connection string such as MongoDB Atlas.
- If frontend and backend are deployed together on one domain, leave VITE_API_BASE_URL empty.
- If frontend is deployed separately, set VITE_API_BASE_URL to your backend URL and set backend CORS_ORIGIN to your frontend URL.

## Vercel

For Vercel, deploy this repo as two separate projects:

- `backend/` as an Express app
- `frontend/` as a Vite app

Backend environment variables:

- `MONGO_URI`
- `JWT_SECRET`
- `NODE_ENV=production`
- `CORS_ORIGIN=https://your-frontend-domain.vercel.app`

Frontend environment variables:

- `VITE_API_BASE_URL=https://your-backend-domain.vercel.app`

Deploy order:

1. Deploy `backend/` first and copy its production URL.
2. Add that backend URL to the frontend as `VITE_API_BASE_URL`.
3. Add the frontend URL to the backend as `CORS_ORIGIN`.
4. Redeploy the backend if you changed `CORS_ORIGIN`.
