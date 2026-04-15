import { ZodError } from "zod";
import { Prisma } from "@prisma/client";
import { PrismaClientInitializationError } from "@prisma/client/runtime/library";

export type MappedError = {
  status: number;
  /** Сообщение для JSON клиенту (без внутренних деталей). */
  message: string;
  /** Логировать полный stack / детали. */
  logAsError: boolean;
};

function isClientUploadMessage(msg: string) {
  const lower = msg.toLowerCase();
  return (
    msg.includes("Only JPEG") ||
    msg.includes("Only image") ||
    msg.includes("too large") ||
    msg.startsWith("Upload failed:") ||
    msg.includes("Unexpected field") ||
    msg.includes("Cloudinary upload is not configured") ||
    lower.includes("cloudinary") ||
    lower.includes("api key") ||
    lower.includes("invalid signature") ||
    lower.includes("unauthorized") ||
    lower.includes("must supply api_key")
  );
}

/**
 * Преобразует неизвестную ошибку в HTTP-ответ и флаг логирования.
 */
export function mapErrorToResponse(err: unknown): MappedError {
  const o = err as { status?: number; statusCode?: number; type?: string };
  const messageFromUnknown =
    typeof (err as any)?.message === "string"
      ? (err as any).message
      : typeof (err as any)?.error?.message === "string"
        ? (err as any).error.message
        : undefined;
  const httpCode = o.status ?? o.statusCode;
  if (httpCode === 413 || o.type === "entity.too.large") {
    return { status: 413, message: "Request body too large", logAsError: false };
  }
  if (o.type === "entity.parse.failed") {
    return { status: 400, message: "Invalid JSON body", logAsError: false };
  }
  if (err instanceof SyntaxError) {
    return { status: 400, message: "Invalid JSON body", logAsError: false };
  }

  if (err instanceof ZodError) {
    const first = err.issues[0];
    return {
      status: 400,
      message: first?.message ?? "Invalid input",
      logAsError: false,
    };
  }

  if (err instanceof PrismaClientInitializationError) {
    return {
      status: 503,
      message: "Database temporarily unavailable. Try again later.",
      logAsError: true,
    };
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case "P1001":
      case "P1008":
      case "P1017":
        return {
          status: 503,
          message: "Database temporarily unavailable. Try again later.",
          logAsError: true,
        };
      case "P2002":
        return { status: 409, message: "Record already exists", logAsError: false };
      case "P2025":
        return { status: 404, message: "Not found", logAsError: false };
      case "P2003":
        return { status: 400, message: "Invalid reference", logAsError: false };
      default:
        return { status: 500, message: "Database error", logAsError: true };
    }
  }

  if (err instanceof Prisma.PrismaClientValidationError) {
    return { status: 400, message: "Invalid data", logAsError: true };
  }

  if (err instanceof SyntaxError && "body" in (err as any)) {
    return { status: 400, message: "Invalid JSON body", logAsError: false };
  }

  if (err instanceof Error) {
    if (err.message === "CORS origin is not allowed") {
      return { status: 403, message: "Origin not allowed", logAsError: false };
    }
    if (isClientUploadMessage(err.message)) {
      return { status: 400, message: err.message, logAsError: false };
    }
    return { status: 500, message: "Internal server error", logAsError: true };
  }

  if (messageFromUnknown) {
    if (isClientUploadMessage(messageFromUnknown)) {
      return { status: httpCode && httpCode >= 400 && httpCode < 500 ? httpCode : 400, message: messageFromUnknown, logAsError: false };
    }
  }

  return { status: 500, message: "Internal server error", logAsError: true };
}
