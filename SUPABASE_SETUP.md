# Supabase Setup — Habuild Nutrition

5-minute setup to make user submissions go live across all devices.

## 1. Create a free Supabase project

1. Go to **https://supabase.com** → sign up (free, GitHub login works)
2. Click "New project" → name it `habuild-nutrition` (region: closest to your users — Mumbai/Singapore for India)
3. Set a strong DB password (you won't need it for the prototype)
4. Wait ~2 min for provisioning

## 2. Run the SQL to create the `submissions` table

In your Supabase dashboard → **SQL Editor** → paste and run:

```sql
-- Community recipe submissions
create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  member_name text,
  city text,
  dish text not null,
  note text,
  condition_tag text,
  image_url text,
  initial text,
  created_at timestamptz default now()
);

-- Allow anyone to read submissions
create policy "Public read submissions"
  on public.submissions for select
  using (true);

-- Allow anyone to insert (no auth required for prototype)
create policy "Public insert submissions"
  on public.submissions for insert
  with check (true);

alter table public.submissions enable row level security;
```

## 3. Create a public Storage bucket for photos

In your Supabase dashboard → **Storage** → "New bucket":

- Name: `submission-photos`
- **Public bucket**: ✅ Yes
- File size limit: 5 MB

Then add a policy. In Storage → `submission-photos` → Policies → "New policy":

```sql
-- Public read
create policy "Public read photos"
  on storage.objects for select
  using (bucket_id = 'submission-photos');

-- Public insert (no auth)
create policy "Public upload photos"
  on storage.objects for insert
  with check (bucket_id = 'submission-photos');
```

## 4. Get your credentials

In Supabase dashboard → **Project Settings** → **API**:

- Copy the **Project URL** (e.g. `https://abcd1234.supabase.co`)
- Copy the **anon public key** (long string starting with `eyJ...`)

## 5. Paste into the prototype

Open `recipe-features-nutrition-magazine.html` and find this block near the top of `<script>`:

```js
const SUPABASE_URL = '';
const SUPABASE_ANON_KEY = '';
```

Replace with your values:

```js
const SUPABASE_URL = 'https://abcd1234.supabase.co';
const SUPABASE_ANON_KEY = 'eyJ...';
```

Save. Reload the app. Open the console — you should see `[backend] Supabase active`.

## How to test

1. Open the prototype in browser A → tap "Featured Today" → tap the dashed "+ Apni recipe add karein" tile (or "Apni dish add karein" button at bottom)
2. Fill: photo, dish name, 1-line note, optional condition tag → submit
3. Open the prototype in browser B (or incognito) → the new submission should appear in the "Aur members ki dishes" grid within ~3 seconds

## Notes

- The anon key is meant to be public — it only allows what the RLS policies allow (read + insert here)
- Free tier: 500 MB DB, 1 GB Storage, 50K monthly active users — plenty for a prototype
- For production: add Auth, soft moderation (e.g. an `approved` boolean column), and a Habuild team review queue

## Fallback

If credentials are blank, the prototype works fine in **localStorage-only mode** — submissions persist on that device but aren't shared across users. The UI shows different success messages so it's clear which mode you're in.
