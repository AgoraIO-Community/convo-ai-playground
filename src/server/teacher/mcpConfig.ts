import { authorizeTeacherSession } from "@/server/teacher/sessionBroker";

export interface TeacherSessionReference {
  sessionId: string;
  token: string;
}

function cloneProperties(
  properties: Record<string, unknown>,
): Record<string, unknown> {
  return structuredClone(properties);
}

export function isTeacherMcpOpenDemoEnabled(): boolean {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.TEACHER_MCP_OPEN_DEMO?.trim().toLowerCase() === "true"
  );
}

function getTeacherMcpEndpoint(sessionId: string): string | null {
  const configuredOrigin = process.env.TEACHER_MCP_PUBLIC_URL?.trim();
  if (!configuredOrigin) return null;

  try {
    const url = new URL(configuredOrigin);
    if (url.protocol !== "https:") return null;
    url.pathname = "/api/teacher/mcp";
    url.search = "";
    url.hash = "";
    if (!isTeacherMcpOpenDemoEnabled()) {
      url.searchParams.set("sessionId", sessionId);
    }
    return url.toString();
  } catch {
    return null;
  }
}

/**
 * Adds the private teacher board tool to one runtime join payload.
 * The source object is never mutated and the session credential is never
 * written into persisted AgentSettings.
 */
export async function appendTeacherMcpToProperties(
  properties: Record<string, unknown>,
  teacherSession?: TeacherSessionReference | null,
): Promise<Record<string, unknown>> {
  const cloned = cloneProperties(properties);
  if (!teacherSession) return cloned;

  const endpoint = getTeacherMcpEndpoint(teacherSession.sessionId);
  if (
    !endpoint ||
    !(await authorizeTeacherSession(
      teacherSession.sessionId,
      teacherSession.token,
    ))
  ) {
    return cloned;
  }

  const mllm =
    cloned.mllm && typeof cloned.mllm === "object"
      ? (cloned.mllm as Record<string, unknown>)
      : undefined;
  const advancedFeatures =
    cloned.advanced_features && typeof cloned.advanced_features === "object"
      ? (cloned.advanced_features as Record<string, unknown>)
      : {};
  if (mllm?.enable === true || advancedFeatures.enable_mllm === true) {
    return cloned;
  }

  const llm =
    cloned.llm && typeof cloned.llm === "object"
      ? (cloned.llm as Record<string, unknown>)
      : null;
  if (!llm) return cloned;

  const existingServers = Array.isArray(llm.mcp_servers)
    ? llm.mcp_servers
    : [];
  const teacherServer = {
    name: "teacherboard",
    endpoint,
    transport: "streamable_http",
    ...(!isTeacherMcpOpenDemoEnabled()
      ? {
          headers: {
            Authorization: `Bearer ${teacherSession.token}`,
          },
        }
      : {}),
    timeout_ms: 10_000,
    allowed_tools: ["teacher_draw"],
  };
  cloned.llm = {
    ...llm,
    mcp_servers: [
      ...existingServers,
      teacherServer,
    ],
  };
  cloned.advanced_features = {
    ...advancedFeatures,
    enable_tools: true,
  };
  return cloned;
}
