import "server-only";
import { DbNotConfiguredError } from "./db";

/**
 * Traduit une erreur serveur (PostgreSQL, chiffrement, réseau) en message
 * précis et actionnable — jamais « Erreur interne » générique. Renvoie aussi
 * un code court exploitable côté client et le détail brut pour les logs.
 */
export type DescribedError = { code: string; message: string; detail: string };

type PgLikeError = {
  code?: string;
  message?: string;
  table?: string;
  constraint?: string;
  routine?: string;
};

export function describeServerError(err: unknown, context?: { table?: string }): DescribedError {
  const detail = err instanceof Error ? err.message : String(err);

  // DATABASE_URL absent
  if (err instanceof DbNotConfiguredError) {
    return { code: "db_not_configured", message: "DATABASE_URL non configuré côté serveur.", detail };
  }

  // Chiffrement (ENCRYPTION_SECRET)
  if (/ENCRYPTION_SECRET/i.test(detail) || /token chiffré invalide/i.test(detail)) {
    return {
      code: "encryption_failed",
      message:
        "Chiffrement impossible : ENCRYPTION_SECRET manquant ou invalide (32 caractères minimum requis).",
      detail,
    };
  }

  const e = err as PgLikeError;
  const code = e?.code ?? "";

  // Connexion réseau à la base
  if (["ECONNREFUSED", "ENOTFOUND", "ETIMEDOUT", "EAI_AGAIN", "ECONNRESET"].includes(code)) {
    return {
      code: "db_unreachable",
      message: "Connexion à PostgreSQL échouée (base injoignable — vérifier DATABASE_URL et le réseau Supabase).",
      detail,
    };
  }

  // Codes d'erreur PostgreSQL (SQLSTATE)
  switch (code) {
    case "42P01": {
      // undefined_table
      const table = e.table || context?.table || extractTableName(detail) || "inconnue";
      return {
        code: "missing_table",
        message: `Migration manquante : table ${table} absente.`,
        detail,
      };
    }
    case "42703": // undefined_column
      return { code: "missing_column", message: `Migration manquante : colonne absente (${detail}).`, detail };
    case "3D000": // invalid_catalog_name
      return { code: "db_missing", message: "Base de données introuvable (nom invalide dans DATABASE_URL).", detail };
    case "28P01": // invalid_password
    case "28000": // invalid_authorization
      return { code: "db_auth_failed", message: "Authentification PostgreSQL refusée (identifiants DATABASE_URL).", detail };
    case "23505": // unique_violation
      return { code: "unique_violation", message: `Contrainte d'unicité violée${e.constraint ? ` (${e.constraint})` : ""}.`, detail };
    case "23514": // check_violation
      return { code: "check_violation", message: `Contrainte SQL non respectée${e.constraint ? ` (${e.constraint})` : ""}.`, detail };
    case "23502": // not_null_violation
      return { code: "not_null_violation", message: "Contrainte SQL : champ obligatoire manquant (NOT NULL).", detail };
    case "23503": // foreign_key_violation
      return { code: "foreign_key_violation", message: "Contrainte SQL : clé étrangère invalide.", detail };
    default:
      // Jamais générique : on remonte le message réel
      return { code: code || "unknown", message: detail || "Erreur serveur inconnue.", detail };
  }
}

/** Tente d'extraire un nom de table d'un message « relation "x" does not exist ». */
function extractTableName(message: string): string | null {
  const m = message.match(/relation "([^"]+)" does not exist/i);
  return m ? m[1] : null;
}
