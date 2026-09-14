export type CallExperienceMode = "voice" | "video" | "teacher";

export type StandardCallExperienceMode = Exclude<
  CallExperienceMode,
  "teacher"
>;
