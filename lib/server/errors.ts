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

// ─── Diagnostic de connexion PostgreSQL (codes + indice d'action) ────────────

export type DbError = {
  name: string;
  code: string;
  message: string;
  detail: string;
  hint: string;
  category:
    | "bad_password"
    | "bad_user"
    | "ssl_required"
    | "host_unreachable"
    | "timeout"
    | "var_not_read"
    | "pooler_incompatible"
    | "url_invalid"
    | "sql_error"
    | "unknown";
};

/**
 * Traduit une erreur de connexion PostgreSQL en diagnostic précis et
 * actionnable : distingue mot de passe, user, SSL, host injoignable, timeout,
 * variable non lue, pooler incompatible et erreur SQL. Le mot de passe n'est
 * jamais inclus.
 */
export function describeDbError(err: unknown): DbError {
  const e = err as {
    code?: string;
    message?: string;
    detail?: string;
    hint?: string;
    name?: string;
    routine?: string;
    severity?: string;
  };
  const code = e?.code ?? "";
  const message = e?.message ?? String(err);
  const detail = e?.detail ?? "";
  const lower = `${message} ${detail}`.toLowerCase();

  if (err instanceof DbNotConfiguredError) {
    return {
      name: "DbNotConfiguredError",
      code: "no_database_url",
      message: "DATABASE_URL non lu par le serveur.",
      detail: message,
      hint: "Vérifiez que la variable s'appelle exactement DATABASE_URL (pas POSTGRES_URL) et redéployez.",
      category: "var_not_read",
    };
  }

  const base = (category: DbError["category"], hint: string): DbError => ({
    name: e?.name ?? "Error",
    code: code || category,
    message,
    detail,
    hint,
    category,
  });

  // Spécifique Supabase pooler : user/projet introuvable côté PgBouncer.
  if (/tenant or user not found/i.test(lower)) {
    return base(
      "bad_user",
      "Pooler Supabase : le user doit être « postgres.<project-ref> » et le project-ref doit correspondre à votre projet. Recopiez l'URL « Transaction pooler » depuis Supabase → Connect.",
    );
  }

  switch (code) {
    case "28P01":
      return base(
        "bad_password",
        "Mot de passe incorrect. Réinitialisez-le dans Supabase → Database → Password, et encodez les caractères spéciaux en %XX dans l'URL.",
      );
    case "28000":
      return base(
        "bad_user",
        "Utilisateur/authorization invalide. Pour le pooler, user = « postgres.<project-ref> ».",
      );
    case "3D000":
      return base("sql_error", "Base inexistante — pour Supabase, le nom de base est « postgres ».");
    case "53300":
      return base("pooler_incompatible", "Trop de connexions sur le pooler — réduisez « max » ou réessayez.");
    case "08P01":
    case "0A000":
      return base(
        "pooler_incompatible",
        "Fonctionnalité non supportée par le pooler en mode transaction (PgBouncer). Évitez les prepared statements nommés.",
      );
  }

  // Erreurs système réseau / SSL (pas de code SQLSTATE)
  if (["ENOTFOUND", "EAI_AGAIN"].includes(code)) {
    return base("host_unreachable", "Hôte DNS introuvable — vérifiez le host du pooler (aws-0-…pooler.supabase.com).");
  }
  if (code === "ECONNREFUSED") {
    return base("host_unreachable", "Connexion refusée — vérifiez host:port (Transaction pooler = 6543).");
  }
  if (code === "ETIMEDOUT" || /timeout|timed out/i.test(lower)) {
    return base("timeout", "Délai dépassé — réseau bloqué ou host/port incorrect. Utilisez le Transaction pooler (port 6543).");
  }
  if (/self.signed|certificate|ssl|sslmode/i.test(lower)) {
    return base("ssl_required", "Problème SSL — gardez ?sslmode=require et la config ssl rejectUnauthorized:false (déjà appliquée).");
  }
  if (/password authentication failed/i.test(lower)) {
    return base("bad_password", "Échec d'authentification (mot de passe). Vérifiez/encodez le mot de passe dans l'URL.");
  }

  return base("unknown", "Erreur de connexion non catégorisée — voir message/detail ci-dessus.");
}
