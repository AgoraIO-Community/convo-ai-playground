import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import TeacherClassroomLoadingScreen from "./TeacherClassroomLoadingScreen";

describe("TeacherClassroomLoadingScreen", () => {
  it("places the preparation status inside the classroom board shell", () => {
    render(<TeacherClassroomLoadingScreen />);

    const board = screen.getByTestId("teacher-classroom-board");
    const status = screen.getByRole("status", {
      name: "Preparando sua sala de aula",
    });

    expect(board).toContainElement(status);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("keeps compact recovery actions on the classroom board", () => {
    const onRetry = vi.fn();
    const onSignOut = vi.fn();

    render(
      <TeacherClassroomLoadingScreen
        errorMessage="The classroom service is temporarily unavailable."
        onRetry={onRetry}
        onSignOut={onSignOut}
      />,
    );

    const board = screen.getByTestId("teacher-classroom-board");
    const alert = screen.getByRole("alert");
    expect(board).toContainElement(alert);

    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    fireEvent.click(screen.getByRole("button", { name: "Sair" }));

    expect(onRetry).toHaveBeenCalledOnce();
    expect(onSignOut).toHaveBeenCalledOnce();
  });
});
