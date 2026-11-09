# FishLog

A responsive fishing journal website with:
- Email/password accounts
- Private online catch records and photo storage
- AI fish identification (with editable/manual species entry)
- Search, species filter, and sorting by species, weight, length, and date
- Catch statistics and species breakdown

## Architecture

- Front end: static HTML/CSS/JavaScript (can be hosted on GitHub Pages)
- Accounts, database, private photo storage: Supabase
- AI identification: Supabase Edge Function calling OpenAI (API key stays server-side)

## 1. Create a Supabase project

1. Create a project at https://supabase.com.
2. In **Project Settings → API**, copy the Project URL and `anon` / publishable key.
3. Put them in `config.js`:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
4. In **SQL Editor**, run all of `supabase/schema.sql`.

The SQL creates a `catches` table, row-level security rules, and a private `catch-photos` storage bucket. Each account can access only its own records and images.

## 2. Configure AI identification

You need an OpenAI API key with API billing enabled. Do not put this key in `config.js`, `app.js`, or any public GitHub file.

Install the Supabase CLI, sign in, and link the project:
```bash
npm install -g supabase
supabase login
supabase link --project-ref YOUR_PROJECT_REF
```

Set the secrets:
```bash
supabase secrets set OPENAI_API_KEY=YOUR_OPENAI_API_KEY
supabase secrets set SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

Deploy the function:
```bash
supabase functions deploy fish-identify
```

The function uses the signed-in user's session and calls the vision-capable `gpt-4o-mini` model. The result is a suggestion, not a guaranteed identification; users can edit the species before saving.

## 3. Test locally

Because the app uses Supabase, serve the folder through a local web server (not by double-clicking the HTML file):
```bash
python -m http.server 8000
```
Then open http://localhost:8000.

## 4. Publish with GitHub Pages

1. Create a GitHub repository.
2. Upload `index.html`, `styles.css`, `app.js`, and `config.js` to the repository root.
3. In repository **Settings → Pages**, choose the `main` branch and `/ (root)`.
4. Save and wait for GitHub Pages to publish.

Keep the Supabase SQL and Edge Function source in the repository for maintenance, but never commit API secrets. The browser config contains only the Supabase anon/public key, which is designed to be exposed when Row Level Security is correctly configured.

## Notes / next improvements

- Email confirmation settings are controlled in Supabase Authentication.
- Photo storage is private. This starter stores a long-lived signed image URL with each catch for convenient gallery display. For stricter privacy at scale, generate short-lived signed URLs on every page load instead.
- Add edit-catch functionality, password reset, account deletion, and export/backup before treating this as a production-grade journal.
- Fish identification accuracy depends on photo quality, angle, and geographic context. Always verify regulated or protected species and local fishing rules independently.
