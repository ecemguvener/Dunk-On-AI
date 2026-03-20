# Dunk On AI — Fantasy Basketball App

A fantasy basketball web app where users build a team and compete against AI opponents.

## Tech Stack

| Layer    | Technology                              |
| -------- | --------------------------------------- |
| Frontend | React 18 + Vite + Framer Motion         |
| Backend  | Python + Flask                          |
| Auth     | Supabase Auth (email/password)          |
| Database | Supabase (PostgreSQL via PostgREST API) |

All database access goes through the **Supabase PostgREST HTTP API** — no raw database connection string is needed.

---

## Dev Setup

### 1. Environment Variables

Create a `.env` file in the repo root:

```env
SUPABASE_URL=https://<your-project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
```

Keep `.env` out of git — it's already in `.gitignore`.

### 2. Backend (Flask)

```bash
python -m venv venv
venv\Scripts\activate
pip install -r Backend\requirements.txt
flask --app "Backend:create_app" run --debug
```

Flask starts on `http://127.0.0.1:5000`.

Quick backend smoke test:

```bash
bash Backend/smoke_test_backend.sh
```

If your backend runs on a different port:

```bash
BASE_URL=http://127.0.0.1:5001 bash Backend/smoke_test_backend.sh
```

### 3. Frontend (React + Vite)

```bash
cd Frontend
npm install
npm run dev
```

Vite starts on `http://localhost:5173` and proxies all `/api/*` requests to Flask automatically.

---

## API Reference

Base URL: `http://127.0.0.1:5000/api`

### Health

| Method | Endpoint           | Description                               |
| ------ | ------------------ | ----------------------------------------- |
| GET    | `/health`          | Returns `{ "status": "ok" }`              |
| GET    | `/supabase/health` | Verifies Supabase connection and env vars |

### Auth

| Method | Endpoint       | Description             |
| ------ | -------------- | ----------------------- |
| POST   | `/auth/signup` | Register a new user     |
| POST   | `/auth/login`  | Log in an existing user |

**Signup body:**

```json
{
  "email": "user@example.com",
  "password": "mypassword",
  "username": "optional"
}
```

**Login body:**

```json
{ "email": "user@example.com", "password": "mypassword" }
```

**Both return:**

```json
{
  "user": {
    "id": 1,
    "email": "...",
    "username": "...",
    "supabase_auth_id": "..."
  },
  "auth": { "access_token": "...", "refresh_token": "...", "expires_at": 0 }
}
```

### Roster

All roster endpoints are scoped to a user via `<user_id>` (the `id` from the users table).

| Method | Endpoint                               | Description                                  |
| ------ | -------------------------------------- | -------------------------------------------- |
| GET    | `/users/<user_id>/roster`              | Get roster (optional `?role=starter\|bench`) |
| POST   | `/users/<user_id>/roster`              | Add a player                                 |
| DELETE | `/users/<user_id>/roster/<player_id>`  | Remove a player                              |
| PATCH  | `/users/<user_id>/roster/<player_id>`  | Update a player's role                       |
| POST   | `/users/<user_id>/roster/swap`         | Swap roles between two players               |
| DELETE | `/users/<user_id>/roster?confirm=true` | Clear entire roster                          |
| POST   | `/users/<user_id>/roster/bulk`         | Add multiple players at once                 |

**Add player body:**

```json
{ "player_id": 123, "role": "starter" }
```

**Update role body:**

```json
{ "role": "bench" }
```

**Swap body:**

```json
{ "player_1_id": 1, "player_2_id": 2 }
```

**Bulk add body:**

```json
{ "players": [{ "player_id": 1, "role": "starter" }, { "player_id": 2 }] }
```

**Roster constraints:** max 5 players total, one per position (PG, SG, SF, PF, C).

---

## Project Structure

```
Basketball-Fantasy-Helper/
├── Backend/
│   ├── __init__.py          # Flask app factory, blueprint registration
│   ├── auth_routes.py       # POST /api/auth/signup, /api/auth/login
│   ├── roster_routes.py     # Roster CRUD endpoints
│   ├── routes.py            # Health check endpoints
│   ├── models.py            # SQLAlchemy models (schema reference, not used for queries)
│   ├── supabaseclient.py    # Cached Supabase client (reads SUPABASE_URL + KEY from env)
│   ├── constants.py         # Roster limits, error codes, valid roles
│   └── utils/
│       ├── validators.py    # Input validation and existence checks via Supabase API
│       ├── serializers.py   # Convert Supabase dicts to API response format
│       └── errors.py        # Standardized error response helpers
├── Frontend/
│   ├── src/
│   │   ├── App.jsx          # All React components and routing
│   │   └── index.css        # All styles
│   ├── vite.config.js       # Dev server + /api proxy to Flask
│   └── package.json
├── .env                     # Supabase credentials (never commit this)
└── README.md
```

---

## Adding New Routes

1. Create a new file e.g. `Backend/matchup_routes.py` with a `Blueprint`
2. Register it in `Backend/__init__.py` inside `create_app`
3. Get the Supabase client at the top of each endpoint with `client = get_supabase_client()`
4. Use `client.table("your_table").select/insert/update/delete(...)` for all DB access

## Frontend Roster Rules

- Roster is capped at **5 players**, one per position.
- Selecting a player whose position is already on the roster (saved or pending) is blocked with an error message.
- Players with a taken position appear dimmed in the player list.
- The detail page add button shows `[POS] Taken` and is disabled when the position is already filled.

## Backend Status

Current backend integration pass is complete:

- auth endpoints working (`/api/auth/signup`, `/api/auth/login`)
- roster endpoints validated + bulk add checks improved
- Supabase env loading integrated for local `.env` usage
- backend smoke test script added (`Backend/smoke_test_backend.sh`)
