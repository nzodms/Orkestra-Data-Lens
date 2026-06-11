import {
  AlertTriangle,
  Filter,
  Footprints,
  LayoutDashboard,
  Megaphone,
  Package,
  Settings,
  UserX,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", shortLabel: "Dashboard", icon: LayoutDashboard },
  { href: "/truth-funnel", label: "Vérité du tunnel", shortLabel: "Funnel", icon: Filter },
  { href: "/sessions", label: "Parcours visiteurs", shortLabel: "Sessions", icon: Footprints },
  { href: "/abandonments", label: "Abandons", shortLabel: "Abandons", icon: UserX },
  { href: "/products", label: "Produits", shortLabel: "Produits", icon: Package },
  { href: "/sources", label: "Sources", shortLabel: "Sources", icon: Megaphone },
  { href: "/anomalies", label: "Anomalies", shortLabel: "Alertes", icon: AlertTriangle },
  { href: "/settings", label: "Paramètres", shortLabel: "Réglages", icon: Settings },
];

export const MOBILE_NAV = ["/dashboard", "/truth-funnel", "/sessions", "/products", "/anomalies"];

export const PAGE_TITLES: Record<string, { title: string; subtitle?: string }> = {
  "/dashboard": { title: "Dashboard", subtitle: "Vue d'ensemble vérifiée de la boutique" },
  "/truth-funnel": { title: "Vérité du tunnel", subtitle: "Funnel brut vs parcours reconstruits" },
  "/sessions": { title: "Parcours visiteurs", subtitle: "Chaque session, minute par minute" },
  "/abandonments": { title: "Abandons", subtitle: "Où et pourquoi les clients bloquent" },
  "/products": { title: "Produits", subtitle: "Performance et fiabilité par produit" },
  "/sources": { title: "Sources", subtitle: "Qualité réelle de chaque canal d'acquisition" },
  "/anomalies": { title: "Anomalies", subtitle: "Les écarts expliqués au lieu d'être cachés" },
  "/settings": { title: "Paramètres", subtitle: "Connexion, tracking et préférences" },
  "/system": { title: "Diagnostic système", subtitle: "État de l'installation OAuth, base, sync et tracking" },
};
