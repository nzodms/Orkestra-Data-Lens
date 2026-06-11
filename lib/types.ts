// ─── Types fondamentaux Orkestra Data Lens ───────────────────────────────────

export type Device = "mobile" | "desktop" | "tablet";

export type EventStatus =
  | "observed"
  | "confirmed"
  | "reconciled"
  | "incomplete"
  | "out_of_period"
  | "suspect";

export type TrackingEvent = {
  id: string;
  shopId: string;
  visitorId: string;
  sessionId: string;
  eventName: string;
  timestamp: string;
  pageUrl?: string;
  referrer?: string;
  source?: string;
  medium?: string;
  campaign?: string;
  content?: string;
  term?: string;
  device?: Device;
  browser?: string;
  country?: string;
  productId?: string;
  variantId?: string;
  sku?: string;
  productTitle?: string;
  variantTitle?: string;
  quantity?: number;
  price?: number;
  currency?: string;
  cartToken?: string;
  checkoutToken?: string;
  orderId?: string;
  customerId?: string;
  status: EventStatus;
  metadata?: Record<string, unknown>;
};

export type Shop = {
  id: string;
  shopifyDomain: string;
  name: string;
  currency: string;
  timezone: string;
  connectedAt: string;
  apiStatus: "connected" | "disconnected" | "error" | "demo";
  pixelStatus: "installed" | "not_installed" | "error" | "demo";
};

export type Product = {
  id: string;
  shopId: string;
  shopifyProductId: string;
  title: string;
  handle: string;
  imageUrl?: string;
  vendor?: string;
  productType?: string;
  status: "active" | "draft" | "archived";
  priceMin: number;
  priceMax: number;
  cost?: number;
  stock?: number;
};

export type SessionStatus = "active" | "converted" | "abandoned" | "incomplete" | "suspect";

export type VisitorSession = {
  id: string;
  shopId: string;
  visitorId: string;
  startedAt: string;
  endedAt?: string;
  durationSeconds?: number;
  source?: string;
  medium?: string;
  campaign?: string;
  landingPage: string;
  device: Device;
  browser?: string;
  country?: string;
  status: SessionStatus;
  reliabilityScore: number;
  events: TrackingEvent[];
};

export type FunnelMetrics = {
  sessions: number;
  productViews: number;
  addToCarts: number;
  cartViews: number;
  checkoutsStarted: number;
  contactSubmitted: number;
  shippingSubmitted: number;
  paymentReached: number;
  paymentSubmitted: number;
  ordersCompleted: number;
};

export type VerifiedFunnelMetrics = FunnelMetrics & {
  outOfCohortCheckouts: number;
  outOfCohortPayments: number;
  missingAddToCartEvents: number;
  confirmedOrders: number;
  reconciliationRate: number;
};

export type AnomalyType =
  | "payment_without_add_to_cart"
  | "checkout_without_cart"
  | "order_without_session"
  | "missing_utm"
  | "duplicate_event"
  | "pixel_missing"
  | "out_of_period_event"
  | "unmatched_order";

export type AnomalySeverity = "low" | "medium" | "high" | "critical";

export type Anomaly = {
  id: string;
  shopId: string;
  type: AnomalyType;
  severity: AnomalySeverity;
  title: string;
  description: string;
  detectedAt: string;
  affectedSessions: number;
  affectedRevenue?: number;
  probableCause?: string;
  recommendedAction?: string;
};

export type DataReliabilityScore = {
  globalScore: number; // 0-100
  eventCoverage: number;
  reconciliationRate: number;
  orderMatchRate: number;
  sourceTrackingQuality: number;
  anomalyRate: number;
};

export type ShopifyOrder = {
  id: string;
  shopId: string;
  orderNumber: string;
  createdAt: string;
  totalPrice: number;
  currency: string;
  financialStatus: "paid" | "pending" | "refunded";
  cartToken?: string;
  checkoutToken?: string;
  sessionId?: string;
  visitorId?: string;
  source?: string;
  productIds: string[];
  country?: string;
};

export type Period = "today" | "yesterday" | "7d";

export type InsightTone = "info" | "success" | "warning" | "critical" | "ai";

export type Insight = {
  id: string;
  tone: InsightTone;
  title: string;
  body: string;
};

export type PriorityAction = {
  id: string;
  title: string;
  description: string;
  impact: "high" | "medium" | "low";
  difficulty: "easy" | "medium" | "hard";
  type: "tracking" | "produit" | "source" | "checkout" | "conversion";
  justification: string;
  estimatedRevenue?: number;
};

export type Discrepancy = {
  id: string;
  label: string;
  count: number;
  tone: "warning" | "critical" | "info";
  explanation: string;
};

export type Dataset = {
  shop: Shop;
  products: Product[];
  sessions: VisitorSession[];
  orders: ShopifyOrder[];
  anomalies: Anomaly[];
};
