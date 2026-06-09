# Polla Mundialista 2026

World Cup 2026 prediction pool for friend groups. Bilingual (ES/EN).

## Quick start

```bash
# 1. Create Supabase project at https://supabase.com
# 2. Copy .env.example to .env.local and fill in your keys
cp .env.example .env.local

# 3. Install deps
npm install

# 4. Run the SQL migration against your Supabase project
#    Option A: paste supabase/migrations/0001_initial_schema.sql into Supabase SQL Editor
#    Option B: use Drizzle
npx drizzle-kit push

# 5. Seed teams and matches
npx tsx scripts/seed.ts

# 6. Start dev server
npm run dev
```

## Continuing development with Claude

This project includes a `CLAUDE.md` file with full context. Open the project folder in Claude Code or Cowork and Claude will pick up exactly where we left off.

## Project structure

See `CLAUDE.md` for architecture details and `docs/PRD.md` for the full product spec.
