# TTS voice cloning for the ConvoAI Playground

Last reviewed: 2026-09-07

## Goal

Add a **Clone a voice** workflow to the TTS section of the Playground. A user should be able to record a sample in the browser or upload an audio file, let the selected TTS vendor create a reusable voice, preview it, and then use the returned voice identifier in the Agora Conversational AI Engine `tts` configuration.

Voice creation is a vendor-side operation. Agora consumes the finished voice identifier during agent startup; Agora does not create the clone as part of `/join`.

## Important credential rule

The cloned voice belongs to the vendor account that created it. The credentials used by Agora for TTS must be able to access that same voice.

- For a Playground-managed cloning flow, use **BYOK for both cloning and TTS**.
- Do not create a voice with a user's vendor key and then start TTS with unrelated Agora-managed vendor credentials. The managed account may not be able to see the clone.
- Keep vendor keys on the server. The browser uploads audio to a Playground API route; the API route calls the vendor.
- If Agora later exposes a managed voice-cloning API, managed mode can be reconsidered. No such generic cloning operation is documented in the current Agent `/join` API.

## Compatibility legend

- **Direct**: Public creation API plus a returned identifier that fits the documented Agora integration.
- **Usable with caveat**: The vendor supports cloning, but access, creation, or Agora parameter compatibility needs validation.
- **Assisted**: A vendor sales/support engagement creates the voice; the Playground can only accept the resulting identifier.
- **Not public**: No public self-service cloning API was found in the vendor documentation reviewed.
- **Depends**: Generic TTS is an adapter, not a voice provider.

## Vendor matrix

