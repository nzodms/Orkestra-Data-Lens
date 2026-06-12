import type { MessageStatus, OpsStatus, SupplierTag } from "./types";

/**
 * Actions Order Desk — même contrat en mode démo (store mémoire) et en mode
 * live (PostgreSQL). Dispatchées via POST /api/orderdesk/action.
 */
export type DeskAction =
  | { type: "set_status"; orderId: string; status: OpsStatus }
  | { type: "assign_supplier"; orderId: string; supplierId: string; cost?: number }
  | { type: "set_tracking"; orderId: string; tracking: string; carrier?: string }
  | { type: "report_problem"; orderId: string; note: string }
  | { type: "add_note"; entityType: "order" | "supplier" | "product"; entityId: string; body: string }
  | {
      type: "record_message";
      supplierId: string;
      orderId?: string;
      templateKey: string;
      body: string;
      status: Extract<MessageStatus, "prepared" | "sent_manual">;
    }
  | { type: "update_message"; messageId: string; status: MessageStatus }
  | {
      type: "add_quote";
      supplierId: string;
      orderId?: string;
      productId?: string;
      productPrice: number;
      shippingPrice: number;
      leadTimeDays?: number;
      messageId?: string;
    }
  | {
      type: "upsert_supplier";
      supplier: {
        id?: string;
        name: string;
        whatsapp?: string;
        email?: string;
        website?: string;
        country?: string;
        currency?: string;
        avgLeadTimeDays?: number;
        reliabilityScore?: number;
        notes?: string;
        tags?: SupplierTag[];
      };
    }
  | {
      type: "add_offer";
      supplierId: string;
      productId: string;
      productPrice: number;
      shippingPrice: number;
      leadTimeDays?: number;
      moq?: number;
      stock?: number;
      productUrl?: string;
      preferred?: boolean;
    };
