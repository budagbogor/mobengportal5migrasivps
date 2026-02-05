
import { createClient } from '@supabase/supabase-js';

// Project Reference derived from your JWT Token
const PROJECT_REF = 'ogaxelnnaxojzrbrewaf';
const SUPABASE_URL = `https://${PROJECT_REF}.supabase.co`;

// The Anon Key provided in the prompt. 
// IN PRODUCTION/VERCEL: It is recommended to put this in "Environment Variables" setting in Vercel as REACT_APP_SUPABASE_KEY
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9nYXhlbG5uYXhvanpyYnJld2FmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAyNzYxNjksImV4cCI6MjA4NTg1MjE2OX0.d9KU-OK86TO7isTTgBZ09n4u8mb4rPghK2gq6RZiosQ';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
