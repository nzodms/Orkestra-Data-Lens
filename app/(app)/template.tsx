"use client";

import { motion } from "framer-motion";

/** Transition douce entre les pages de l'app (remontée + fondu). */
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.21, 0.61, 0.35, 1] }}
    >
      {children}
    </motion.div>
  );
}
