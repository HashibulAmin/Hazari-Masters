# Hazari Masters

Hazari Masters is a real-time, four-player implementation of the Hazari card game. Play at a shared table, invite other players, or let AI agents fill open seats. Matches use the 1,000-point championship target.

## Features

- Real-time multiplayer tables powered by Socket.IO, with human players and AI agents.
- Email/password, Google, and guest sign-in through Firebase Authentication.
- Table browsing, invitations, completed-game history, and player profiles backed by Firestore.
- Hand arrangement assistance with optimal, aggressive, defensive, and balanced strategies.
- An offline strategy model and a game-data pipeline for recording completed games and training the model.
- Responsive web app with installable PWA support.
- Hazari rules engine covering card evaluation, dealing, arrangements, trick resolution, and the 1,000-point win condition.

## Technology

- React 19, TypeScript, and Vite
- Express and Socket.IO
- Firebase Authentication and Cloud Firestore
- Redux Toolkit

## Requirements

- Node.js with npm, or Bun
- A Firebase project configured for this app

## Getting Started

1. Install dependencies from the project root:

   ```sh
   bun install
   ```

   Alternatively, use `npm install`.

2. Configure Firebase as described below. The app imports `firebase-applet-config.json` from the project root; this file is excluded from Git, so provide your own project configuration.

3. Start the development server:

   ```sh
   bun run dev
   ```

   Alternatively, run `npm run dev`. Open [http://localhost:3000](http://localhost:3000). The server starts on port 3000 by default; set `PORT` to use another port.

## Firebase Setup

Create `firebase-applet-config.json` in the project root with your Firebase web app configuration, including the Firestore database ID (`firestoreDatabaseId`). Keep this file private and do not commit it. The configuration is imported by the client app and is not a substitute for Firestore security rules.

In the Firebase console:

- Enable the Authentication providers you intend to use: Email/Password, Google, and Anonymous (for Firebase-backed guest sessions).
- Create or select the Firestore database whose ID is configured in the app.
- Review and deploy the project's [`firestore.rules`](firestore.rules) before using a shared or public deployment.

Guest play has a local-session fallback if anonymous Firebase sign-in is unavailable. Features that rely on Firestore still require a reachable, correctly configured Firebase project.

The repository also includes `.env.example` with the optional `APP_URL` setting for hosted deployments. The server loads environment variables with `dotenv` and uses `PORT` to select its listening port.

## Commands

| Command | Description |
| --- | --- |
| `bun run dev` | Start the development server with Vite middleware and Socket.IO. |
| `bun run build` | Build the frontend into `dist/`. |
| `bun run lint` | Run the TypeScript check (`tsc --noEmit`). |
| `bun run preview` | Preview the Vite production build. |
| `bun run start` | Start the server entry point; set `NODE_ENV=production` after building to serve `dist/`. |

Use `npm run <command>` instead if you installed dependencies with npm. In PowerShell, start the production server with:

```powershell
$env:NODE_ENV = "production"
bun run start
```

Build first with `bun run build`. In a POSIX shell, use `NODE_ENV=production bun run start`.

## HTTP Endpoints

- `GET /api/health` reports server health, active in-memory tables, and model pipeline status.
- `GET /api/table/:tableId` returns the current state for an active table.
- `POST /api/test/run-unit-tests` runs the Hazari core checks and returns their results.
- `GET /api/model/status` returns the game-data pipeline and model status.
- `POST /api/model/train-now` triggers model training.
- `POST /api/model/train-from-firebase` trains from a `games` array in the JSON request body.

Game actions and live state updates use Socket.IO. Active table state is held in the server process memory; it is not durable across server restarts. User profiles, invitations, and completed-game records use Firestore through the client services.

## Project Layout

- `src/components/` contains the game, dashboard, authentication, and modal UI.
- `src/core/hazari/` contains the card game rules, evaluator, arranger, AI, and offline model.
- `src/firebase/` contains Firebase authentication and table services.
- `src/store/` contains Redux state and Socket.IO middleware.
- `server.ts` starts the Express, Vite, and Socket.IO server.
- `server/` contains table management and the game-data pipeline.
- `data/` contains the offline model data.
- `public/` contains static assets and the PWA manifest.

## Rules Engine Checks

The core test function is also exposed by the running server at `POST /api/test/run-unit-tests`. It checks deck integrity, hand evaluation and arrangement, trick resolution, and the 1,000-point win condition.