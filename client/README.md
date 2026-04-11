# TeamFlow — Frontend

Next.js 15 frontend for the TeamFlow multi-tenant project management platform.

---

## Tech Stack

| Technology | Purpose |
|---|---|
| Next.js 15 (App Router + Turbopack) | Frontend framework |
| TypeScript | Type safety |
| Redux Toolkit | Global state management |
| TanStack Query | Server state + API caching |
| Axios | HTTP client with interceptors |
| shadcn/ui (Nova preset) | UI component library |
| Tailwind CSS | Styling |
| React Hook Form + Zod | Form management + validation |
| next-themes | Dark / light mode |
| Lucide React | Icons |

---

## Color Palette

TeamFlow uses a refined editorial palette — clean and professional, fitting for a SaaS product.

CSS variables are defined in `src/app/globals.css` and consumed by shadcn/ui components automatically via `--primary`, `--secondary`, `--border`, etc.

---

## Project Structure

```
client/
├── src/
│   ├── app/
│   │   ├── (auth)/                    ← Auth pages (no sidebar)
│   │   │   ├── login/page.tsx
│   │   │   ├── register/page.tsx
│   │   │   ├── forgot-password/page.tsx
│   │   │   ├── reset-password/page.tsx
│   │   │   ├── verify-email/page.tsx
│   │   │   └── layout.tsx
│   │   ├── (dashboard)/               ← Protected pages (with sidebar)
│   │   │   ├── dashboard/page.tsx
│   │   │   ├── organizations/
│   │   │   │   └── new/page.tsx
│   │   │   ├── settings/
│   │   │   │   ├── layout.tsx
│   │   │   │   ├── organization/page.tsx
│   │   │   │   └── members/page.tsx
│   │   │   └── layout.tsx
│   │   ├── layout.tsx                 ← Root layout (providers)
│   │   ├── globals.css                ← Tailwind + CSS variables
│   │   └── page.tsx                   ← Redirects to /dashboard
│   ├── components/
│   │   ├── ui/                        ← shadcn auto-generated
│   │   └── shared/
│   │       ├── providers.tsx          ← Redux + Query + Theme providers
│   │       ├── sidebar.tsx            ← App sidebar with nav + org switcher
│   │       ├── topbar.tsx             ← Breadcrumbs + notification bell
│   │       ├── skeleton.tsx           ← Loading skeleton components
│   │       ├── error-boundary.tsx     ← React error boundary
│   │       ├── verification-banner.tsx ← Email verification amber banner
│   │       └── onboarding-checklist.tsx ← Step-by-step onboarding UI
│   ├── lib/
│   │   ├── axios.ts                   ← Axios instance + 401 interceptor
│   │   └── utils.ts                   ← shadcn utility (cn)
│   ├── store/
│   │   ├── index.ts                   ← Redux store
│   │   └── slices/
│   │       ├── auth.slice.ts          ← User auth state
│   │       └── organization.slice.ts  ← Active org + user orgs
│   ├── hooks/
│   │   └── redux.hooks.ts             ← Typed useAppDispatch + useAppSelector
│   ├── types/
│   │   └── index.ts                   ← Shared TypeScript types
│   └── middleware.ts                  ← Next.js route protection
├── .env.local
└── README.md
```

---

## Environment Variables

Create `client/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:5000/api/v1
NEXT_PUBLIC_APP_NAME=TeamFlow
```

---

## Getting Started

```bash
# Install dependencies
cd client
npm install

# Start development server (Turbopack)
npm run dev
```

Frontend runs at `http://localhost:3000`.
Backend must be running at `http://localhost:5000`.

---

## Progress

| Day | Feature | Status |
|---|---|---|
| 19 | Next.js 15 setup, Redux Toolkit, Axios, shadcn/ui, folder structure | ✅ Done |
| 20 | Auth pages — Login, Register, Forgot Password, Reset Password | ✅ Done |
| 21 | Dashboard shell — Sidebar, Topbar, Org Switcher, Responsive layout | ✅ Done |
| 22 | Organization pages — Create org, Settings, Members, Email verification | ✅ Done |

