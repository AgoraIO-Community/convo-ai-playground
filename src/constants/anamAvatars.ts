// src/constants/anamAvatars.ts
// Curated Anam stock avatars (UUID = id from GET …/avatars; label uses displayName + variant).
// Docs: https://docs.anam.ai/resources/avatar-gallery

export interface AnamAvatarOption {
  label: string;
  value: string;
}

/** Ten personas from Anam stock `data` (mixed poses / variants). Cara — desk first = app default. */
export const ANAM_AVATAR_OPTIONS: AnamAvatarOption[] = [
  { label: "Cara — desk", value: "30fa96d0-26c4-4e55-94a0-517025942e18" },
  { label: "Mia — studio", value: "edf6fdcb-acab-44b8-b974-ded72665ee26" },
  { label: "Liv — home", value: "071b0286-4cce-4808-bee2-e642f1062de3" },
  { label: "Gabriel — table", value: "6cc28442-cccd-42a8-b6e4-24b7210a09c5" },
  { label: "Anne — home", value: "27e12daa-50fc-4384-93c2-ebca73f1f78d" },
  { label: "Bella — sofa", value: "dc9aa3e1-32f2-499e-9921-ecabac1076fc" },
  { label: "Finn — lean", value: "8a339c9f-0666-46bd-ab27-e90acd0409dc" },
  { label: "Sophie — sofa", value: "6dbc1e47-7768-403e-878a-94d7fcc3677b" },
  { label: "Hunter — table", value: "ecfb2ddb-80ec-4526-88a7-299a4738957c" },
  { label: "Layla — home", value: "ae2ea8c1-db28-47e3-b6ea-493e4ed3c554" },
];

/** Default Anam avatar (Cara — desk) */
export const ANAM_DEFAULT_AVATAR_ID = "30fa96d0-26c4-4e55-94a0-517025942e18";
