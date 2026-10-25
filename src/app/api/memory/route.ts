import { connection } from "next/server";
import { NextResponse } from "next/server";

import { PASTE_CAP } from "@/lib/config";
import { jsonError } from "@/lib/http";
import { assertIpLimit, clientIp } from "@/lib/limits";
import { getMemory, HttpError, setPreference } from "@/lib/store";

export async function GET() {
  await connection();
  try {
    return NextResponse.json(await getMemory());
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  await connection();
  try {
    assertIpLimit(clientIp(request));
    const body = (await request.json()) as { key?: string; value?: string };
    if (!body.key || !body.value) throw new HttpError("A preference needs a name and a value.", 400);
    if (body.value.length > PASTE_CAP) throw new HttpError("That preference is too long.", 400);
    await setPreference(body.key, body.value);
    return NextResponse.json(await getMemory());
  } catch (error) {
    return jsonError(error);
  }
}
