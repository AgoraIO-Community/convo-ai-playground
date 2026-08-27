# Outbound Telephony Design

## Purpose

Add a simple one-off outbound telephone call flow to ConvoAI Playground. The call uses the agent configuration currently selected in the Playground and an imported Agora telephony phone-number record. It does not require an Agora Studio pipeline ID or a Studio-managed agent.

## Scope

The first release supports one outbound call at a time from a new **Telephony** tab in the existing Settings sidebar. The user enters the destination number, optionally adjusts call limits, and starts the call. Agora resolves the configured SIP trunk from the server-side phone-number ID.

Inbound agent binding, campaigns, bulk dialing, call history, live call polling, transfer controls, avatars, and browser participation in the telephone call are outside this release.

## Configuration

The integration reuses the existing server-only values:

- `AGORA_CUSTOMER_ID`
- `AGORA_CUSTOMER_SECRET`
- `NEXT_PUBLIC_AGORA_APP_ID`

It adds:

- `AGENT_STUDIO_V2_BASE_URL="https://api.agora.io/conversational-ai"`
- `AGORA_TELEPHONY_PHONE_NUMBER_ID="851"`

The phone number is first imported and configured in Agora Console. Its `number_id` is retrieved with `GET {AGENT_STUDIO_V2_BASE_URL}/v2/phone-numbers?page=1&page_size=100`. SIP host, username, password, transport, caller number, and provider are not duplicated in the Playground.

## Architecture

### Browser

`TelephonySettings` is a focused component rendered as a fourth Settings tab. It reads the current `AgentSettings` and local username from the Zustand store. It sends only the destination number, call options, and current agent settings to the app's own API route.

The browser never receives Agora customer credentials, a generated Basic authorization value, SIP credentials, or provider keys injected from server environment variables.

### Next.js server

`POST /api/telephony/outbound` requires an authenticated Auth.js session. It validates the request, resolves all required environment variables, generates a UUID call ID, prepares the current agent properties with the same normalization and provider-key injection used by browser-to-agent calls, and calls:

`POST {AGENT_STUDIO_V2_BASE_URL}/v2/outbound-dial/{appId}`

The upstream request uses `Authorization: Basic <base64(customerId:customerSecret)>`. The authorization value and all provider credentials are masked from logs and responses.

The upstream body is:

```json
{
  "phone_num_id": 851,
  "to_number": "+919999999999",
  "call_id": "generated-uuid",
  "max_duration_seconds": 300,
  "max_silence_duration_ms": 60000,
  "max_ring_duration_ms": 30000,
  "idle_timeout": 120,
  "enable_recording": false,
  "properties": {
    "llm": {},
    "tts": {},
    "asr": {},
    "advanced_features": {},
    "parameters": {}
  }
}
```

Neither `pipeline_id` nor `external_agent_id` is included. Supplying the full `properties` object makes the call independent of a Studio pipeline.

### Shared agent-property preparation

The current invite route contains server credential injection and provider normalization inline. That logic must be extracted into a server-only module and used by both the existing invite route and the new telephony route. This prevents telephone calls from behaving differently for managed providers, BYOK providers, MCP servers, MLLM, or future configuration migrations. Avatar configuration is omitted because an outbound telephone call is audio-only and the telephony gateway, rather than the browser call flow, owns its RTC runtime.

Telephone properties omit RTC runtime values that the outbound gateway owns, including `channel`, `token`, `agent_rtc_uid`, and `remote_rtc_uids`. The outbound gateway creates the telephone session runtime.

## User interface

The Settings tab bar adds **Telephony** with a phone icon. The tab contains:

- A read-only indication that caller configuration is loaded from phone-number ID `851` on the server.
- A required destination number in E.164 format.
- An optional recording toggle, default off.
- Maximum call duration in seconds, default `300`.
- Silence timeout in milliseconds, default `60000`.
- Ring timeout in milliseconds, default `30000`.
- Idle timeout in seconds, default `120`.
- A **Make outbound call** button.
- A success panel containing the returned call ID and upstream status, or an actionable error message.

SIP credentials and the Basic authorization value are never displayed. Telephone options are transient in the first release and are not added to persisted `AgentSettings`.

## Validation and errors

- Destination numbers must match E.164: a leading `+` followed by 8–15 digits.
- Durations must be finite positive integers within server-defined limits.
- Missing session returns `401`.
- Missing or malformed environment configuration returns a safe `500` response naming only the missing variable.
- Upstream non-success responses preserve the upstream HTTP status where practical and return a safe message plus non-secret Agora details.
- Network failures return `502`.
- The UI disables duplicate submissions while a request is running.

## Testing

Route tests cover authentication, E.164 validation, numeric option validation, missing environment variables, Basic auth construction, use of phone-number ID `851`, omission of pipeline fields, full properties forwarding, successful response mapping, upstream errors, and secret masking.

Component tests cover the Telephony tab, default option values, invalid destination handling, disabled/loading state, successful submission, and visible error feedback. Existing invite-route tests ensure extracting shared server preparation produces no regression.

The complete Vitest suite and production build must pass before the feature is considered complete. A real outbound call is a separate manual verification because it creates an external telephone call.

## Security

- Agora and SIP credentials, plus provider credentials sourced from environment variables, remain server-side. Existing user-entered custom provider or MCP values retain the Playground's current storage behavior.
- No credential-bearing object is returned to the browser.
- Logging uses recursive masking for `authorization`, `api_key`, `key`, `password`, tokens, and secret-like property names.
- The route accepts only the documented request fields and reconstructs the upstream payload instead of forwarding arbitrary browser JSON.
