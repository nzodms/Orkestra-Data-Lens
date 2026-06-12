/**
 * Transition de page en CSS pur (animation `fade-up`) : contrairement à une
 * animation Framer Motion avec `initial={{ opacity: 0 }}`, le contenu reste
 * visible même si l'hydratation JS est lente — plus aucune section du bas de
 * page qui « n'apparaît pas » tant que le JS n'est pas chargé.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="fade-up">{children}</div>;
}
