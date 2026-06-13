import { createClient } from "@supabase/supabase-js";

// URL do projeto e publica (esta no .env.local.example). A anon key NUNCA fica
// versionada: vem de NEXT_PUBLIC_SUPABASE_ANON_KEY no .env.local (gitignored).
// Os defaults abaixo evitam que o build/dev quebre quando o .env.local nao existe;
// nesse caso as queries simplesmente falham (mostramos banner + empty-states).
const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://yipwbjexekvrqgnpvjfn.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "MISSING_SUPABASE_ANON_KEY";

export const hasSupabaseEnv = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
  realtime: { params: { eventsPerSecond: 2 } },
});
