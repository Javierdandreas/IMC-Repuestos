import { NextResponse } from "next/server";
import { z } from "zod";

export class AppError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "AppError";
    this.status = status;
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/**
 * Convierte un error de Zod a un mensaje amigable para el cliente.
 */
export function formatZodError(error: z.ZodError): string {
  return error.issues
    .map((err: any) => {
      const path = err.path.join(".");
      return path ? `${path}: ${err.message}` : err.message;
    })
    .join(", ");
}

export function toAppError(error: unknown, fallbackMessage: string): AppError {
  if (isAppError(error)) return error;

  if (error instanceof z.ZodError) {
    return new AppError(formatZodError(error), 400);
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
  return NextResponse.json({ message: appError.message }, { status: appError.status });
}
