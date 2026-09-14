import { NextRequest } from "next/server";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod/v4";
import { parseTeacherDrawRequest } from "@/lib/teacher/commands";
import { isTeacherMcpOpenDemoEnabled } from "@/server/teacher/mcpConfig";
import {
  authorizeTeacherSession,
  publishTeacherCommand,
  publishTeacherCommandToActiveSession,
} from "@/server/teacher/sessionBroker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function bearerToken(request: NextRequest): string {
  const authorization = request.headers.get("authorization") ?? "";
  return authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : "";
}

function unauthorized(): Response {
  return Response.json(
    {
      jsonrpc: "2.0",
      error: { code: -32001, message: "Unauthorized teacher session." },
      id: null,
    },
    { status: 401 },
  );
}

const teacherColorSchema = z
  .enum(["white", "cyan", "blue", "green", "amber", "red"])
  .describe("Chalk color used to draw the element.");

const elementIdSchema = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[a-zA-Z0-9][a-zA-Z0-9_.:-]*$/)
  .describe("Stable unique ID for this board element, reused by later updates.");

const coordinateSchema = z
  .number()
  .min(-10_000)
  .max(10_000)
  .describe("Canvas coordinate in pixels.");

const dimensionSchema = z
  .number()
  .min(1)
  .max(4_000)
  .describe("Element size in pixels.");

const boardTextSchema = z
  .string()
  .trim()
  .min(1)
  .max(500)
  .describe("Short readable text shown on the blackboard.");

const pointSchema = z
  .object({
    x: coordinateSchema,
    y: coordinateSchema,
  })
  .strict();

const teacherOperationSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("add_text"),
      element_id: elementIdSchema,
      x: coordinateSchema,
      y: coordinateSchema,
      text: boardTextSchema,
      color: teacherColorSchema.optional(),
      font_size: z.number().min(12).max(72).optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal("add_rectangle"),
      element_id: elementIdSchema,
      x: coordinateSchema,
      y: coordinateSchema,
      width: dimensionSchema,
      height: dimensionSchema,
      color: teacherColorSchema.optional(),
      label: boardTextSchema.optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal("add_ellipse"),
      element_id: elementIdSchema,
      x: coordinateSchema,
      y: coordinateSchema,
      width: dimensionSchema,
      height: dimensionSchema,
      color: teacherColorSchema.optional(),
      label: boardTextSchema.optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal("add_diamond"),
      element_id: elementIdSchema,
      x: coordinateSchema,
      y: coordinateSchema,
      width: dimensionSchema,
      height: dimensionSchema,
      color: teacherColorSchema.optional(),
      label: boardTextSchema.optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal("add_arrow"),
      element_id: elementIdSchema,
      start: pointSchema,
      end: pointSchema,
      color: teacherColorSchema.optional(),
      label: boardTextSchema.optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal("add_line"),
      element_id: elementIdSchema,
      start: pointSchema,
      end: pointSchema,
      color: teacherColorSchema.optional(),
      label: boardTextSchema.optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal("update_element"),
      element_id: elementIdSchema,
      patch: z
        .object({
          x: coordinateSchema.optional(),
          y: coordinateSchema.optional(),
          width: dimensionSchema.optional(),
          height: dimensionSchema.optional(),
          color: teacherColorSchema.optional(),
          text: boardTextSchema.optional(),
          label: boardTextSchema.optional(),
          font_size: z.number().min(12).max(72).optional(),
        })
        .strict()
        .describe("One or more properties to change on the existing element."),
    })
    .strict(),
  z
    .object({
      type: z.literal("delete_element"),
      element_id: elementIdSchema,
    })
    .strict(),
  z.object({ type: z.literal("clear_ai_elements") }).strict(),
  z.object({ type: z.literal("clear_board") }).strict(),
  z
    .object({
      type: z.literal("focus_area"),
      x: coordinateSchema,
      y: coordinateSchema,
      width: dimensionSchema,
      height: dimensionSchema,
    })
    .strict(),
]);

async function handleMcpRequest(request: NextRequest): Promise<Response> {
  const openDemo = isTeacherMcpOpenDemoEnabled();
  const sessionId = request.nextUrl.searchParams.get("sessionId") ?? "";
  const token = bearerToken(request);
  if (!openDemo && !(await authorizeTeacherSession(sessionId, token))) {
    return unauthorized();
  }

  const server = new McpServer({
    name: "convoai-teacher-board",
    version: "0.1.0",
  });
  server.registerTool(
    "teacher_draw",
    {
      title: "Draw on the AI teacher blackboard",
      description:
        "Draw real, visible teaching content on the current Excalidraw blackboard. Use add operations with stable element_id values and canvas coordinates, then update or delete those IDs as needed.",
      inputSchema: {
        turn_id: elementIdSchema.describe(
          "Unique ID for this teaching explanation, shared by its progressive updates.",
        ),
        sequence: z
          .number()
          .int()
          .nonnegative()
          .describe("Starts at 1 and increments for each update in the same turn."),
        animation: z
          .enum(["progressive", "instant"])
          .optional()
          .describe("Use progressive while explaining; instant for immediate changes."),
        operations: z
          .array(teacherOperationSchema)
          .min(1)
          .max(24)
          .describe("Concrete blackboard changes to render in this update."),
      },
    },
    async (input) => {
      const requestContext = {
        turnId: input.turn_id,
        sequence: input.sequence,
        operationCount: input.operations.length,
        operationTypes: input.operations.map((operation) => operation.type),
      };
      console.info("[teacherboard] teacher_draw requested", requestContext);

      const parsed = parseTeacherDrawRequest(input);
      if (!parsed.ok) {
        console.warn("[teacherboard] teacher_draw rejected", {
          ...requestContext,
          error: parsed.error,
        });
        return {
          isError: true,
          content: [{ type: "text", text: parsed.error }],
        };
      }
      let published: Awaited<
        ReturnType<typeof publishTeacherCommandToActiveSession>
      >;
      if (openDemo) {
        published = await publishTeacherCommandToActiveSession(parsed.value);
      } else {
        const event = await publishTeacherCommand(
          sessionId,
          token,
          parsed.value,
        );
        published = event ? { sessionId, event } : null;
      }
      if (!published) {
        console.warn("[teacherboard] teacher_draw has no active board", {
          ...requestContext,
          openDemo,
        });
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: openDemo
                ? "No active teacher board is connected. Open Teacher Mode and try again."
                : "The teacher board session has expired.",
            },
          ],
        };
      }
      console.info("[teacherboard] teacher_draw accepted", {
        ...requestContext,
        session: published.sessionId.slice(0, 8),
        eventId: published.event.eventId,
      });
      return {
        content: [
          {
            type: "text",
            text: `Blackboard update accepted as event ${published.event.eventId}.`,
          },
        ],
        structuredContent: { event_id: published.event.eventId },
      };
    },
  );

  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await server.connect(transport);
  return transport.handleRequest(request);
}

export const GET = handleMcpRequest;
export const POST = handleMcpRequest;
export const DELETE = handleMcpRequest;
