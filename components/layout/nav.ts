import {
  Activity,
  AlertTriangle,
  ClipboardList,
  Factory,
  Filter,
  Footprints,
  LayoutDashboard,
  Megaphone,
  MessageSquareText,
  Package,
  Settings,
  Sunrise,
  UserX,
  type LucideIcon,
} from "lucide-react";

export type NavSection = "cockpit" | "datalens" | "orderdesk" | "config";

export type NavItem = {
  href: string;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
  section: NavSection;
};

export const NAV_SECTION_LABELS: Record<NavSection, string | null> = {
  cockpit: null,
  datalens: "Data Lens",
  orderdesk: "Order Desk",
  config: null,
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/today", label: "Aujourd'hui", shortLabel: "Aujourd'hui", icon: Sunrise, section: "cockpit" },
  { href: "/dashboard", label: "Dashboard", shortLabel: "Dashboard", icon: LayoutDashboard, section: "datalens" },
  { href: "/truth-funnel", label: "Vérité du tunnel", shortLabel: "Funnel", icon: Filter, section: "datalens" },
  { href: "/sessions", label: "Parcours visiteurs", shortLabel: "Sessions", icon: Footprints, section: "datalens" },
  { href: "/abandonments", label: "Abandons", shortLabel: "Abandons", icon: UserX, section: "datalens" },
  { href: "/products", label: "Produits", shortLabel: "Produits", icon: Package, section: "datalens" },
  { href: "/sources", label: "Sources", shortLabel: "Sources", icon: Megaphone, section: "datalens" },
  { href: "/anomalies", label: "Anomalies", shortLabel: "Alertes", icon: AlertTriangle, section: "datalens" },
  { href: "/orders", label: "Commandes", shortLabel: "Commandes", icon: ClipboardList, section: "orderdesk" },
  { href: "/suppliers", label: "Fournisseurs", shortLabel: "Fourn.", icon: Factory, section: "orderdesk" },
  { href: "/messages", label: "Messages", shortLabel: "Messages", icon: MessageSquareText, section: "orderdesk" },
  { href: "/activity", label: "Activité", shortLabel: "Activité", icon: Activity, section: "config" },
  { href: "/settings", label: "Paramètres", shortLabel: "Réglages", icon: Settings, section: "config" },
];

export const MOBILE_NAV = ["/today", "/orders", "/truth-funnel", "/sessions", "/anomalies"];

export const PAGE_TITLES: Record<string, { title: string; subtitle?: string }> = {
  "/today": { title: "Aujourd'hui", subtitle: "Cockpit quotidien — décisions, alertes et actions" },
  "/activity": { title: "Activité", subtitle: "Journal complet des actions — qui, quoi, quand" },
  "/dashboard": { title: "Dashboard", subtitle: "Vue d'ensemble vérifiée de la boutique" },
  "/truth-funnel": { title: "Vérité du tunnel", subtitle: "Funnel brut vs parcours reconstruits" },
  "/sessions": { title: "Parcours visiteurs", subtitle: "Chaque session, minute par minute" },
  "/abandonments": { title: "Abandons", subtitle: "Où et pourquoi les clients bloquent" },
  "/products": { title: "Produits", subtitle: "Performance et fiabilité par produit" },
  "/sources": { title: "Sources", subtitle: "Qualité réelle de chaque canal d'acquisition" },
  "/anomalies": { title: "Anomalies", subtitle: "Les écarts expliqués au lieu d'être cachés" },
  "/orders": { title: "Commandes — Order Desk", subtitle: "Suivi fournisseur de chaque commande Shopify" },
  "/suppliers": { title: "Fournisseurs", subtitle: "Carnet fournisseurs, prix et fiabilité" },
  "/messages": { title: "Messages fournisseurs", subtitle: "Demandes de prix, relances et suivi WhatsApp" },
  "/settings": { title: "Paramètres", subtitle: "Connexion, tracking et préférences" },
  "/system": { title: "Diagnostic système", subtitle: "État de l'installation OAuth, base, sync et tracking" },
};
