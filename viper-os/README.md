# Viper OS

One operations platform for Viper Electric — CRM, sales pipeline, scheduling, estimates, invoicing, a unified inbox, **branded automations**, reporting, an AI assistant, plus **three role-based experiences**: an owner command center, a mobile **field/dispatch mode** for techs, and a **customer portal**. Built to replace juggling Jobber + HubSpot + GoHighLevel.

No build step, no framework. Static files (HTML/CSS/JS) plus two small serverless functions. Deploys to Vercel in ~2 minutes.

---

## Deploy to Vercel

**Drag & drop:** vercel.com → New Project → drag this `viper-os` folder in → Framework preset **Other** → Deploy.
**CLI:** `npm i -g vercel && cd viper-os && vercel --prod`
**GitHub:** push the folder to a repo and Import it in Vercel (auto-deploys on push).
**Local preview:** `npm run dev`.

---

## The three logins

Click **"Switch role / log in"** at the bottom of the sidebar (or the **Field mode** button on the dashboard) to open the sign-in screen. Three roles:

- **Owner / Admin** — the full command center. This is your main dashboard.
- **Field Tech** — a phone-first dispatch view. The tech sees only *their* jobs for today, taps **I'm on my way** (texts the client), starts/completes jobs, and snaps **progress photos** that sync straight to the office and the customer.
- **Customer** — a client portal where your customer tracks job progress on a live stepper, sees the **progress photos** your tech uploaded, approves estimates, pays invoices, and messages you.

> Sign-in is currently a one-tap demo picker (no passwords). Real per-user authentication comes with the Supabase step below.

---

## What's new / now working

- **Automatic stage progression.** Contacts move **Lead → Prospect → Customer** on their own: sending an estimate makes them a Prospect; a won deal or a paid invoice makes them a Customer.
- **Pipeline transition actions.** Moving a deal between stages now *does something* — it advances the contact, fires the right branded message, creates the next-step task, and confirms it on screen.
- **Fully editable, branded messages.** The **Messages** screen holds every automated email & text. Edit the wording, drop in merge fields like `{{client_name}}` and `{{amount}}`, upload your **logo**, set your brand color and email footer, and see a **live preview**. Everything the system sends lands in the **Outbox**.
- **Editable automations + a real runner.** Each automation's *when/then* and message are editable, with a one-click **Test**. Time-based rules (estimate follow-ups after 5 days, overdue reminders) now **fire on their own** when you open the app — you'll see a note and the messages in the Outbox.
- **Price book.** A catalog of reusable priced services (with *your cost* baked in). Build estimates and invoices in seconds with **Add from price book**.
- **Job costing & profitability.** Every job tracks materials + labor (from time entries) against revenue, so the job drawer shows **real margin**. Reports add **job profitability** and **A/R aging**.
- **Time tracking.** Techs **clock in / out** on a job in field mode; hours roll up into the **Timesheets** screen and into labor cost.
- **Requests (Client Hub).** A public **Request a quote** form (linked from the sign-in screen) lands as a new request; convert it to a lead + deal in one tap, which fires your new-lead welcome.
- **Branded PDFs.** Download a clean, branded **PDF** of any estimate or invoice.
- **Backup & restore.** Export your whole workspace to a JSON file and import it back (Settings → Data).
- **Deeper, customizable dashboard** with revenue trend, collected vs. outstanding, win rate, average job value, new leads, active jobs, and a **team leaderboard**. Hit **Customize** to show/hide widgets.
- **Field/dispatch mode & customer portal** — three role logins (Owner · Field Tech · Customer) with progress photos, on-my-way texts, approvals, and payments.

---

## Turn on the AI assistant

Works in demo mode out of the box. To make it live: get a key at console.anthropic.com, add `ANTHROPIC_API_KEY` in Vercel → Settings → Environment Variables, and redeploy. The key stays server-side in `api/chat.js`.

## Turn on real email & texts (optional)

Automations and the on-my-way button always log to the Outbox. To actually **send**, add keys in Vercel → Settings → Environment Variables (handled by `api/send.js`):

- **Email (Resend):** `RESEND_API_KEY`, `MAIL_FROM` (e.g. `Viper Electric <office@yourdomain.com>`)
- **SMS (Twilio):** `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM` (your Twilio number)

No keys = it simulates the send and still records it in the Outbox, so nothing breaks.

## Card payments (optional)

The customer portal's **Pay** button is wired for Stripe checkout. Add your Stripe keys to take real card payments; until then it simulates a successful payment and sends a receipt.

---

## Data & the cloud (Supabase)

**Now wired for Supabase** — multi-user, multi-device, realtime. Your project URL + anon key are in `supabase-config.js`; run `schema.sql` and follow **`SUPABASE_SETUP.md`** (about 10 minutes) to go live. Once set up: staff sign in with email/password, customers with a magic link, progress photos store in the cloud, and a change on a tech's phone streams to your dashboard live.

Every collection maps 1:1 to a table, so the app didn't need rewriting — a sync layer (`supabase.js`) hydrates the app on sign-in, mirrors every change up as a diff, and streams other devices' changes back down. **If Supabase isn't reachable, the app automatically falls back to on-device storage — it never breaks.**

Until you run the setup, or via the **"Explore offline"** link on the sign-in screen, data lives in this browser's `localStorage` (per-device). Use **Settings → Data** to export a backup or reset to sample data.

---

## File map

```
viper-os/
├── index.html      app shell + mount points
├── styles.css      full design system (+ field/portal/login/templates)
├── store.js        data layer (→ future Supabase tables)
├── app.js          engine: render, routing, icons, charts, UI primitives
├── views.js        owner screens, drawers, forms, actions
├── pro.js          roles/login, field mode, portal, templates, outbox,
│                   automation engine, enhanced dashboard
├── plus.js         price book, job costing/profit, time tracking,
│                   requests intake, PDF export, automation runner, backup
├── api/chat.js     serverless AI proxy (keeps your Anthropic key server-side)
├── api/send.js     serverless email/SMS sender (Resend + Twilio, optional)
├── vercel.json     routing config
└── package.json    local-preview scripts
```