---

## API Communication

### Base URL
All requests go to `NEXT_PUBLIC_API_URL` (set in `.env.local`).

### Authentication
Tokens are stored as **httpOnly cookies** set by the backend. JavaScript cannot read them. The browser sends them automatically on every request via `withCredentials: true`.

```typescript
// axios.ts
const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  withCredentials: true, // sends httpOnly cookies automatically
});
```

### Organization Context
All org-scoped routes include `:id` in the URL path. The active org ID from Redux is passed directly in API call URLs. No `X-Organization-ID` header is used.

```typescript
// Correct — org ID in URL path
api.get(`/organizations/${activeOrg.id}/projects`)
api.get(`/organizations/${activeOrg.id}/members`)
api.post(`/organizations/${activeOrg.id}/tasks`, data)
```

### Automatic Token Refresh

The Axios response interceptor handles 401 errors silently:

```
Request fails with 401 (access token expired)
  → POST /auth/refresh-token (httpOnly cookie sent automatically)
  → Backend rotates both tokens via new cookies
  → Original request retried with new session
  → User never sees any error or logout

If refresh also fails (refresh token expired)
  → Redirect to /login
```

Routes that skip the refresh attempt: `/auth/me`, `/auth/refresh-token`, `/auth/login`, `/auth/register`.

If multiple requests fail simultaneously while refreshing, they are queued and all retried once refresh completes — not re-triggered individually.

---

## State Management

TeamFlow uses **Redux Toolkit** — the enterprise standard used in production SaaS applications.

### Why Redux Toolkit

Redux Toolkit provides built-in DevTools for debugging, `createAsyncThunk` for clean async action handling, clear separation of loading/error states per action, and is the industry standard expected in interviews and production teams.

### Auth Slice (`store/slices/auth.slice.ts`)

Holds: `user`, `isAuthenticated`, `isLoading`, `error`.

Does NOT hold tokens — tokens live in httpOnly cookies managed by the backend entirely.

| Action | Type | Description |
|---|---|---|
| `loginUser` | Async | POST /auth/login |
| `registerUser` | Async | POST /auth/register |
| `logoutUser` | Async | POST /auth/logout, clears cookies |
| `fetchCurrentUser` | Async | GET /auth/me — restores session on page load |
| `updateUser` | Sync | Updates user fields in state |
| `clearError` | Sync | Clears error message |

A JS-readable cookie `teamflow_authenticated=true` is set by the auth slice on login and cleared on logout. This is only used by the Next.js middleware for redirect logic — it is not an auth token.

### Organization Slice (`store/slices/organization.slice.ts`)

Holds: `activeOrg`, `userOrgs`, `isLoading`, `error`.

Active org is also saved to `localStorage` so it persists across page refreshes independently of the session check.

| Action | Type | Description |
|---|---|---|
| `fetchUserOrganizations` | Async | GET /organizations — loads all user orgs |
| `setActiveOrg` | Sync | Sets active org + saves to localStorage |
| `restoreActiveOrg` | Sync | Reads active org from localStorage on boot |
| `clearOrganization` | Sync | Clears on logout |

### Session Restore on Page Refresh

```
Page loads
  → providers.tsx: store.dispatch(restoreActiveOrg())   ← instant, no network
  → providers.tsx: store.dispatch(fetchCurrentUser())   ← GET /auth/me
      Browser sends httpOnly cookie automatically
      Backend returns user if session is valid
      Redux state restored
  → If fetchCurrentUser succeeds:
      store.dispatch(fetchUserOrganizations())
      Org switcher populated
  → If fetchCurrentUser fails:
      User stays logged out
      Middleware redirects to /login
```

### Typed Redux Hooks

Always use these instead of the default `useDispatch` and `useSelector`:

