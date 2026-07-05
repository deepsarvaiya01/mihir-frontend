# LabOps Console (Mihir Laboratory Management System) — Frontend

React 19 + TypeScript + Vite SPA for the LabOps Console — patient registration, order/result entry, approvals, billing, and admin management (templates, users, B2B labs, branches, signatures, logos, audit log).

## Stack

React Router · TanStack Query · Zustand · Axios · Tailwind CSS · Recharts · jsPDF / pdf-lib (report & receipt generation) · sonner (toasts)

## Project setup

```bash
npm install
cp .env.example .env   # set VITE_API_URL to the backend URL
npm run dev
```

## Environment variables

- `VITE_API_URL` — base URL of the backend API (defaults to `http://localhost:3000` in dev).

## Scripts

```bash
npm run dev       # start Vite dev server
npm run build     # type-check (tsc -b) and build for production
npm run lint      # eslint
npm run preview   # preview a production build locally
```

## Roles

- `SUPER_ADMIN` — templates, approvals, users, B2B labs, lab branches, signatures, logos, audit log, plus the shared lab-user workflow (patients/orders/billing/history) via the admin top nav bar.
- `LAB_USER` — patients, orders, billing, history.

## Deployment

Configured for Cloudflare Pages (`public/_redirects` handles SPA routing). Set `VITE_API_URL` to the deployed backend URL in the Cloudflare Pages environment settings.

## Notes

- Demo login credentials are only shown on the login page in dev builds (`import.meta.env.DEV`) — they are stripped from production builds.
- `/r/:token` is a public, unauthenticated route for viewing a shared report via a time-limited token generated from the Billing page.
