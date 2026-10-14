import { expect, it } from "vitest";
import { assertTeacherLessonLocale } from "./lessonLocale";
import type { TeacherLessonPlan } from "@/types/teacher";
function plan(speech: string): TeacherLessonPlan { return { turnId: "test", topic: "AI", cues: [{ cueId: "one", speech, boardActions: [] }] }; }
const english = "The agent is working with this information. It will then choose an action from the available options and check the result.";
const portuguese = "Uma agente observa o ambiente para entender sua situação. Então escolhe uma ação com base no que você pediu e verifica o resultado.";
it("rejects substantial clearly wrong-language lessons but permits technical snippets", () => {
  expect(() => assertTeacherLessonLocale(plan(english), "pt-BR")).toThrow(/pt-BR/);
  expect(() => assertTeacherLessonLocale(plan(portuguese), "en-US")).toThrow(/en-US/);
  expect(() => assertTeacherLessonLocale(plan(english), "en-US")).not.toThrow();
  expect(() => assertTeacherLessonLocale(plan(portuguese), "pt-BR")).not.toThrow();
  expect(() => assertTeacherLessonLocale(plan("LLM → tool → feedback"), "pt-BR")).not.toThrow();
});
