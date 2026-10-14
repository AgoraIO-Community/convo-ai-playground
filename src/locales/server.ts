import { cache } from "react";
import { cookies } from "next/headers";
import { parseTeacherLocale, TEACHER_LOCALE_COOKIE } from "./index";
export const readRequestTeacherLocale = cache(async () => {
  return parseTeacherLocale((await cookies()).get(TEACHER_LOCALE_COOKIE)?.value);
});
