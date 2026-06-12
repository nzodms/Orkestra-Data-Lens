"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";

/**
 * Drawer latéral premium (glass) — utilisé pour les détails de session,
 * commande, produit et fournisseur. Fermeture : overlay, Échap, bouton.
 */
export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  badge,
  width = "max-w-xl",
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  badge?: React.ReactNode;
  width?: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50">
          <motion.button
            aria-label="Fermer"
            className="absolute inset-0 cursor-default bg-ink/25 backdrop-blur-[3px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
          />
          <motion.aside
            className={`glass-strong absolute inset-y-0 right-0 flex w-full flex-col sm:inset-y-2 sm:right-2 sm:rounded-2xl ${width}`}
            initial={{ x: 60, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 60, opacity: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 36 }}
          >
            <header className="flex items-start gap-3 border-b border-ink/5 px-5 py-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
                  {badge}
                </div>
                {subtitle && <p className="mt-0.5 text-[12px] text-ink-soft">{subtitle}</p>}
              </div>
              <button
                onClick={onClose}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-ink-soft transition-colors hover:bg-ink/5 hover:text-ink"
              >
                <X size={16} />
              </button>
            </header>
            <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}