```typescript
import { useAppDispatch, useAppSelector } from '@/hooks/redux.hooks';

const dispatch = useAppDispatch();
const user = useAppSelector(state => state.auth.user);
const { activeOrg, userOrgs } = useAppSelector(state => state.organization);
```

---

## Route Protection

`src/middleware.ts` runs before every page load at the Next.js edge layer.

```
Not authenticated + /dashboard  → redirect to /login
Already authenticated + /login  → redirect to /dashboard
```

Protected routes: `/dashboard`, `/projects`, `/tasks`, `/teams`, `/settings`, `/analytics`, `/organizations`.

Public routes: `/login`, `/register`, `/forgot-password`, `/reset-password`.

The middleware reads the `teamflow_authenticated` cookie (a simple boolean, not the token) since Next.js middleware cannot access httpOnly cookies and cannot make API calls.

---

## Day 19 — Setup Details

### Packages Installed

```bash
npm install \
  @tanstack/react-query \
  @tanstack/react-query-devtools \
  axios \
  @reduxjs/toolkit \
  react-redux \
  react-hook-form \
  @hookform/resolvers \
  zod \
  lucide-react \
  next-themes \
  js-cookie \
  @types/js-cookie
```

### shadcn/ui Setup

Initialized with the **Nova preset** (Lucide icons + Geist font — professional and modern, used by Vercel ecosystem).

Components installed: `button`, `card`, `input`, `label`, `form`, `toast`, `dropdown-menu`, `avatar`, `badge`, `separator`.

### Providers Stack

```
ReduxProvider
  └── QueryClientProvider (staleTime: 60s, retry: 1)
        └── ThemeProvider (system default, class attribute)
              └── children
                    └── ReactQueryDevtools (dev only)
```

Session restore runs once in `providers.tsx` via `useEffect` on mount.

---

## Day 20 — Auth Pages

All auth pages live under `src/app/(auth)/` and share the auth layout — a centered card on a `#f4f4f4` background with the TeamFlow logo above.

### Login (`/login`)

Form fields: email, password (with show/hide toggle).

Validation via Zod:
- Email: valid email format
- Password: required (any non-empty string)

On submit: dispatches `loginUser` action. Error from Redux state shown inline above the form. On success: `router.push('/dashboard')`.

### Register (`/register`)

Form fields: first name, last name, email, password, confirm password.

Real-time password strength indicator shows 4 rules with green check or gray cross as you type:
- At least 8 characters
- One uppercase letter
- One number
- One special character

On submit: dispatches `registerUser` action. On success: redirect to `/dashboard`.

### Forgot Password (`/forgot-password`)

Single email field. Always shows a success screen after submit regardless of whether the email exists in the database — this prevents email enumeration attacks. POST `/auth/forgot-password`.

### Reset Password (`/reset-password?token=...`)

Reads `token` from URL query parameter via `useSearchParams()`. Two fields: new password and confirm password. POST `/auth/reset-password` with `{ token, newPassword }`. On success: redirect to `/login`. Wrapped in `<Suspense>` because `useSearchParams()` requires it in the App Router.

---

## Day 21 — Dashboard Shell

### Layout Architecture

```
DashboardLayout (flex row, full height)
├── Sidebar (w-60, sticky, hidden mobile)
│   ├── Logo — "TeamFlow" with teal TF icon
│   ├── Org Switcher — active org name + plan + dropdown
│   ├── Navigation Links — Dashboard, Projects, Tasks, Teams, Members, Analytics, Settings
│   └── User Menu — avatar initials, name, email, logout
└── Main Column (flex-1, flex column)
    ├── Topbar (h-14, sticky)
    │   ├── Breadcrumbs (auto-built from URL segments)
    │   └── Notification Bell (badge indicator)
    ├── VerificationBanner (amber, conditional)
    └── Page Content (flex-1, scrollable, p-6)
          └── ErrorBoundary wraps children
```

### Sidebar (`components/shared/sidebar.tsx`)

