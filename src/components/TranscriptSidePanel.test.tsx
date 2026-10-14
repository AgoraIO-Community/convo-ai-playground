import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ptBR } from "@/locales/pt-BR";
import useAppStore from "@/store/useAppStore";
import TranscriptSidePanel from "./TranscriptSidePanel";
const originalScrollTo = HTMLElement.prototype.scrollTo;
beforeEach(() => { HTMLElement.prototype.scrollTo = vi.fn(); });
afterEach(() => {
  HTMLElement.prototype.scrollTo = originalScrollTo;
  useAppStore.getState().callEnd();
});
it("uses Portuguese for empty transcript and instruction guidance", () => {
  useAppStore.setState({ transcriptItems: [], userSentMessages: [], instructionLog: [], currentInProgressMessage: null, transcriptionMode: "rtm", isAgentActive: true, agentId: "agent-test", agentRtcUid: "100" });
  render(<TranscriptSidePanel isOpen embedded onClose={() => {}} onSendMessage={() => {}} labels={ptBR.messages.transcript} />);
  expect(screen.getByText("Aguardando o início da conversa...")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Orientar" }));
  expect(screen.getByPlaceholderText('Ex.: "Explique de forma mais simples"')).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Opções" }));
  expect(screen.getByText("Ao ouvir")).toBeInTheDocument();
});
