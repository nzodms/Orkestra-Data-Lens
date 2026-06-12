"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import type { DeskAction } from "@/lib/orderdesk/actions";

/** Envoie une action Order Desk puis rafraîchit les données serveur. */
export function useDeskAction() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (action: DeskAction): Promise<boolean> => {
      setPending(true);
      setError(null);
      try {
        const res = await fetch("/api/orderdesk/action", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(action),
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => null)) as { error?: string } | null;
          setError(data?.error ?? "Action impossible");
          return false;
        }
        router.refresh();
        return true;
      } catch {
        setError("Impossible de joindre le serveur");
        return false;
      } finally {
        setPending(false);
      }
    },
    [router]
  );

  return { run, pending, error };
}