Desktop: fixed 240px left panel, always visible on `lg+` screens. Mobile: hidden, opens as a full-height drawer with a dark overlay on hamburger button click. Closing on nav link click handled via `onNavClick` prop.

Active link detection: `usePathname()` compared against each link href using `startsWith` to handle nested routes. Active links styled with `bg-[#f4f4f4]` and `text-[#476e66]`.

### Org Switcher

Shows active organization name and plan badge. Dropdown lists all user organizations from Redux. Switching organization calls `setActiveOrg(org)` and reloads the page so all data refreshes with the new org context. "New organization" link at the bottom of the dropdown.

### Topbar (`components/shared/topbar.tsx`)

Breadcrumbs are auto-generated from `usePathname()`. Each path segment is capitalized and hyphens are replaced with spaces. Non-final segments are clickable links. Final segment is bold non-clickable text. No hardcoded route names needed — works for all current and future routes automatically.

### Skeleton Loading (`components/shared/skeleton.tsx`)

| Component | Description |
|---|---|
| `<Skeleton className="h-4 w-32" />` | Single animated gray bar, any size |
| `<SkeletonCard />` | Card with title, value, subtitle placeholders |
| `<SkeletonTable rows={5} />` | Header row + N body rows |
| `<SkeletonSidebar />` | Logo + 6 nav item bars |

Used in dashboard layout while auth state loads and in any page while data fetches.

### Error Boundary (`components/shared/error-boundary.tsx`)

Class component (required by React for error boundaries — hooks cannot catch errors). Wraps all page content in the dashboard layout. Shows a centered error card with the error message and a "Try again" button that reloads the page. Accepts an optional `fallback` prop for custom error UI.

---

## Day 22 — Organization Pages

### Create Organization (`/organizations/new`)

**Slug auto-generation:** As the user types in the name field, the slug field updates automatically. Rules: lowercase only, spaces become hyphens, special characters removed, consecutive hyphens collapsed. Once the user manually edits the slug field, auto-generation stops.

**API call:** POST `/organizations` with `{ name, slug, logo? }`. On success: `setActiveOrg(newOrg)` + `fetchUserOrganizations()` + redirect to `/dashboard`.

**Errors:** Slug already taken returns a 409 from the backend and is displayed inline.

### Organization Settings (`/settings/organization`)

Three-tab layout with tab state managed via `useState<Tab>`.

**General tab:** PATCH `/organizations/:id` — update name and logo. Slug is read-only. Success state shown for 3 seconds then auto-dismissed. Dispatches `setActiveOrg` with updated org and refreshes org list.

**Branding tab:** PATCH `/organizations/:id/settings` — update `primaryColor` and `accentColor`. Native `<input type="color">` pickers paired with hex text inputs and live color preview boxes.

**Danger Zone tab:** Only shown to the org owner (`activeOrg.ownerId === user.id`). User must type the exact org slug into a confirmation field before the delete button becomes enabled. DELETE `/organizations/:id`. On success: `clearOrganization()` + redirect to `/dashboard`.

### Members Settings (`/settings/members`)

Fetches members on mount and on every successful action (invite, role change, remove). Re-fetches are intentionally not cached — member list should always be fresh after mutations.

**Role badges:** Color-coded with icon — Crown (amber) for Owner, Shield (blue) for Admin, User (slate) for Member, Eye (light) for Guest.

**Invite modal:** Inline modal (not a separate route). Email + role select. POST `/organizations/:id/invitations`. Backend queues invitation email via Bull → Nodemailer. Modal closes on success and member list re-fetches.

**Member actions:** Dropdown per member row (OWNER/ADMIN only). Cannot change own role. Cannot remove or change OWNER role. ADMIN cannot change other ADMINs.

### Email Verification Flow

TeamFlow uses **Option 3** — full access immediately, only invitation sending gated behind verification. This is the approach used by Slack, Jira, and Asana because it minimizes drop-off while still encouraging verification.

