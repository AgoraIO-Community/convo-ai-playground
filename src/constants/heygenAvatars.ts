// src/constants/heygenAvatars.ts
// Curated public LiveAvatar IDs (UUIDs) from GET https://api.liveavatar.com/v1/avatars/public
// Agora join maps UI vendor "heygen" → liveavatar; avatar_id must be these UUIDs.
// Label is shown in the dropdown; value is avatar_id sent to the agent API.

export interface HeyGenAvatarOption {
  label: string;
  value: string;
}

export interface HeyGenAvatarGroup {
  group: string;
  options: HeyGenAvatarOption[];
}

/** Public LiveAvatar avatars — distinct roles (API type is VIDEO for all). */
const LIVEAVATAR_PUBLIC: HeyGenAvatarGroup = {
  group: "LiveAvatar (public)",
  options: [
    {
      label: "Santa — Fireplace (character)",
      value: "1c690fe7-23e0-49f9-bfba-14344450285b",
    },
    {
      label: "Ann — Therapist",
      value: "513fd1b7-7ef9-466d-9af2-344e51eeb833",
    },
    {
      label: "Dexter — Lawyer",
      value: "0930fd59-c8ad-434d-ad53-b391a1768720",
    },
    {
      label: "June — HR",
      value: "65f9e3c9-d48b-4118-b73a-4ae2e3cbb8f0",
    },
    {
      label: "Bryan — Tech expert",
      value: "64b526e4-741c-43b6-a918-4e40f3261c7a",
    },
    {
      label: "Silas — HR",
      value: "9650a758-1085-4d49-8bf3-f347565ec229",
    },
    {
      label: "Ann — Doctor (standing)",
      value: "567e8371-f69f-49ec-9f2d-054083431165",
    },
    {
      label: "Shawn — Therapist",
      value: "7b888024-f8c9-4205-95e1-78ce01497bda",
    },
    {
      label: "Silas — Customer support",
      value: "dc2935cf-5863-4f08-943b-c7478aea59fb",
    },
    {
      label: "Judy — Teacher (sitting)",
      value: "c72a9099-84b9-4d5d-98f4-a19ba131e654",
    },
  ],
};

/** All avatar groups in display order */
export const HEYGEN_AVATAR_GROUPS: HeyGenAvatarGroup[] = [LIVEAVATAR_PUBLIC];

/** Flat list of all avatars (useful for lookups) */
export const HEYGEN_ALL_AVATARS: HeyGenAvatarOption[] = HEYGEN_AVATAR_GROUPS.flatMap(
  (g) => g.options,
);

/** Default: Silas — HR (public UUID) */
export const HEYGEN_DEFAULT_AVATAR_ID = "9650a758-1085-4d49-8bf3-f347565ec229";
