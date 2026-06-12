import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({ error: "Use /api/checkout instead" }, { status: 410 });
}
