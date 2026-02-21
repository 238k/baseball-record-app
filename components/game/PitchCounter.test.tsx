import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PitchCounter, countFromLog } from "./PitchCounter";

describe("countFromLog", () => {
  it("counts balls", () => {
    expect(countFromLog(["ball", "ball", "ball"])).toEqual({
      balls: 3,
      strikes: 0,
      fouls: 0,
    });
  });

  it("counts swinging strikes", () => {
    expect(countFromLog(["swinging", "swinging"])).toEqual({
      balls: 0,
      strikes: 2,
      fouls: 0,
    });
  });

  it("counts looking strikes", () => {
    expect(countFromLog(["looking", "looking"])).toEqual({
      balls: 0,
      strikes: 2,
      fouls: 0,
    });
  });

  it("counts mixed swinging and looking", () => {
    expect(countFromLog(["swinging", "looking", "swinging"])).toEqual({
      balls: 0,
      strikes: 3,
      fouls: 0,
    });
  });

  it("counts fouls as strikes until 2", () => {
    expect(countFromLog(["foul", "foul", "foul"])).toEqual({
      balls: 0,
      strikes: 2,
      fouls: 3,
    });
  });

  it("foul after 2 strikes does not increment strikes", () => {
    expect(countFromLog(["swinging", "looking", "foul"])).toEqual({
      balls: 0,
      strikes: 2,
      fouls: 1,
    });
  });

  it("handles mixed sequence", () => {
    expect(
      countFromLog(["ball", "swinging", "foul", "ball", "looking"])
    ).toEqual({
      balls: 2,
      strikes: 3,
      fouls: 1,
    });
  });

  it("returns zeros for empty log", () => {
    expect(countFromLog([])).toEqual({ balls: 0, strikes: 0, fouls: 0 });
  });
});

describe("PitchCounter", () => {
  it("renders 4 pitch buttons", () => {
    render(
      <PitchCounter pitchLog={[]} onPitch={vi.fn()} onUndo={vi.fn()} />
    );
    expect(screen.getByText("ボール")).toBeInTheDocument();
    expect(screen.getByText("空振り")).toBeInTheDocument();
    expect(screen.getByText("見逃し")).toBeInTheDocument();
    expect(screen.getByText("ファウル")).toBeInTheDocument();
  });

  it("calls onPitch with correct result", () => {
    const onPitch = vi.fn();
    render(
      <PitchCounter pitchLog={[]} onPitch={onPitch} onUndo={vi.fn()} />
    );

    fireEvent.click(screen.getByText("空振り"));
    expect(onPitch).toHaveBeenCalledWith("swinging");

    fireEvent.click(screen.getByText("見逃し"));
    expect(onPitch).toHaveBeenCalledWith("looking");

    fireEvent.click(screen.getByText("ボール"));
    expect(onPitch).toHaveBeenCalledWith("ball");

    fireEvent.click(screen.getByText("ファウル"));
    expect(onPitch).toHaveBeenCalledWith("foul");
  });

  it("disables pitch buttons when count is full (3 strikes)", () => {
    render(
      <PitchCounter
        pitchLog={["swinging", "looking", "swinging"]}
        onPitch={vi.fn()}
        onUndo={vi.fn()}
      />
    );
    expect(screen.getByText("ボール")).toBeDisabled();
    expect(screen.getByText("空振り")).toBeDisabled();
    expect(screen.getByText("見逃し")).toBeDisabled();
    expect(screen.getByText("ファウル")).toBeDisabled();
  });

  it("disables pitch buttons when count is full (4 balls)", () => {
    render(
      <PitchCounter
        pitchLog={["ball", "ball", "ball", "ball"]}
        onPitch={vi.fn()}
        onUndo={vi.fn()}
      />
    );
    expect(screen.getByText("ボール")).toBeDisabled();
  });

  it("displays pitch count", () => {
    render(
      <PitchCounter
        pitchLog={["ball", "swinging", "foul"]}
        onPitch={vi.fn()}
        onUndo={vi.fn()}
      />
    );
    expect(screen.getByText("3球")).toBeInTheDocument();
  });

  it("undo button is disabled when no pitches", () => {
    render(
      <PitchCounter pitchLog={[]} onPitch={vi.fn()} onUndo={vi.fn()} />
    );
    // The undo button contains an SVG icon, find by role
    const buttons = screen.getAllByRole("button");
    const undoButton = buttons[buttons.length - 1];
    expect(undoButton).toBeDisabled();
  });

  it("undo button calls onUndo when clicked", () => {
    const onUndo = vi.fn();
    render(
      <PitchCounter
        pitchLog={["ball"]}
        onPitch={vi.fn()}
        onUndo={onUndo}
      />
    );
    const buttons = screen.getAllByRole("button");
    const undoButton = buttons[buttons.length - 1];
    fireEvent.click(undoButton);
    expect(onUndo).toHaveBeenCalled();
  });
});
