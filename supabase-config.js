/* Viper OS — Supabase config.
   The anon (public) key is designed to be exposed in the browser, so this
   file is safe to commit and deploy. RLS is what actually protects your data.
   NEVER put the service_role key here. */

/* ── TESTING MODE ──────────────────────────────────────────────
   Set to true to REMOVE the login entirely — the app opens straight to the
   dashboard on the device, so anyone (e.g. Ben) can test with zero sign-in.
   Data is saved in that browser only (no cloud sync while this is on).
   Set back to false to turn the cloud login screen back on. */
window.VIPER_NO_LOGIN = true;

window.SUPABASE_URL = 'https://segoddloglztbflylqqf.supabase.co';
window.SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNlZ29kZGxvZ2x6dGJmbHlscXFmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5MjM0MjgsImV4cCI6MjA5ODQ5OTQyOH0.d2D56hK7l_nGtJ7UqqaQuffd2vTDsd3NW1xNdlP8Krs';
