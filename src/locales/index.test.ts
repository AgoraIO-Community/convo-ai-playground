import { describe, expect, it } from "vitest";
import { getTeacherLocaleProfile, parseTeacherLocale } from "./index";

describe("teacher locale preferences", () => {
  it("defaults malformed preferences to Brazilian Portuguese", () => {
    for (const value of [undefined, null, "", "pt-PT", "fr-FR"]) expect(parseTeacherLocale(value)).toBe("pt-BR");
    expect(parseTeacherLocale("en-US")).toBe("en-US");
    expect(parseTeacherLocale("pt-BR")).toBe("pt-BR");
  });
  it("resolves complete profiles with matching recognition languages", () => {
    expect(getTeacherLocaleProfile("pt-BR").asr.language).toBe("pt-BR");
    expect(getTeacherLocaleProfile("en-US").asr.language).toBe("en-US");
    expect(getTeacherLocaleProfile("pt-BR").agent.greeting).toContain("{{username}}");
    expect(getTeacherLocaleProfile("pt-BR").messages.landing.enter).toBeTruthy();
  });
});
