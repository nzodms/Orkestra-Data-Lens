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
    name: "Demande de prix et disponibilité",
    body: `Bonjour, pouvez-vous me confirmer le meilleur prix, la disponibilité et le délai de livraison pour ce produit ?
Produit : {{product_name}}
Variante : {{variant}}
Quantité : {{quantity}}
Pays de livraison : {{country}}
Lien / référence : {{product_reference}}
Merci.`,
  },
  {
    key: "lead_time",
    name: "Demande de délai livraison",
    body: `Bonjour, quel est votre délai de livraison actuel pour ce produit ?
Produit : {{product_name}}
Quantité : {{quantity}}
Pays de livraison : {{country}}
Merci de me confirmer la date d'expédition possible.`,
  },
  {
    key: "order_confirmation",
    name: "Confirmation commande fournisseur",
    body: `Bonjour, je confirme la commande suivante :
Produit : {{product_name}}
Variante : {{variant}}
Quantité : {{quantity}}
Pays de livraison : {{country}}
Référence interne : {{order_number}}
Merci de me confirmer la réception et le montant total à régler.`,
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
    key: "follow_up",
    name: "Relance fournisseur",
    body: `Bonjour, je reviens vers vous concernant ma demande sur ce produit :
Produit : {{product_name}}
Référence interne : {{order_number}}
Avez-vous pu avancer ? J'ai besoin d'une réponse rapidement pour confirmer la commande.
Merci.`,
  },
  {
    key: "product_issue",
    name: "Problème produit",
    body: `Bonjour, nous avons un problème sur cette commande :
Référence interne : {{order_number}}
Produit : {{product_name}}
Problème : {{issue}}
Merci de me proposer une solution (renvoi ou remboursement).`,
  },
  {
    key: "volume_price",
    name: "Demande meilleur prix pour volume",
    body: `Bonjour, nous augmentons nos volumes sur ce produit :
Produit : {{product_name}}
Volume prévu : {{quantity}} unités / mois
Pouvez-vous me proposer votre meilleur prix pour ce volume, ainsi que le délai et le MOQ ?
Merci.`,
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
