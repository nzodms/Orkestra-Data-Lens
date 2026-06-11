import { OnboardingFlow } from "@/components/onboarding/OnboardingFlow";
import { getAppStatus } from "@/lib/server/datasource";
import { isDatabaseConfigured, isOAuthConfigured } from "@/lib/server/env";

export const dynamic = "force-dynamic";

/**
 * Wrapper serveur de l'onboarding : détermine si l'OAuth réel est disponible
 * et transmet l'état de connexion (retour de /api/shopify/callback) au flow
 * client. Aucun secret ne transite — uniquement des booléens et statuts.
 */
export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ step?: string; connected?: string; shop?: string; error?: string; missing?: string }>;
}) {
  const params = await searchParams;
  const status = await getAppStatus();
  const oauthReady = isOAuthConfigured() && isDatabaseConfigured();

  const connectedDomain =
    params.connected === "1" && params.shop ? params.shop : status.mode === "live" ? status.shopDomain : undefined;

  const initialStep = Math.min(4, Math.max(0, Number(params.step ?? (connectedDomain ? 2 : 0)) || 0));

  return (
    <OnboardingFlow
      oauthConfigured={oauthReady}
      initialStep={initialStep}
      connectedShopDomain={connectedDomain}
      errorCode={params.error}
      missingConfig={params.missing}
      pixelInstalled={status.pixelStatus === "installed"}
    />
  );
}