The list below follows the 18 TTS integrations currently listed in the [Agora TTS documentation](https://docs.agora.io/en/ai/models/tts/minimax).

| Agora TTS vendor | Voice cloning | How the voice is created | Agora field that selects it | Playground recommendation |
| --- | --- | --- | --- | --- |
| Amazon Polly | Assisted | AWS creates a private Brand Voice through a managed engagement; customers cannot create it themselves. | `params.voice_id` | Accept an already-provisioned Brand Voice ID only. No record/upload flow. |
| Cartesia | Direct | `POST https://api.cartesia.ai/voices/clone` with a multipart audio `clip`; response contains a voice `id`. | `params.voice = { "mode": "id", "id": "<id>" }` | Phase 1 candidate. |
| Deepgram | Not public | Current public Aura TTS docs expose preset voice models; no self-service cloning endpoint was found. | TTS model name | Do not show **Clone a voice**. |
| ElevenLabs | Direct | `POST /v1/voices/add` with multipart `files` and `name`; response contains `voice_id`. | `params.voice_id` | **Implemented for BYOK.** Record or upload a sample and apply the returned ID immediately. |
| Fish Audio | Direct | Create a model through Fish Audio's `/model` endpoint using reference audio; response provides the model/reference ID. | `params.reference_id` | Phase 1 candidate. |
| Generic TTS | Depends | The configured HTTP endpoint owns the cloning API and identifier format. | Defined by the endpoint request template | Offer an advanced custom adapter, not a built-in clone flow. |
| Google Cloud TTS | Usable with caveat | Instant Custom Voice generates a `voice_cloning_key` from reference and consent audio. Access and regions are restricted. | Current Agora docs validate `params.VoiceSelectionParams.name`; a cloning-key shape is not documented. | Test via Generic TTS or obtain Agora adapter confirmation before enabling. |
| Gradium | Direct | `POST https://api.gradium.ai/api/voices/` with multipart `audio_file`, `name`, and `language`; response contains `uid`. | Use the returned UID as the Agora Gradium voice identifier; confirm the final field against the deployed adapter. | Phase 1 candidate after one integration test. |
| Hume AI | Usable with caveat | Hume's platform supports microphone recording or file upload and creates a private custom voice. Public TTS APIs select it by ID. | `params.voice_id` and `params.provider = "CUSTOM_VOICE"` | Good candidate if Hume exposes/approves the raw cloning API for third-party UI; otherwise link to Hume's cloning UI and import the ID. |
| Microsoft Azure | Usable with caveat | Personal Voice requires an approved account, a project, recorded consent, sample audio, and an asynchronous operation returning `speakerProfileId`. | Agora currently documents `params.voice_name`, not `speakerProfileId`/personal-voice SSML. | Keep as an advanced experiment until the Agora adapter path is confirmed. |
| MiniMax | Direct | Upload the main sample with `purpose=voice_clone`, then call `POST /v1/voice_clone` with `file_id` and a caller-chosen `voice_id`. | `params.voice_setting.voice_id` | **Implement first.** Complete flow is below. |
| Mistral | Usable with caveat | Voxtral TTS can create a reusable voice from a short reference sample and returns `voice_id`. | Agora's current Mistral adapter needs validation for saved `voice_id` versus its documented preset/reference format. | Phase 2 after an end-to-end adapter test. |
| Murf | Assisted | Enterprise-only, non-self-service workflow; Murf creates the custom model after receiving recording data. | `params.voiceId` | Accept an already-provisioned voice ID only. |
| OpenAI | Usable with caveat | Eligible customers can create consent records and custom voices; TTS selects a custom voice using a voice object/ID. | Agora currently documents `params.voice` as a string. | Do not enable until Agora confirms custom voice-object support; Generic TTS is the fallback. |
| Rime | Assisted | Growth/Enterprise engagement using 30–60 minutes minimum of clean recordings; Rime returns a UUID. | `params.speaker` | Accept the Rime-provisioned UUID only. |
| Sarvam | Usable with caveat | Content Studio has a consented browser-recording clone flow; voice cloning for voice agents is enterprise-only. | `params.speaker` | Offer ID import for approved enterprise accounts; do not assume the public Content Studio clone is agent-enabled. |
| Typecast | Direct | `POST https://api.typecast.ai/v1/voices/clone` with multipart audio and metadata; response contains `voice_id`. | `params.voice_id` | Phase 1 candidate. |
| xAI | Usable with caveat | Console creation is available for eligible US users; `POST /v1/custom-voices` returns `voice_id` but API creation is Enterprise-only. | `params.voice_id` | Allow ID import; enable direct upload only for Enterprise-enabled teams and supported regions. |

## Recommended rollout

1. **MiniMax BYOK**: implement and validate the complete workflow.
2. **ElevenLabs BYOK**: implemented with Instant Voice Cloning; validate the returned voice in an Agora agent call.
3. **Cartesia, Fish Audio, Typecast**: add direct creation adapters because their returned identifiers map cleanly into Agora's documented TTS configuration.
4. **Gradium and Hume AI**: enable after confirming the creation entitlement and running one Agora `/join` test with the cloned ID.
5. **Google, Azure, Mistral, OpenAI, Sarvam, xAI**: keep behind an experimental/eligibility label until the vendor entitlement and Agora adapter shape are verified.
6. **Amazon Polly, Murf, Rime**: provide an **Import existing voice ID** field because cloning is vendor-assisted.

## ElevenLabs implementation

Select **ElevenLabs**, keep credential mode on **BYOK**, and use the Instant
Voice Cloning panel below the voice selector. The Playground accepts an upload
or browser recording, requires consent, and calls the authenticated server
route `POST /api/tts/elevenlabs/voice-clone`. That route sends multipart form
data to `POST https://api.elevenlabs.io/v1/voices/add` and returns the new
`voice_id`. It then synthesizes the editable preview sentence with the new
voice and displays the returned MP3 inline. Preview synthesis consumes a small
number of ElevenLabs credits.

The clone route uses the key entered in the current TTS settings when present,
otherwise it uses the server-side `ELEVENLABS_API_KEY`. The resulting ID is
selected as `tts.params.voice_id`, so Agora uses the same ElevenLabs account and
clone for synthesis. Instant cloning returns synchronously and does not require
polling. If preview synthesis fails, the successful clone and selected
`tts.params.voice_id` are preserved and the Playground shows a warning.

For best results, provide approximately 1–2 minutes of clean, consistent,
single-speaker audio. Background-noise removal is optional and should remain off
for already-clean recordings.

## MiniMax implementation specification

### Prerequisites

- A MiniMax API key and group ID.
- MiniMax BYOK selected in the Playground TTS settings.
- User confirmation that they own the voice or have explicit permission to clone it.
- The same MiniMax account must be used for clone creation and Agora TTS.

### Audio requirements

For the main clone sample, MiniMax accepts MP3, M4A, or WAV, from 10 seconds through 5 minutes, up to 20 MB. An optional prompt clip can improve similarity and stability; it must be shorter than 8 seconds and have an exact transcript.

The UI should enforce these limits before upload and should prefer clean, single-speaker audio without music, reverb, or background noise.

### Step 1: upload the main sample

```http
POST https://api.minimax.io/v1/files/upload
Authorization: Bearer <MINIMAX_API_KEY>
Content-Type: multipart/form-data

purpose=voice_clone
file=@voice-sample.wav
```

Read `file.file_id` from the response.

### Step 2: optionally upload a prompt clip

```http
POST https://api.minimax.io/v1/files/upload
Authorization: Bearer <MINIMAX_API_KEY>
Content-Type: multipart/form-data

purpose=prompt_audio
file=@prompt.wav
```

Read `file.file_id` from the response. This becomes `clone_prompt.prompt_audio`, and `clone_prompt.prompt_text` must exactly match what the speaker said.

### Step 3: create the cloned voice

Minimal request:

```http
POST https://api.minimax.io/v1/voice_clone
Authorization: Bearer <MINIMAX_API_KEY>
Content-Type: application/json
```

```json
{
  "file_id": 123456789,
  "voice_id": "playground_voice_001",
  "need_noise_reduction": true,
  "need_volume_normalization": true
}
```

The caller chooses `voice_id`. It must be 8–256 characters, start with an English letter, contain only letters, digits, hyphens, or underscores, not end with a hyphen/underscore, and be unique in the MiniMax account.

Optional prompt and preview request:

```json
{
  "file_id": 123456789,
  "voice_id": "playground_voice_001",
  "clone_prompt": {
    "prompt_audio": 987654321,
    "prompt_text": "This is the exact prompt audio transcript."
  },
  "text": "Hello! This is a preview of my cloned voice.",
  "model": "speech-2.8-turbo",
  "text_validation": "This is the exact transcript of the main sample.",
  "accuracy": 0.7,
  "need_noise_reduction": true,
  "need_volume_normalization": true
}
```

When `text` and `model` are supplied, MiniMax returns a `demo_audio` preview URL and charges for the preview characters. A cloned MiniMax voice that is not used within seven days is deleted, so the Playground should perform a short synthesis or clearly warn the user.

### Step 4: put the voice into the Agora TTS configuration

The clone operation does not return a different ID: use the caller-chosen MiniMax `voice_id`.

```json
{
  "tts": {
    "vendor": "minimax",
    "params": {
      "key": "<MINIMAX_API_KEY>",
      "group_id": "<MINIMAX_GROUP_ID>",
      "url": "wss://api-uw.minimax.io/ws/v1/t2a_v2",
      "model": "speech-2.8-turbo",
      "voice_setting": {
        "voice_id": "playground_voice_001",
        "speed": 1.0
      },
      "audio_setting": {
        "sample_rate": 24000
      }
    }
  }
}
```

For a realtime conversational agent, start with 24 kHz output and verify the actual RTC/telephony path. Use the sample rate required by the active path rather than blindly copying MiniMax's 44.1 kHz documentation sample.

### Proposed Playground server API

Keep a normalized application contract even though vendor APIs differ:

```text
POST   /api/voice-clones/minimax
GET    /api/voice-clones?provider=minimax
GET    /api/voice-clones/:id
DELETE /api/voice-clones/:id
```

`POST /api/voice-clones/minimax` should accept multipart form data:

```text
audio                  required file
name                   required display name
voiceId                optional; server generates a valid unique ID if absent
promptAudio            optional file
promptText             required when promptAudio is present
validationText         optional exact transcript for ASR validation
noiseReduction         optional boolean
volumeNormalization    optional boolean
consentConfirmed       required true
```

Suggested response:

```json
{
  "provider": "minimax",
  "voiceId": "playground_voice_001",
  "displayName": "My support voice",
  "status": "ready",
  "previewUrl": "https://...",
  "agoraPatch": {
    "voice_setting": {
      "voice_id": "playground_voice_001"
    }
  }
}
```

The delete route must only call a vendor delete endpoint when that endpoint is documented and supported. Otherwise it should delete only the Playground's local record and explain that vendor-side deletion must be completed in the vendor console.

## UI proposal

Place **Clone a voice** below the voice selector only for supported providers.

1. Choose **Record** or **Upload**.
2. Show duration, format, size, noise, and single-speaker guidance before submission.
3. Require a voice name and explicit consent confirmation.
4. Upload through the Playground server and show `uploading`, `processing`, `ready`, or `failed`.
5. Play the returned preview inline.
6. On **Use this voice**, update the provider-specific voice field in Settings and preserve the rest of the TTS JSON.
7. Show an **Import existing voice ID** action for assisted or externally-created voices.

Do not expose a single generic `voice_id` input and assume it maps identically for every provider. The adapter layer must translate the normalized Playground voice record into the vendor-specific Agora field.

## Normalized voice record

```ts
type ClonedVoice = {
  id: string;
  userId: string;
  provider: string;
  providerVoiceId: string;
  displayName: string;
  status: "uploading" | "processing" | "ready" | "failed";
  previewUrl?: string;
  createdAt: string;
  consent: {
    confirmed: boolean;
    confirmedAt: string;
    subject: "self" | "authorized_third_party";
  };
  metadata?: Record<string, unknown>;
};
```

Store metadata and the vendor identifier, not the raw recording, unless storage is necessary for retry or compliance. If raw audio is retained, define encryption, access control, deletion, and retention rules before release.

## Security and abuse controls

- Require explicit consent before recording or upload.
- State that impersonation, fraud, deceptive political content, and cloning without permission are prohibited.
- Keep API keys and cloning calls server-side.
- Authenticate every clone/list/delete route and scope every record to the current user or tenant.
- Apply file type, decoded duration, file size, rate, and quota limits server-side.
- Strip client-supplied vendor URLs; use a server allowlist to prevent SSRF.
- Log creation/deletion events without logging API keys or raw audio.
- Provide user-visible delete controls and document vendor-side retention behavior.
- Add synthetic-audio disclosure or watermark options where the vendor provides them.

## Acceptance test for each provider

1. Record or upload a compliant, consented sample.
2. Create the clone using a test vendor account.
3. Preview it directly through the vendor.
4. Start an Agora agent with the returned identifier in the documented provider field.
5. Confirm that the agent reaches `RUNNING` and publishes audible synthesized speech.
6. Test the same configuration over RTC and telephony; sample-rate and codec requirements can differ.
7. Verify ownership isolation with a second user/tenant.
8. Verify delete behavior in both the Playground database and vendor account.
9. Capture the Agora agent session ID and vendor request ID for failures.

A provider should move to **Direct** in the UI only after all applicable steps pass.

## Primary references

### Agora mappings

- [MiniMax TTS](https://docs.agora.io/en/ai/models/tts/minimax)
- [Cartesia TTS](https://docs.agora.io/en/ai/models/tts/cartesia)
- [ElevenLabs TTS](https://docs.agora.io/en/ai/models/tts/elevenlabs)
- [Fish Audio TTS](https://docs.agora.io/en/ai/models/tts/fish-audio)
- [Google TTS](https://docs.agora.io/en/ai/models/tts/google)
- [Hume AI TTS](https://docs.agora.io/en/ai/models/tts/humeai)
- [Microsoft Azure TTS](https://docs.agora.io/en/ai/models/tts/microsoft)
- [Murf TTS](https://docs.agora.io/en/ai/models/tts/murf)
- [OpenAI TTS](https://docs.agora.io/en/ai/models/tts/openai)
- [Rime TTS](https://docs.agora.io/en/ai/models/tts/rime)
- [Sarvam TTS](https://docs.agora.io/en/ai/models/tts/sarvam)
- [Typecast TTS](https://docs.agora.io/en/ai/models/tts/typecast)
- [xAI TTS](https://docs.agora.io/en/ai/models/tts/xai)

### Vendor cloning APIs and policies

- [MiniMax voice clone](https://platform.minimax.io/docs/api-reference/voice-cloning-clone)
- [MiniMax upload prompt audio](https://platform.minimax.io/docs/api-reference/voice-cloning-uploadprompt)
- [MiniMax file upload](https://platform.minimax.io/docs/api-reference/file-management-upload)
- [ElevenLabs create Instant Voice Clone](https://elevenlabs.io/docs/api-reference/voices/ivc/create)
- [Cartesia clone voice](https://docs.cartesia.ai/api-reference/voices/clone)
- [Fish Audio create model](https://docs.fish.audio/api-reference/endpoint/model/create-model)
- [Gradium create voice](https://docs.gradium.ai/api-reference/endpoint/create-voice)
- [Hume AI voice cloning](https://dev.hume.ai/docs/voice/voice-cloning)
- [Google Instant Custom Voice](https://docs.cloud.google.com/text-to-speech/docs/chirp3-instant-custom-voice)
- [Microsoft Personal Voice](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/personal-voice-overview)
- [Mistral Voxtral TTS](https://docs.mistral.ai/studio/audio/text_to_speech)
- [Murf voice cloning](https://murf.ai/api/docs/voices-styles/voice-cloning)
- [Rime enterprise voice cloning](https://docs.rime.ai/platform/voice-cloning)
- [Sarvam voice cloning](https://docs.sarvam.ai/creative-voice-cloning)
- [Sarvam voice-agent cloning eligibility](https://docs.sarvam.ai/conversations/build/voice-language)
- [Typecast instant cloning](https://typecast.ai/docs/api-reference/voices/instant-cloning)
- [xAI custom voices](https://docs.x.ai/developers/model-capabilities/audio/custom-voices)
- [Amazon Polly custom Brand Voice limitation](https://docs.aws.amazon.com/ai/responsible-ai/amazon-polly/overview.html)
