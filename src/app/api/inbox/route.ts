import { connection } from "next/server";
import { NextResponse } from "next/server";

import { jsonError } from "@/lib/http";
import { assertIpLimit, clientIp } from "@/lib/limits";
import { getInbox } from "@/lib/store";

export async function GET() {
  await connection();
  try {
    return NextResponse.json(await getInbox());
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  await connection();
  try {
    assertIpLimit(clientIp(request));
    return NextResponse.json(await getInbox());
  } catch (error) {
    return jsonError(error);
  }
}
