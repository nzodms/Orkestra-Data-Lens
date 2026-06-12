// ─── Templates WhatsApp V1 ────────────────────────────────────────────────────
// V1 : le message est pré-rempli puis ouvert dans WhatsApp Web / wa.me —
// aucun envoi automatique. L'architecture (template_key + variables) est
// prête pour la V2 via WhatsApp Cloud API officielle.

export type TemplateVars = {
  product_name?: string;
  variant?: string;
  quantity?: string | number;
  country?: string;
  product_reference?: string;
  order_number?: string;
  supplier_name?: string;
  tracking_number?: string;
  issue?: string;
};

export type WhatsAppTemplate = {
  key: string;
  name: string;
  body: string;
};

export const WHATSAPP_TEMPLATES: WhatsAppTemplate[] = [
  {
    key: "price_availability",
    name: "Demande de prix",
    body: `Bonjour, pouvez-vous me confirmer le meilleur prix, la disponibilité et le délai de livraison pour ce produit ?
Produit : {{product_name}}
Variante : {{variant}}
Quantité : {{quantity}}
Pays de livraison : {{country}}
Lien / référence : {{product_reference}}
Merci.`,
  },
  {
    key: "stock_request",
    name: "Demande stock",
    body: `Bonjour, quel est votre stock disponible actuellement pour ce produit ?
Produit : {{product_name}}
Variante : {{variant}}
Quantité souhaitée : {{quantity}}
Merci de me confirmer la disponibilité immédiate.`,
  },
  {
    key: "lead_time",
    name: "Demande délai",
    body: `Bonjour, quel est votre délai de livraison actuel pour ce produit ?
Produit : {{product_name}}
Quantité : {{quantity}}
Pays de livraison : {{country}}
Merci de me confirmer la date d'expédition possible.`,
  },
  {
    key: "follow_up_24h",
    name: "Relance 24h",
    body: `Bonjour, petit rappel concernant ma demande d'hier :
Produit : {{product_name}}
Référence interne : {{order_number}}
Pouvez-vous me répondre aujourd'hui ? Merci.`,
  },
  {
    key: "follow_up_48h",
    name: "Relance 48h",
    body: `Bonjour, je reviens vers vous : ma demande date de plus de 48 h et je dois avancer sur cette commande.
Produit : {{product_name}}
Référence interne : {{order_number}}
Sans réponse aujourd'hui, je devrai passer par un autre fournisseur.
Merci de votre retour rapide.`,
  },
  {
    key: "tracking_request",
    name: "Demande tracking",
    body: `Bonjour, pouvez-vous m'envoyer le numéro de tracking pour cette commande ?
Référence interne : {{order_number}}
Produit : {{product_name}}
Quantité : {{quantity}}
Merci.`,
  },
  {
    key: "order_confirmation",
    name: "Confirmation fournisseur choisi",
    body: `Bonjour, je confirme la commande suivante :
Produit : {{product_name}}
Variante : {{variant}}
Quantité : {{quantity}}
Pays de livraison : {{country}}
Référence interne : {{order_number}}
Merci de me confirmer la réception et le montant total à régler.`,
  },
  {
    key: "price_negotiation",
    name: "Négociation prix",
    body: `Bonjour, votre offre m'intéresse mais le prix est au-dessus de mon objectif :
Produit : {{product_name}}
Quantité : {{quantity}} (volume régulier prévu)
Pouvez-vous faire un effort sur le prix unitaire ou la livraison ? Avec un meilleur tarif, je peux confirmer aujourd'hui.
Merci.`,
  },
  {
    key: "similar_product",
    name: "Produit similaire à sourcer",
    body: `Bonjour, je cherche un produit similaire à celui-ci :
Référence : {{product_reference}}
Produit : {{product_name}}
Avez-vous un modèle équivalent en stock ? Merci de m'envoyer photos, prix et délai.`,
  },
  {
    key: "product_issue",
    name: "Problème commande",
    body: `Bonjour, nous avons un problème sur cette commande :
Référence interne : {{order_number}}
Produit : {{product_name}}
Problème : {{issue}}
Merci de me proposer une solution (renvoi ou remboursement).`,
  },
];

export const templateByKey = (key: string) => WHATSAPP_TEMPLATES.find((t) => t.key === key);

/** Remplit les variables {{var}} d'un template (les manquantes restent visibles). */
export function fillTemplate(body: string, vars: TemplateVars): string {
  return body.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    const value = vars[key as keyof TemplateVars];
    return value != null && String(value).length > 0 ? String(value) : "—";
  });
}

/** Lien wa.me — ouvre WhatsApp Web / l'app avec le message pré-rempli. */
export function waLink(whatsapp: string | undefined, message: string): string | null {
  if (!whatsapp) return null;
  const phone = whatsapp.replace(/[^0-9]/g, "");
  if (phone.length < 6) return null;
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}
