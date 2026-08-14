import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/mcp/tools
 * Proxies tools/list to an MCP server. Body: { endpoint: string, headers?: Record<string, string>, transport?: string }
 * Returns { tools: { name: string; description?: string }[] } for UI checkboxes.
 * MCP uses JSON-RPC: method "tools/list", result.tools is the list.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { endpoint, headers = {} } = body as {
      endpoint?: string;
      headers?: Record<string, string>;
      transport?: string;
    };

    if (!endpoint || typeof endpoint !== "string") {
      return NextResponse.json(
        { error: "endpoint is required", tools: [] },
        { status: 400 }
      );
    }

    const listRequest = {
      jsonrpc: "2.0",
      id: 1,
      method: "tools/list",
      params: {},
    };

    const mergedHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      ...headers,
    };

    const res = await fetch(endpoint, {
      method: "POST",
      headers: mergedHeaders,
      body: JSON.stringify(listRequest),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      return NextResponse.json(
        { tools: [], error: `MCP server returned ${res.status}` },
        { status: 200 }
      );
    }

    const data = (await res.json()) as {
      result?: { tools?: Array<{ name?: string; description?: string }> };
      error?: { message?: string };
    };

    if (data.error) {
      return NextResponse.json(
        { tools: [], error: data.error.message ?? "MCP error" },
        { status: 200 }
      );
    }

    const rawTools = data.result?.tools ?? [];
    const tools = rawTools.map((t) => ({
      name: typeof t.name === "string" ? t.name : "",
      description: typeof t.description === "string" ? t.description : undefined,
    })).filter((t) => t.name);

    return NextResponse.json({ tools });
  } catch (err) {
    console.error("MCP tools list error:", err);
    return NextResponse.json(
      { tools: [], error: err instanceof Error ? err.message : "Failed to list tools" },
      { status: 200 }
    );
  }
}
