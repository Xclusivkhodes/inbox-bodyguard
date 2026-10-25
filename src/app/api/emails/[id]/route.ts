import { connection } from "next/server";
import { NextResponse } from "next/server";

import { jsonError } from "@/lib/http";
import { getEmail, HttpError } from "@/lib/store";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  await connection();
  try {
    const { id } = await context.params;
    const email = await getEmail(id);
    if (!email) throw new HttpError("That email is not in this inbox.", 404);
    return NextResponse.json(email);
  } catch (error) {
    return jsonError(error);
  }
}
