import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { planTeacherLesson } from "./lessonPlanner";

const validLesson: { topic: string; cues: { cue_id: string; speech: string; operations: Record<string, unknown>[] }[] } = {
  topic: "Agent loop",
  cues: [
    {
      cue_id: "observe",
      speech: "An agent begins by observing its environment.",
      operations: [
        {
          type: "add_ellipse",
          element_id: "observe",
          x: 100,
          y: 220,
          width: 190,
          height: 110,
          label: "Observe",
        },
      ],
    },
    {
      cue_id: "reason",
      speech: "It reasons about the information it collected.",
      operations: [
        {
          type: "add_rectangle",
          element_id: "reason",
          x: 420,
          y: 220,
          width: 190,
          height: 110,
          label: "Reason",
        },
      ],
    },
    {
      cue_id: "connect",
      speech: "The observation flows into reasoning.",
      operations: [
        {
          type: "add_arrow",
          element_id: "observe-reason",
          start: { x: 290, y: 275 },
          end: { x: 420, y: 275 },
        },
      ],
    },
    {
      cue_id: "recap",
      speech: "The cycle repeats after the agent acts.",
      operations: [
        {
          type: "add_text",
          element_id: "recap",
          x: 100,
          y: 500,
          text: "Observe → Reason → Act → Feedback",
          font_size: 30,
        },
      ],
    },
  ],
};

describe("planTeacherLesson", () => {
  it("repairs an English response into the requested Brazilian Portuguese", async () => {
    const englishPlan = structuredClone(validLesson);
    englishPlan.cues[0].speech = "The agent is observing its environment with this information, then it will choose an action from the available options.";
    const pt = structuredClone(validLesson);
    pt.topic = "Ciclo do agente";
    const speech = [
      "Uma agente começa observando o ambiente para entender sua situação e descobrir o que precisa fazer.",
      "Então ela usa essas informações para escolher uma ação de acordo com o que você pediu.",
      "O resultado volta para a agente, que verifica se sua ação funcionou e decide o próximo passo.",
      "Você pode acompanhar esse ciclo no quadro: observar, decidir, agir e verificar o resultado com atenção.",
    ];
    pt.cues.forEach((cue, index) => { cue.speech = speech[index]; });
    const response = (lesson: typeof validLesson) => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(lesson) } }] }), { status: 200 });
    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValueOnce(response(englishPlan)).mockResolvedValueOnce(response(pt));
    const result = await planTeacherLesson({ turnId: "turn-pt", question: "Como funciona um agente?", mode: "lesson", context: [], boardSummary: "", locale: "pt-BR" });
    expect(result.topic).toBe("Ciclo do agente");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const payload = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(JSON.parse(payload.messages[1].content)).toMatchObject({ response_locale: "pt-BR" });
    expect(payload.messages[0].content).toContain("Brazilian Portuguese");
    expect(String(fetchMock.mock.calls[1][1]?.body)).toContain("pt-BR");
  });
  beforeEach(() => {
    vi.useFakeTimers();
    process.env.TEACHER_DIRECTOR_API_KEY = "test-key";
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    delete process.env.TEACHER_DIRECTOR_API_KEY;
  });

  it("accepts a valid lesson response that takes 25 seconds", async () => {
    vi.spyOn(global, "fetch").mockImplementation((_url, options) => {
      const signal = options?.signal;
      return new Promise<Response>((resolve, reject) => {
        const timer = setTimeout(() => {
          resolve(
            new Response(
              JSON.stringify({
                choices: [{ message: { content: JSON.stringify(validLesson) } }],
              }),
              { status: 200, headers: { "Content-Type": "application/json" } },
            ),
          );
        }, 25_000);
        signal?.addEventListener(
          "abort",
          () => {
            clearTimeout(timer);
            reject(new DOMException("Aborted", "AbortError"));
          },
          { once: true },
        );
      });
    });

    const resultPromise = planTeacherLesson({
      turnId: "turn-1",
      question: "How does an AI agent loop work?",
      locale: "en-US",
      context: [],
      boardSummary: "",
      mode: "lesson",
    });
    const resultExpectation = expect(resultPromise).resolves.toMatchObject({
      topic: "Agent loop",
    });

    await vi.advanceTimersByTimeAsync(25_000);
    await resultExpectation;
  });

  it("repairs overlapping lesson text locally without a second planner request", async () => {
    const lessonWithOverlappingText = structuredClone(validLesson);
    lessonWithOverlappingText.cues[0].operations.push(
      {
        type: "add_text",
        element_id: "title",
        x: 100,
        y: 80,
        text: "How an AI agent works",
        font_size: 36,
      },
      {
        type: "add_text",
        element_id: "loop-caption",
        x: 120,
        y: 90,
        text: "A repeating decision cycle",
        font_size: 30,
      },
    );

    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify(lessonWithOverlappingText),
                },
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockRejectedValueOnce(new Error("Unexpected second planner request"));

    const result = await planTeacherLesson({
      turnId: "turn-overlap",
      question: "How does an AI agent work?",
      locale: "en-US",
      context: [],
      boardSummary: "",
      mode: "lesson",
    });

    const title = result.cues[0].boardActions.find(
      (operation) =>
        operation.type === "add_text" && operation.elementId === "title",
    );
    const caption = result.cues[0].boardActions.find(
      (operation) =>
        operation.type === "add_text" &&
        operation.elementId === "loop-caption",
    );

    expect(title).toMatchObject({ type: "add_text", y: 80, fontSize: 36 });
    expect(caption).toMatchObject({
      type: "add_text",
      y: 147,
      fontSize: 30,
    });
  });
});
