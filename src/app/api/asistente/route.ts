import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { AppError, jsonError } from "@/lib/api-errors";
import { requireApiReadSession } from "@/lib/api-auth";
import { getHelpPageContext, IMC_HELP_KNOWLEDGE } from "@/lib/asistente-ayuda";

const requestSchema = z.object({
  message: z.string().trim().min(1).max(700),
  pathname: z.string().max(200).default("/"),
  history: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().trim().min(1).max(900) })).max(6).default([]),
});

const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 20;
const requestsByUser = new Map<number, number[]>();

function verifyRateLimit(userId: number) {
  const now = Date.now();
  const current = (requestsByUser.get(userId) ?? []).filter((time) => now - time < RATE_LIMIT_WINDOW_MS);
  if (current.length >= RATE_LIMIT_MAX_REQUESTS) {
    throw new AppError("Alcanzaste el limite de consultas. Intenta nuevamente en unos minutos.", 429);
  }
  current.push(now);
  requestsByUser.set(userId, current);
}

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    const session = await requireApiReadSession(request);
    verifyRateLimit(session.usuarioId);
    const body = requestSchema.parse(await request.json());
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) throw new AppError("El asistente no esta configurado. Falta OPENAI_API_KEY en el proyecto.", 503);

    const page = getHelpPageContext(body.pathname);
    const conversation = [...body.history, { role: "user" as const, content: body.message }]
      .map((item) => `${item.role === "user" ? "Usuario" : "Asistente"}: ${item.content}`)
      .join("\n");
    const client = new OpenAI({ apiKey });
    const response = await client.responses.create({
      model: process.env.OPENAI_HELP_MODEL?.trim() || "gpt-5-mini",
      instructions: `${IMC_HELP_KNOWLEDGE}\n\nContexto actual:\n- Pantalla: ${page.title}\n- En esta pantalla se puede: ${page.capabilities}\n- Rol del usuario: ${session.rol ?? "sin rol"}`,
      input: conversation,
      reasoning: { effort: "minimal" },
      max_output_tokens: 700,
    });
    const answer = response.output_text.trim();
    if (!answer) {
      console.warn("[ASISTENTE] Respuesta sin texto", {
        responseId: response.id,
        status: response.status,
        incompleteReason: response.incomplete_details?.reason,
      });
      const message = response.incomplete_details?.reason === "max_output_tokens"
        ? "El asistente no alcanzo a terminar la respuesta. Intenta nuevamente."
        : "El asistente no recibio texto para responder. Intenta nuevamente.";
      throw new AppError(message, 502);
    }
    return NextResponse.json({ answer });
  } catch (error: unknown) {
    return jsonError(error, "No se pudo consultar al asistente.");
  }
}
