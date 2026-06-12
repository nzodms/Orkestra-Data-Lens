"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Info } from "lucide-react";

/** Système de toasts minimal : `toast("…", "success")` depuis n'importe quel
 * composant client — affichage en pile, bas droite, liquid glass. */

type ToastTone = "success" | "error" | "info";
type ToastItem = { id: number; message: string; tone: ToastTone };

type Listener = (t: ToastItem) => void;
let listener: Listener | null = null;
let seq = 0;

export function toast(message: string, tone: ToastTone = "info") {
  listener?.({ id: ++seq, message, tone });
}

const ICONS = { success: CheckCircle2, error: AlertTriangle, info: Info };
const COLORS = {
  success: "text-positive",
  error: "text-critical",
  info: "text-brand",
};

export function Toaster() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    listener = (t) => {
      setToasts((prev) => [...prev.slice(-3), t]);
      setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== t.id)), 3800);
    };
    return () => {
      listener = null;
    };
  }, []);

  return (
    <div className="pointer-events-none fixed bottom-20 right-4 z-[60] flex flex-col gap-2 md:bottom-5">
      <AnimatePresence>
        {toasts.map((t) => {
          const Icon = ICONS[t.tone];
          return (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 14, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.97 }}
              transition={{ type: "spring", stiffness: 420, damping: 32 }}
              className="glass-strong pointer-events-auto flex max-w-sm items-start gap-2.5 rounded-xl px-3.5 py-2.5"
            >
              <Icon size={15} className={`mt-0.5 shrink-0 ${COLORS[t.tone]}`} />
              <span className="text-[12.5px] font-medium leading-snug">{t.message}</span>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
