// Scripts/supabaseClient.js
const SUPABASE_URL = "https://rnxeqexgzgismtnnfemv.supabase.co"; // ✅ Replace with real URL
const SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJueGVxZXhnemdpc210bm5mZW12Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc0ODI4ODMsImV4cCI6MjA2MzA1ODg4M30.-mAHroO8q7hKoN9_5wwkkPNwY-A4rWKrwVwb2Nr-zoM"; // ✅ Replace with real key

// Only initialize once
window.supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
