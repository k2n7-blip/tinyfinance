import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { AppError } from "./errors";
export function route<T extends unknown[]>(
  handler: (req: NextRequest, ...args: T) => Promise<Response>,
) {
  return async (req: NextRequest, ...args: T) => {
    try {
      if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
        const origin = req.headers.get("origin");
        if (origin && new URL(origin).origin !== req.nextUrl.origin)
          throw new AppError(403, "Unzulässiger Ursprung der Anfrage.");
        if (req.headers.get("sec-fetch-site") === "cross-site")
          throw new AppError(403, "Unzulässiger Ursprung der Anfrage.");
      }
      const response = await handler(req, ...args);
      response.headers.set("Cache-Control", "private, no-store");
      return response;
    } catch (error) {
      if (error instanceof AppError)
        return NextResponse.json(
          { error: error.message },
          { status: error.status },
        );
      if (error instanceof ZodError)
        return NextResponse.json(
          {
            error: error.issues
              .map((i) => `${i.path.join(".")}: ${i.message}`)
              .join("; "),
          },
          { status: 400 },
        );
      if (error instanceof SyntaxError)
        return NextResponse.json(
          { error: "Ungültige Anfrage." },
          { status: 400 },
        );
      console.error(
        "TinyFinance request failed",
        error instanceof Error ? error.name : "unknown",
      );
      return NextResponse.json(
        { error: "Die Anfrage konnte nicht verarbeitet werden." },
        { status: 500 },
      );
    }
  };
}
export async function jsonBody(req: NextRequest) {
  const text = await req.text();
  if (text.length > 256_000)
    throw new AppError(413, "Die Anfrage ist zu groß.");
  return JSON.parse(text);
}