```
Register
  → Cookies set, user logged in
  → Welcome email queued
  → Verification email queued automatically
  → Redirect to /dashboard (full access)

Dashboard (unverified)
  → Amber banner visible between topbar and content
  → All features work EXCEPT inviting members
  → Backend's invitation endpoint checks isEmailVerified and returns 403

Click verify link in email
  → /verify-email?token=xyz
  → GET /auth/verify-email?token=xyz
  → isEmailVerified: true in database
  → fetchCurrentUser() called → Redux user.isEmailVerified updated
  → Amber banner disappears automatically (conditional render)
  → POST /organizations/:id/invitations now works

Resend verification
  → "Resend verification email" link in banner
  → POST /auth/send-verification
  → Old token deleted, new token generated and emailed
  → Button shows "Sending..." then "✓ Email sent"
```

**Verify email page (`/verify-email`):** Reads `token` from URL. Calls `GET /auth/verify-email?token=...`. Three rendered states: loading spinner, success (teal check icon + "Go to dashboard" button), error (red X icon + message + back link). Calls `fetchCurrentUser()` after success to update Redux state immediately without requiring a page reload.

**Verification banner (`components/shared/verification-banner.tsx`):** Rendered between `<Topbar />` and `<main>` in the dashboard layout. Conditionally rendered — returns `null` if `user.isEmailVerified` is true or if dismissed. Dismissing only hides it for the current session — it reappears on next page load until the email is verified.

---

## Email Templates

Four templates in `server/src/modules/email/email.templates.ts`:

| Template | Trigger | Subject |
|---|---|---|
| `welcomeEmail` | Registration | Welcome to TeamFlow, {name}! |
| `passwordResetEmail` | POST /auth/forgot-password | Reset your TeamFlow password |
| `invitationEmail` | POST /organizations/:id/invitations | {name} invited you to join {org} |
| `emailVerificationEmail` | Registration + POST /auth/send-verification | Verify your TeamFlow email address |

All emails are queued via Bull (Redis-backed) and processed asynchronously. The API responds instantly — emails are sent in the background. Failed jobs retry 3 times with exponential backoff (2s → 4s → 8s).

---

## Security Notes

**httpOnly cookies** — access token and refresh token are set as httpOnly cookies by the backend. JavaScript cannot read or access them, preventing XSS token theft. The browser includes them automatically in every request.

**Silent token refresh** — when the access token expires, the Axios interceptor refreshes it transparently. Multiple simultaneous requests that all get 401 are queued and retried together after one refresh — not each triggering a separate refresh.

**Email enumeration prevention** — `/auth/forgot-password` always returns success regardless of whether the email exists.

**Verification gating** — only invitation sending requires a verified email. All other features are fully accessible immediately after registration, reducing friction and drop-off.

**Slug immutability** — org slugs cannot be changed after creation. The settings UI renders the slug as a disabled read-only input with an explanatory note.

---

## Component Conventions

**Client components** — every component using hooks (`useState`, `useEffect`, Redux hooks, `useRouter`, `usePathname`) requires `'use client';` at the top of the file. Next.js App Router defaults to Server Components.

**Form pattern:**
```typescript
const { register, handleSubmit, watch, formState: { errors } } = useForm<FormData>({
  resolver: zodResolver(schema),
  defaultValues: { ... },
});
```

**Redux async dispatch pattern:**
```typescript
const dispatch = useAppDispatch();
const result = await dispatch(loginUser({ email, password }));
if (loginUser.fulfilled.match(result)) {
  router.push('/dashboard');
}
// Error is in Redux state — useAppSelector(state => state.auth.error)
```

**Direct API call pattern (non-Redux):**
```typescript
const [isLoading, setIsLoading] = useState(false);
const [apiError, setApiError] = useState('');

try {
  const response = await api.post(`/organizations/${activeOrg.id}/invitations`, data);
  // handle success
} catch (error: any) {
  setApiError(error?.response?.data?.message || 'Request failed');
} finally {
  setIsLoading(false);
}
```