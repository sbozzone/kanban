# Kanban

A personal kanban board that stays in sync between your phone and your computer.

Three columns — **To do**, **In progress**, **Done**. Cards have a title and
optional notes. Drag them between columns on a desktop, or use the `‹` `›`
buttons, which work just as well on a touchscreen. A change on one device shows
up on the other within a second, without a refresh.

## How it works

- **Vite + React + TypeScript**, built to static files.
- **Supabase** is the whole backend: Postgres stores the cards, Auth handles
  sign-in, Realtime pushes changes to the other device.
- **Vercel** serves the static build.

There is no server code to maintain. The browser talks to Supabase directly, and
Postgres row level security is what keeps the data private — every policy checks
`auth.uid() = user_id`, so a card is only ever readable by the account that made
it.

## Setup

You need a [Supabase](https://supabase.com) project and a
[Vercel](https://vercel.com) account. Both are free at this size.

### 1. Create the database

In your Supabase project, open **SQL Editor**, paste in the contents of
[`supabase/schema.sql`](supabase/schema.sql), and run it. That creates the
`cards` table, its indexes, the row level security policies, and the Realtime
publication. The script is safe to run more than once.

### 2. Turn on email sign-in

Under **Authentication → Sign In / Up → Email**, make sure email is enabled.
Sign-in uses a magic link, so you never set a password.

Under **Authentication → URL Configuration**, add your site URL and
`http://localhost:5173` to the redirect allow list, so the link in the email
knows where to send you back to.

### 3. Run it locally

```bash
npm install
cp .env.example .env.local   # then fill in the two values
npm run dev
```

Both values come from the Supabase dashboard, under **Project Settings → Data
API**:

| Variable                  | Where to find it              |
| ------------------------- | ----------------------------- |
| `VITE_SUPABASE_URL`       | Project URL                   |
| `VITE_SUPABASE_ANON_KEY`  | Project API key, `anon public` |

The anon key is designed to be public — it identifies the project, and the row
level security policies are what actually protect the data. Don't use the
`service_role` key here; it bypasses those policies.

### 4. Deploy

Import the repository on Vercel. It detects Vite on its own, so the only thing
to configure is **Settings → Environment Variables** — add `VITE_SUPABASE_URL`
and `VITE_SUPABASE_ANON_KEY` with the same values as above, then deploy.

Afterwards, put the deployed URL back into Supabase's redirect allow list
(step 2) so the sign-in email works in production.

### 5. Put it on your phone

Open the deployed URL in your phone's browser and use **Add to Home Screen**.
Sign in with the same email address you used on your computer and the same board
appears.

## Working on it

```bash
npm run dev        # local dev server
npm run typecheck  # TypeScript, no emit
npm run build      # typecheck, then production build
```

Layout of the source:

```
src/
  App.tsx              session handling: sign-in screen or board
  components/
    Auth.tsx           magic-link sign in
    Board.tsx          columns, dialog state, drag state
    Column.tsx         one column, including where a drop lands
    CardItem.tsx       one card
    CardDialog.tsx     new/edit card form
    Setup.tsx          shown when the build has no Supabase credentials
  lib/
    supabase.ts        client
    types.ts           Card, Status, the column list
    useCards.ts        load, realtime, and all mutations
supabase/schema.sql    tables, policies, realtime
```

### How ordering works

Cards carry a floating point `position` rather than an integer index. Dropping a
card between two others gives it the midpoint of their positions, so a move is a
single row update and never has to renumber the column.

## Known limitations

- **No offline support.** The app needs a connection; it isn't a full offline
  PWA with a service worker and a sync queue.
- **The columns are fixed.** To do / In progress / Done are defined in
  `src/lib/types.ts` and in a `check` constraint in the schema. Changing them
  means editing both.
- **One board per account.** There's no notion of multiple boards or projects.
