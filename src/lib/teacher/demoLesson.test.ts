import { expect, it } from "vitest";
import { getPhotosynthesisDemo } from "./demoLesson";
it("changes visible preview text while preserving operations and IDs", () => {
  const pt = getPhotosynthesisDemo("pt-BR"), en = getPhotosynthesisDemo("en-US");
  expect(JSON.stringify(pt)).toContain("Fotossíntese");
  expect(JSON.stringify(pt)).toContain("Água");
  expect(JSON.stringify(pt)).toContain("nos cloroplastos");
  expect(JSON.stringify(pt)).toContain("Energia vira");
  expect(JSON.stringify(en)).toContain("Photosynthesis");
  expect(pt.flatMap(e => e.command.operations).map(o => o.type)).toEqual(en.flatMap(e => e.command.operations).map(o => o.type));
});
