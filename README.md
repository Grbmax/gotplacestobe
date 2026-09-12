# Got Places To Be (Quest)

Campus favors that are too small to pay for — plus **Inspect**, a Gemini-first rental surface scan for mold, water seepage, cracks, peeling paint, and optional infestation signs.

## Run locally

```bash
cp .env.example .env.local
# fill GEMINI_API_KEY and MONGODB_URI
npm install
npm run dev -- -p 43127
```

Open [http://127.0.0.1:43127](http://127.0.0.1:43127).

## Inspect flow

1. Join / open the map as usual.
2. Tap **Inspect** in the bottom nav (or go to `/inspect`).
3. Add a stay/lease/sublet, open the scanner, tag room + surface, shutter.
4. Gemini returns structured findings (mock fallback if the key is missing or the call fails).
5. Past scans live on `/inspect/[propertyId]` with a light progression compare.

SCAN data is stored in a separate Mongo database name `scan` (`properties`, `scans`, `findings`) so Quest collections `users`, `quests`, and `transactions` stay untouched.

## Env

See `.env.example`. Never commit `.env` / `.env.local`.
