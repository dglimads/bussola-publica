"use client";
import { useEffect } from "react";
import { useSWRConfig } from "swr";
import { supabase } from "./supabaseClient";

// Realtime DESLIGADO por padrao em publicacao publica: ele exige leitura direta
// de fato_proposicoes/fato_despesas, que foi revogada do anon no hardening
// (sql/02_hardening_public.sql). O polling de 60s do SWR mantem tudo "ao vivo".
//
// Para ligar num ambiente de demo controlado: defina NEXT_PUBLIC_ENABLE_REALTIME=true
// e rode os GRANT/ALTER PUBLICATION documentados no 02_hardening_public.sql.
const REALTIME_ON = process.env.NEXT_PUBLIC_ENABLE_REALTIME === "true";

export function useRealtimeRefresh() {
  const { mutate } = useSWRConfig();

  useEffect(() => {
    if (!REALTIME_ON) return;

    const revalidar = () => mutate(() => true, undefined, { revalidate: true });

    const channel = supabase
      .channel("bussola-live")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "fato_proposicoes" }, revalidar)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "fato_despesas" }, revalidar)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [mutate]);
}
