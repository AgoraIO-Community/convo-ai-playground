import { cache } from "react";
import { DEFAULT_TEACHER_LOCALE } from "./index";
export const readRequestTeacherLocale = cache(async () => {
  return DEFAULT_TEACHER_LOCALE;
});
