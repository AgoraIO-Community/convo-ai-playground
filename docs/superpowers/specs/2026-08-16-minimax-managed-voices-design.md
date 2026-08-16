# MiniMax Managed Voice Selector Design

## Goal

Make Agora-managed MiniMax TTS speak reliably by always sending a documented MiniMax system voice ID, while keeping the settings UI compact for the Playground's English and Hindi use case.

## Voice catalog

Expose six documented MiniMax system voices:

| Language | Label | Voice ID |
| --- | --- | --- |
| English | Captivating Female | `English_captivating_female1` |
| English | Trustworthy Man | `English_Trustworth_Man` |
| English | Expressive Narrator | `English_expressive_narrator` |
| Hindi | Trustworthy Advisor | `hindi_male_1_v2` |
| Hindi | Tranquil Woman | `hindi_female_2_v1` |
| Hindi | News Anchor | `hindi_female_1_v2` |

The default is `English_captivating_female1`, matching Agora's managed-mode example and the working CLI project.

## Settings behavior

When credential mode is Agora managed and the TTS provider is MiniMax, show a required Voice selector below Model. Each label includes the friendly name and language; the stored value is the exact MiniMax voice ID.

Changing between MiniMax managed models preserves the selected voice. Changing to managed MiniMax from another provider uses the default voice. Existing saved MiniMax settings without a voice are normalized to the default so they cannot produce a silent TTS configuration.

Managed OpenAI TTS behavior remains unchanged. BYOK provider controls remain unchanged.

## Request mapping

The join payload uses the current managed-provider structure:

```json
{
  "tts": {
    "credential_mode": "managed",
    "vendor": "minimax",
    "params": {
      "url": "wss://api.minimax.io/ws/v1/t2a_v2",
      "model": "speech-2.6-turbo",
      "voice_setting": {
        "voice_id": "English_captivating_female1"
      }
    }
  }
}
```

Do not use the deprecated `preset` field. Agora-managed credentials stay hidden and no MiniMax API key is requested.

## Validation and testing

Normalization accepts only the six exposed IDs for managed MiniMax. A missing or unknown saved value falls back to the default. Tests cover the provider catalog, default normalization, preservation of a supported voice, fallback from an unsupported voice, and the final join payload shape.

The sidebar provides a link to MiniMax's full system voice catalog for reference, but custom or cloned MiniMax voices are not exposed in Agora-managed mode because they are account-specific.
