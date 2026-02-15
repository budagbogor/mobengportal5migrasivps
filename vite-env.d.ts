// Fixed: Removed reference to missing 'vite/client' type definition file.
// Kept custom interface definitions for import.meta.env support.

interface ImportMetaEnv {
  readonly VITE_GEMINI_API_KEY: string
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_OPENROUTER_API_KEY: string
  // more env variables...
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}