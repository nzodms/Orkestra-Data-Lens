import { NextRequest, NextResponse } from "next/server";
import { getDataset } from "@/data/dataset";

/** Export JSON des données vérifiées (sessions, commandes, anomalies). */
export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get("type") ?? "sessions";
  const dataset = getDataset();

  const data =
    type === "orders" ? dataset.orders : type === "anomalies" ? dataset.anomalies : dataset.sessions;

  return new NextResponse(JSON.stringify({ mode: "demo", exportedAt: new Date().toISOString(), [type]: data }, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="orkestra-${type}.json"`,
    },
  });
}
