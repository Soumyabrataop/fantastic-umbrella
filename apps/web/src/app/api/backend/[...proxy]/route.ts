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

  const responseHeaders = new Headers();
  backendResponse.headers.forEach((value, key) => {
    if (key === "content-length") {
      return;
    }
    responseHeaders.set(key, value);
  });

  const body = await backendResponse.text();
  return new NextResponse(body, {
    status: backendResponse.status,
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
