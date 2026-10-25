import { NextResponse } from "next/server";
import {
  AuthenticationRequiredError,
  getAuthenticatedUserId,
} from "@/lib/server/authenticated-user";
import { suggestCategoryForTitle } from "@/lib/server/category-suggestions";

export const runtime = "nodejs";

const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 20;
const requestWindows = new Map<string, { startedAt: number; count: number }>();

export async function POST(request: Request) {
  let userId: string;
  try {
    userId = await getAuthenticatedUserId();
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      return json({ error: "Necesitás iniciar sesión." }, 401);
    }
    return json({ error: "No se pudo completar la sugerencia." }, 503);
  }

  if (!isWithinRateLimit(userId)) {
    return json({ error: "Esperá un momento antes de volver a pedir sugerencias." }, 429);
  }

  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > 4_096) {
    return json({ error: "La solicitud es demasiado grande." }, 413);
  }

  let body: unknown;
  try {
    const rawBody = await readLimitedBody(request, 4_096);
    if (rawBody === null) {
      return json({ error: "La solicitud es demasiado grande." }, 413);
    }
    body = JSON.parse(rawBody);
  } catch {
    return json({ error: "Revisá los datos enviados." }, 400);
  }

  if (
    typeof body !== "object" ||
    body === null ||
    Array.isArray(body) ||
    typeof (body as Record<string, unknown>).title !== "string"
  ) {
    return json({ error: "El detalle del gasto es obligatorio." }, 400);
  }

  const title = ((body as Record<string, string>).title).trim();
  if (title.length < 3 || title.length > 160) {
    return json({ error: "El detalle debe tener entre 3 y 160 caracteres." }, 400);
  }

  if (!process.env.TYPESAFE_API_KEY) {
    return json(
      { categoryId: null, probability: null, unavailable: true },
      200,
    );
  }

  try {
    const suggestion = await suggestCategoryForTitle(title);
    return json(suggestion, 200);
  } catch {
    return json(
      { categoryId: null, probability: null, unavailable: true },
      200,
    );
  }
}

async function readLimitedBody(
  request: Request,
  maxBytes: number,
): Promise<string | null> {
  const reader = request.body?.getReader();
  if (!reader) return "";

  const chunks: Uint8Array[] = [];
  let byteLength = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      byteLength += value.byteLength;
      if (byteLength > maxBytes) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(byteLength);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(body);
}

function isWithinRateLimit(userId: string): boolean {
  const now = Date.now();
  if (requestWindows.size > 5_000) {
    for (const [id, window] of requestWindows) {
      if (now - window.startedAt > WINDOW_MS * 2) requestWindows.delete(id);
    }
    while (requestWindows.size > 5_000) {
      const oldestId = requestWindows.keys().next().value as string | undefined;
      if (!oldestId) break;
      requestWindows.delete(oldestId);
    }
  }

  const current = requestWindows.get(userId);
  if (!current || now - current.startedAt >= WINDOW_MS) {
    requestWindows.delete(userId);
    requestWindows.set(userId, { startedAt: now, count: 1 });
    return true;
  }
  if (current.count >= MAX_REQUESTS_PER_WINDOW) return false;
  current.count += 1;
  return true;
}

function json(body: unknown, status: number) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
