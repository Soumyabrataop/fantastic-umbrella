import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "crypto";

const DEFAULT_BACKEND_URL =
  process.env.BACKEND_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:8000";

const SIGNATURE_SECRET = process.env.REQUEST_SIGNATURE_SECRET;
const SIGNATURE_HEADER = (process.env.REQUEST_SIGNATURE_HEADER || "x-instaveo-signature").toLowerCase();
const TIMESTAMP_HEADER = (process.env.REQUEST_TIMESTAMP_HEADER || "x-instaveo-timestamp").toLowerCase();

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function buildTargetPath(segments: string[] | undefined): string {
  if (!segments || segments.length === 0) {
    return "";
  }

  if (segments.some((segment) => segment.includes(".."))) {
    throw new Error("Invalid proxy path segment");
  }

  return `/${segments.join("/")}`;
}

function computeSignature(
  secret: string,
  timestamp: string,
  method: string,
  path: string,
  body: string | undefined
): string {
  const parts = [timestamp, method.toUpperCase(), path];
  if (body && body.length > 0) {
    parts.push(body);
  }
  const payload = parts.join("\n");
  return createHmac("sha256", secret).update(payload).digest("hex");
}

type ProxyParams = { proxy?: string[] };

async function resolveParams(value: ProxyParams | Promise<ProxyParams> | undefined): Promise<ProxyParams> {
  if (!value) {
    return {};
  }

  const maybePromise = value as Promise<ProxyParams> & { then?: unknown };
  if (typeof maybePromise?.then === "function") {
    return (await value) ?? {};
  }

  return value as ProxyParams;
}

async function proxyRequest(
  request: NextRequest,
  context: { params: ProxyParams | Promise<ProxyParams> }
): Promise<NextResponse> {
  const params = await resolveParams(context?.params);

  let path: string;
  try {
    path = buildTargetPath(params.proxy);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Invalid proxy path" },
      { status: 400 }
    );
  }

  const baseUrl = DEFAULT_BACKEND_URL.replace(/\/$/, "");
  const search = request.nextUrl.search;
  const targetPath = path || "";
  const targetUrl = `${baseUrl}${targetPath}${search}`;
  const method = request.method.toUpperCase();
  const shouldForwardBody = !["GET", "HEAD", "OPTIONS"].includes(method);

  let bodyText: string | undefined;
  if (shouldForwardBody) {
    bodyText = await request.text();
  }

  const headers = new Headers();
  request.headers.forEach((value, key) => {
    if (key === "host" || key === "content-length") {
      return;
    }

    if (key === SIGNATURE_HEADER || key === TIMESTAMP_HEADER) {
      return;
    }

    headers.set(key, value);
  });

  if (shouldForwardBody && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  if (MUTATING_METHODS.has(method) && !SIGNATURE_SECRET) {
    console.error(
      "REQUEST_SIGNATURE_SECRET is not configured. Configure it in .env.local so the frontend can sign mutation requests."
    );
    return NextResponse.json(
      {
        message:
          "Frontend proxy cannot sign requests. Set REQUEST_SIGNATURE_SECRET in your environment and restart the dev server.",
      },
      { status: 500 }
    );
  }

  if (SIGNATURE_SECRET && MUTATING_METHODS.has(method)) {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = computeSignature(
      SIGNATURE_SECRET,
      timestamp,
      method,
      targetPath || "/",
      bodyText
    );
    headers.set(SIGNATURE_HEADER, signature);
    headers.set(TIMESTAMP_HEADER, timestamp);
  }

  let backendResponse: Response;
  try {
    backendResponse = await fetch(targetUrl, {
      method,
      headers,
      redirect: "manual",
      body: shouldForwardBody ? bodyText || undefined : undefined,
    });
  } catch (error) {
    console.error("Proxy request failed", error);
    return NextResponse.json(
      { message: "Unable to reach backend service" },
      { status: 502 }
    );
  }

  // If backend responded with 304 Not Modified, some browsers may not have a
  // cached body (e.g. after a prior corrupted cache). Returning a 304 with no
  // usable client-side copy will cause media load failures. To be robust during
  // development, re-request the resource unconditionally (once) and forward the
  // fresh response.
  if (backendResponse.status === 304) {
    try {
      const unconditionalHeaders = new Headers();
      headers.forEach((value, key) => {
        // Strip conditional request headers when re-fetching
        if (key === "if-none-match" || key === "if-modified-since" || key === "if-range") {
          return;
        }
        unconditionalHeaders.set(key, value);
      });

      const fresh = await fetch(targetUrl, {
        method,
        headers: unconditionalHeaders,
        redirect: "manual",
        body: shouldForwardBody ? bodyText || undefined : undefined,
      });

      // replace backendResponse with the fresh one for downstream handling
      backendResponse = fresh;
    } catch (err) {
      console.warn("Failed to re-fetch fresh resource after 304", err);
      // fall through and handle the original 304 response below
    }
  }

  const responseHeaders = new Headers();
  backendResponse.headers.forEach((value, key) => {
    // Let the browser determine content-length for streamed bodies; skip it here
    if (key === "content-length") {
      return;
    }
    responseHeaders.set(key, value);
  });

  // During development, avoid serving cached media via the proxy to prevent
  // clients from using potentially corrupted cached copies (we previously
  // coerced binary bodies to text which could be cached by the browser).
  // If the proxied path looks like a media asset, prefer no-store so the
  // browser requests fresh bytes (helps debugging). In production you may
  // want to allow caching depending on your CDN settings.
  if (targetPath.startsWith("/media")) {
    responseHeaders.set("cache-control", "no-store");
  }

  // Per HTTP spec, certain status codes must not include a body (e.g. 204, 304).
  // Also, for binary media we should forward the original body stream instead of
  // coercing to text (which can corrupt binary data). Use the backendResponse.body
  // stream when available for non-empty responses.
  const status = backendResponse.status;

  // If the response must not have a body, return without one.
  if (status === 204 || status === 304) {
    return new NextResponse(null, {
      status,
      headers: responseHeaders,
    });
  }

  // Forward the raw body stream when possible to preserve binary payloads
  const bodyStream = backendResponse.body ?? null;
  return new NextResponse(bodyStream, {
    status,
    headers: responseHeaders,
  });
}

export async function GET(request: NextRequest, context: { params: ProxyParams | Promise<ProxyParams> }) {
  return proxyRequest(request, context);
}

export async function POST(request: NextRequest, context: { params: ProxyParams | Promise<ProxyParams> }) {
  return proxyRequest(request, context);
}

export async function PUT(request: NextRequest, context: { params: ProxyParams | Promise<ProxyParams> }) {
  return proxyRequest(request, context);
}

export async function PATCH(request: NextRequest, context: { params: ProxyParams | Promise<ProxyParams> }) {
  return proxyRequest(request, context);
}

export async function DELETE(request: NextRequest, context: { params: ProxyParams | Promise<ProxyParams> }) {
  return proxyRequest(request, context);
}

export async function OPTIONS(request: NextRequest, context: { params: ProxyParams | Promise<ProxyParams> }) {
  return proxyRequest(request, context);
}
