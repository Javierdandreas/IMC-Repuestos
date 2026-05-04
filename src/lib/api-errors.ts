import { NextResponse } from "next/server";
import { z } from "zod";

export class AppError extends Error {
  status: number;
  type?: string;
  details?: any[];

  constructor(message: string, status = 400, type = 'server', details: any[] = []) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.type = type;
    this.details = details;
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/**
 * Convierte un error de Zod a un mensaje amigable para el cliente.
 */
export function formatZodError(error: z.ZodError): { message: string, details: any[] } {
  const details = error.issues.map((err: any) => ({
    field: err.path.join("."),
    message: err.message,
    code: err.code
  }));
  
  const message = details.map(d => `${d.field}: ${d.message}`).join(", ");
  return { message, details };
}

export function toAppError(error: unknown, fallbackMessage: string): AppError {
  if (isAppError(error)) return error;

  // Manejo de errores de Zod
  if (error instanceof z.ZodError) {
    const { message, details } = formatZodError(error);
    return new AppError(message, 400, 'validation', details);
  }

  // Manejo de errores de Postgres (pg)
  if (typeof error === "object" && error !== null && "code" in error) {
    const pgError = error as any;
    if (pgError.code === "23505") { // Unique violation
      return new AppError("Ya existe un registro con esos datos (duplicado)", 409, 'conflict', [
        { field: pgError.column || pgError.detail, message: pgError.detail || "Valor duplicado" }
      ]);
    }
    if (pgError.code === "23503") { // Foreign key violation
      return new AppError("No se puede realizar la operación porque el registro está en uso en otra parte del sistema", 400, 'foreign_key', [
        { field: pgError.table || pgError.detail, message: "Restricción de integridad referencial" }
      ]);
    }
  }

  if (typeof error === "object" && error && "status" in error && typeof (error as any).status === "number") {
    const message = typeof (error as any).message === "string" ? (error as any).message : fallbackMessage;
    return new AppError(message, (error as any).status);
  }

  if (error instanceof Error) return new AppError(error.message || fallbackMessage, 400);
  return new AppError(fallbackMessage, 400);
}

export function jsonError(error: unknown, fallbackMessage: string) {
  const appError = toAppError(error, fallbackMessage);
  const isUnexpected = !isAppError(error) && !(error instanceof z.ZodError);

  if (isUnexpected) {
    console.error("❌ [API ERROR]:", error);
  } else {
    console.warn(`⚠️ [API ${appError.status} - ${appError.type}]:`, appError.message);
  }

  const clientMessage = isUnexpected ? fallbackMessage : appError.message;

  return NextResponse.json({ 
    message: clientMessage,
    type: appError.type || 'server',
    details: appError.details || []
  }, { status: appError.status });
}
