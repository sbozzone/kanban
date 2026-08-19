# Cairn

A personal kanban board that stays in sync between your phone and your computer.

Named for the stacks of stones that mark a trail — one placed at a time.

Three columns — **To do**, **In progress**, **Done**. Cards have a title and
optional notes. Drag them between columns on a desktop, or use the `‹` `›`
buttons, which work just as well on a touchscreen.

## How it works

- **Vite + React + TypeScript**, built to static files.
- **One serverless function** (`api/board.ts`) reads and writes the whole board
  as a single JSON document.
- **Upstash Redis** stores that document.
- **Vercel** serves both halves.

This is built for exactly one person. There are no accounts — a single
passphrase unlocks the board, and your browser remembers it until you press
**Lock**. That is the whole authorization model, which is why the passphrase
should be long.

### Why a passphrase and not accounts

Accounts exist to tell users apart. With one user there is nobody to tell apart,
only strangers to keep out, and a passphrase does that with no sign-up flow, no
email round trip, and no per-row security rules.

The tradeoff is real: anyone with the URL *and* the passphrase is in. There is
no password reset, and no way to revoke one device without changing the
passphrase everywhere.

### Why the board is one document

The whole board is small — a few hundred cards at most — so it is stored as one
JSON blob rather than a row per card. That keeps the server to one file.

To stop one device from overwriting the other, the document carries a revision
number. Every write sends the revision it was based on, and the server rejects
anything stale with `409` plus the newer board. The client then replays the same
change onto that newer board and retries, so a late write merges instead of
clobbering. Changes are modelled as pure functions for exactly this reason.

### Keeping devices current

There is no realtime push. The board reloads when a tab regains focus, which
matches how one person actually works — you put the phone down, you open the
laptop. Pick up a device and you are looking at current state.

## Setup

You need a [Vercel](https://vercel.com) account. Everything here fits the free
tier.

### 1. Add Redis

In your Vercel project, go to **Storage** and add **Upstash Redis** from the
marketplace. Connecting it sets the URL and token environment variables for you.

### 2. Set a passphrase

In **Settings → Environment Variables**, add:

| Variable | Value |
| --- | --- |
| `BOARD_PASSPHRASE` | a long passphrase of your choosing |

**Do not give it a `VITE_` prefix.** That prefix is what tells Vite to inline a
value into the browser bundle, where anyone could read it. Unprefixed variables
stay on the server, which is the entire point.

### 3. Deploy

Import the repository on Vercel. It detects Vite, builds the frontend, and
deploys `api/board.ts` as a function automatically — no extra configuration.

### 4. Put it on your phone

Open the deployed URL, enter the passphrase, and use **Add to Home Screen**.
Do the same on your computer. Both now read and write the same board.

## Working on it

```bash
npm install
npm run typecheck   # both the app and the function
npm run build       # typecheck, then production build
```

For the frontend alone, `npm run dev` is enough. It does **not** serve `api/`,
so anything touching the board will fail with a JSON parse error — Vite returns
`index.html` for the unmatched route. To run both together:

```bash
cp .env.example .env.local   # fill in the three values
npx vercel dev
```

Layout of the source:

```
api/
  board.ts             GET and PUT the board, passphrase-gated
src/
  App.tsx              locked or unlocked
  components/
    Passphrase.tsx     the unlock screen
    Board.tsx          columns, dialog state, drag state
    Column.tsx         one column, including where a drop lands
    CardItem.tsx       one card
    CardDialog.tsx     new/edit card form
  lib/
    api.ts             fetch wrapper, passphrase storage, typed errors
    types.ts           Card, Board, Status, the column list
    useBoard.ts        load, refresh on focus, and all mutations
```

### How ordering works

Cards carry a floating point `position` rather than an integer index. Dropping a
card between two others gives it the midpoint of their positions, so a move
never has to renumber the column.

## Known limitations

- **No offline support.** The app needs a connection.
- **No tests in the repo.** The handler and the browser flow were both exercised
  during development, but nothing is wired up to run on its own.
- **The columns are fixed.** To do / In progress / Done are defined in
  `src/lib/types.ts`.
- **One board.** No notion of multiple boards or projects.
