import { expect, it } from "vitest";
import { classifyTeacherIntent, isUnfinishedQuestionStem } from "./teacherIntents";
it.each([
  ["pode continuar", "resume"], ["continue", "resume"], ["pare", "stop"], ["espere", "stop"],
  ["limpe o quadro", "clear"], ["apague o quadro", "clear"], ["mude de assunto", "replace"],
  ["Não pare", null], ["não limpe o quadro", null], ["Como funciona um agente?", null],
] as const)("classifies Brazilian command %s", (text, expected) => {
  expect(classifyTeacherIntent(text, "pt-BR")).toBe(expected);
});
it("keeps language-specific stems and English commands", () => {
  expect(isUnfinishedQuestionStem("Como funciona", "pt-BR")).toBe(true);
  expect(isUnfinishedQuestionStem("Como funciona um agente?", "pt-BR")).toBe(false);
  expect(isUnfinishedQuestionStem("How does", "en-US")).toBe(true);
  expect(classifyTeacherIntent("do not stop", "en-US")).toBeNull();
  expect(classifyTeacherIntent("clear the board", "en-US")).toBe("clear");
  expect(classifyTeacherIntent("switch to a different topic", "en-US")).toBe("replace");
});
