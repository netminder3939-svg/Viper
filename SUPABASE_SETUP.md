# Viper OS — Supabase setup

This turns Viper OS multi-user and multi-device: your crew and customers share one live dataset, changes stream between devices in real time, and progress photos live in cloud storage. Your project URL + anon key are already wired in `supabase-config.js`.

Do these once. Takes about 10 minutes.

---

## 1. Create the database

Supabase dashboard → **SQL Editor** → **New query** → paste all of **`schema.sql`** → **Run**.

That creates every table, turns on Row-Level Security, enables realtime, creates the `job-photos` storage bucket, and seeds your reference data (branded templates, price book, automations, crew, business settings). Business data (contacts, jobs, invoices…) starts empty — your clean slate. It's safe to re-run.

## 2. Confirm storage + realtime

- **Storage** → you should see a **`job-photos`** bucket (public). If not, create it (public) — the SQL tries to.
- **Database → Replication** (or **Realtime**) → confirm the tables are in the `supabase_realtime` publication (the SQL adds them).

## 3. Create your owner login

1. **Authentication → Users → Add user** → enter your email + a password → **Create** (tick "auto-confirm").
2. Copy that user's **UID**.
3. Back in **SQL Editor**, run (paste your UID + email):

```sql
insert into public.profiles (id, role, member_id, email)
values ('PASTE-USER-UID', 'owner', 'u_owner', 'you@yourbusiness.com');
```

That maps your login to the **owner** role. (If you skip this you'll still get in as owner — but the profile is what makes roles official and is required for techs/customers.)

## 4. Allow magic-link redirects

**Authentication → URL Configuration** → add your deployed site URL (e.g. `https://your-app.vercel.app`) to **Redirect URLs** and **Site URL**. Customer magic links won't return without this.

## 5. Deploy & sign in

Redeploy to Vercel (the config is already committed). Open the app → you'll get the **Sign in** screen → **Staff** tab → your email + password. You're in, on the cloud, syncing.

> The old one-tap role picker is still there under **"Explore offline (no cloud)"** — that runs on this browser only, handy for a quick demo.

---

## Add your crew (techs)

1. In the app: **Settings → Team → Add member** (creates their team record). Or rename the seeded `u_cofd` / `u_ops`.
2. Find that member's **id**: **Settings → Data → Export backup**, open the JSON, find the person under `team` (e.g. `"id":"u_1712..."`).
3. **Authentication → Users → Add user** with the tech's email + password.
4. Link them (SQL):

```sql
insert into public.profiles (id, role, member_id, email)
values ('TECH-USER-UID', 'tech', 'THEIR-TEAM-ID', 'tech@email.com');
```

They sign in on the **Staff** tab and land in **field mode** with their jobs.

## Add customers

1. Make sure the customer exists as a **Contact** in the app; grab their contact **id** (same export trick, under `contacts`, e.g. `c_...`).
2. Link their email to that contact:

```sql
insert into public.profiles (id, role, contact_id, email)
values (gen_random_uuid(), 'customer', 'THEIR-CONTACT-ID', 'client@email.com');
```

> For customers, the cleanest flow is passwordless: they enter their email on the **Customer** tab, get a magic link, and click it. On first sign-in Supabase creates their auth user — then update the profile row's `id` to that new user's UID (or pre-create the user in **Authentication → Users**). If you want, I can wire a tiny SQL trigger that auto-links a new customer auth user to a contact by matching email — just ask.

---

## Before real customers see it: turn on production security

While it's just you and staff, the schema runs in **development mode** — any *signed-in* user can read/write everything (nothing is public; a login is required). That's fine for testing.

**Before you give a real customer a login,** switch to role-scoped security so a customer can only ever see their own jobs and invoices: open `schema.sql`, find the **MODE B — PRODUCTION** block, follow the two steps in the comments (drop the dev policies, then run the production policies). Want me to tailor those policies to exactly how you run your crew? Say the word.

---

## What still uses env vars (unchanged)

The AI assistant and real email/SMS use serverless functions, not Supabase. Keep those keys in **Vercel → Settings → Environment Variables**: `ANTHROPIC_API_KEY`, and (optional) `RESEND_API_KEY` / `MAIL_FROM` / `TWILIO_*`. The Supabase **service_role** key is *not* needed anywhere in this app — never put it in the frontend.

## If something's off

- App loads but says "running on local storage" in the console → the Supabase library or config did not load; make sure `supabase-lib.js`, `supabase-config.js`, and `supabase.js` all deployed. A yellow "Cloud library didn't load" banner means `supabase-lib.js` is missing.
- Signed in but no data → confirm `schema.sql` ran (tables exist) and RLS policies were created; check the browser console for policy errors.
- Photos don't upload → confirm the `job-photos` bucket exists and is public.

I built and tested the sync engine against a mocked client (hydrate, diff-push, realtime, storage all verified), but the live auth + policy round-trip is the one thing only your project can confirm — run through it and tell me what you see, and I'll fix anything that snags.
