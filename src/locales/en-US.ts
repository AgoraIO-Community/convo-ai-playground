import type { TeacherLocaleProfile } from "./types";
import { AI_TEACHER_NAME, teacherHostPrompt } from "./shared";
export const englishMessages = {
  brand: { teacher: "AI Teacher", poweredBy: "Powered by Agora Conversational AI" },
  landing: { eyebrow: "The classroom, reimagined", title: "Teach anything.", accent: "Make it visible.", description: "A conversational teacher that listens, explains, and builds the lesson on a living blackboard—one idea at a time.", speak: "Speak naturally", interrupt: "Interrupt anytime", visual: "Visual explanations", capabilities: "AI Teacher capabilities", connecting: "Connecting classroom…", retry: "Try again", signIn: "Sign in with Google to enter the classroom", enter: "Enter the classroom", preview: "Live classroom preview", demonstration: "Live classroom demonstration", drawing: "Drawing now", listen: "Listen", visualize: "Visualize", understand: "Understand" },
  classroom: { title: "AI Teacher classroom", preparing: "Preparing your classroom", connecting: "Connecting your teacher and live blackboard", interrupted: "Connection interrupted", failed: "We couldn't prepare your classroom", retryHint: "Please try joining again.", language: "Classroom language", stopToSwitch: "Stop the teacher before changing language.", live: "live", timeRemaining: "Time remaining in this lesson", cameraError: "Camera could not be disabled for Teacher Mode.", textOnly: "Teacher Mode currently accepts text or spoken questions, not image attachments.", waitForBoard: "Start the agent and wait for the teacher board to be ready." },
  controls: { retry: "Retry", signOut: "Sign out", start: "Start agent", stop: "Stop agent", starting: "Starting…", updating: "Updating…", mute: "Mute microphone", unmute: "Unmute microphone", end: "End lesson", settings: "Settings", teacherMode: "Teacher Mode", joined: "AI agent joined the call", stopped: "AI agent stopped", stopFailed: "Failed to stop AI agent", startFailed: "Failed to start AI agent", notReady: "The call is not ready for the agent yet.", boardNotReady: "Wait for the teacher board to be ready before starting the agent.", micFailed: "Failed to toggle microphone", saved: "Agent settings saved", updated: "Agent configuration updated", restart: "Restart the agent for voice and advanced changes to take effect" },
  stage: { blackboard: "AI Teacher blackboard", preview: "Live lesson preview", connecting: "Connecting teacher", planning: "Planning lesson", writing: "Writing on board", explaining: "Explaining", clarifying: "Answering question", of: "of", paused: "Paused · say continue", interrupted: "Interrupted", unavailable: "Teacher unavailable", error: "Lesson error", prototype: "Prototype lesson", preparing: "Preparing board", offline: "Board offline · voice continues", ready: "Live board ready", local: "Local prototype ready", play: "Play demo lesson", pause: "Pause demo lesson", clear: "Clear blackboard", pip: "AI teacher picture in picture", videoPanel: "AI teacher video panel" },
  avatar: { listening: "Listening", thinking: "Thinking", explaining: "Explaining", paused: "Paused", ready: "Ready", connecting: "Teacher connecting", voiceActive: "Voice remains active", connected: "Connected", voiceTeacher: "Voice teacher", teacher: "AI teacher", video: "avatar video" },
  transcript: { open: "Open transcript and chat", close: "Close transcript and chat", closeDrawer: "Close transcript drawer", dialog: "Live transcript and chat", tab: "Transcript", title: "Live Transcript", transmission: "Transmission", empty: "No transcript available yet.", you: "You", agent: "AI Teacher", chat: "Chat", instruct: "Instruct", message: "Type a message...", chatUnavailable: "Chat is only available in RTM mode", instruction: "Instruction", options: "Options", hideOptions: "Hide options", send: "Send message", renderMode: "Render Mode", auto: "Auto" },
  lesson: { notReady: "Teacher session is not ready.", requestFailed: "Unable to prepare the teacher lesson.", invalid: "Teacher lesson planner returned an invalid response.", ended: "Teacher session ended during the lesson.", boardAck: "The board did not acknowledge the lesson cue." },
  callEnded: { title: "Lesson complete", description: "Your classroom is ready whenever you want to explore another idea.", start: "Start another lesson" },
};
export const enUS: TeacherLocaleProfile = {
  locale: "en-US", htmlLang: "en-US", label: "English", symbol: "🇺🇸",
  metadata: { title: "AI Teacher | Agora", description: "Learn through conversation and visual explanations with Samira." },
  messages: englishMessages,
  agent: {
    systemPrompt: teacherHostPrompt("US English", { stop: "Okay, I'll pause here.", clear: "The board is clear. What would you like to explore next?", topic: "Let me put that on the board and walk you through it.", followUp: "Good question — let's connect that to what is already on the board.", resume: "Let's continue from where we left off." }),
    greeting: `Hi {{username}}, I'm ${AI_TEACHER_NAME}, your AI teacher. Ask me about any topic and I'll explain it visually, step by step. You can interrupt, challenge an idea, or ask follow-up questions at any time.`,
    failureMessage: "I hit a temporary model error while preparing that explanation. Please ask again in a moment.",
  },
  asr: { vendor: "deepgram", model: "nova-3", language: "en-US" },
  lessonDirector: { localeInstruction: "All learner-facing topic, speech, text and labels must use natural US English. Keep code, equations, product names and technical identifiers unchanged. Internal cue_id and element_id must be ASCII. Each spoken cue stays within 450 UTF-8 bytes.", returnPhrase: "Now, let's return to the main idea." },
  intents: {
    resume: /^(continue|go on|please continue|carry on|resume|keep going)$/,
    clear: /\b(clear|reset|erase|wipe)\b.*\b(board|blackboard|canvas)\b|\b(start over|start again)\b.*\b(clean|blank|empty)\b.*\b(board|blackboard|canvas)\b/,
    stop: /^(please\s+)?(stop|pause|hold on|hang on|wait)\b|\b(can|could|would|will) you (please )?(stop|pause|hold on|hang on|wait)\b/,
    negatedStop: /\b(don t|do not|never)\s+(stop|pause)\b/,
    replace: /\b(instead|new topic|change (the )?topic|switch (the )?topic|different topic)\b/,
    unfinished: /^(?:(how|what|why|when|where|who|which)\s+(do|does|did|is|are|was|were|can|could|would|will|should|has|have|had)|(can|could|would|will|should)\s+you)$/,
  },
};
