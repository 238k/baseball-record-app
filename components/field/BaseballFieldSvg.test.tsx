import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { BaseballFieldSvg } from "./BaseballFieldSvg";

describe("BaseballFieldSvg", () => {
  it("renders the SVG field with all elements in full variant", () => {
    render(<BaseballFieldSvg />);

    expect(screen.getByTestId("baseball-field-svg")).toBeInTheDocument();
    expect(screen.getByTestId("outfield-grass")).toBeInTheDocument();
    expect(screen.getByTestId("infield-diamond")).toBeInTheDocument();
    expect(screen.getByTestId("base-first")).toBeInTheDocument();
    expect(screen.getByTestId("base-second")).toBeInTheDocument();
    expect(screen.getByTestId("base-third")).toBeInTheDocument();
    expect(screen.getByTestId("home-plate")).toBeInTheDocument();
    expect(screen.getByTestId("pitchers-mound")).toBeInTheDocument();
  });

  it("hides outfield grass and mound in diamond variant", () => {
    render(<BaseballFieldSvg variant="diamond" />);

    expect(screen.getByTestId("baseball-field-svg")).toBeInTheDocument();
    expect(screen.queryByTestId("outfield-grass")).not.toBeInTheDocument();
    expect(screen.queryByTestId("pitchers-mound")).not.toBeInTheDocument();
    expect(screen.getByTestId("infield-diamond")).toBeInTheDocument();
  });

  it("renders children as overlay", () => {
    render(
      <BaseballFieldSvg>
        <circle data-testid="overlay-element" cx={100} cy={100} r={10} />
      </BaseballFieldSvg>
    );

    expect(screen.getByTestId("overlay-element")).toBeInTheDocument();
  });

  it("applies className to SVG element", () => {
    render(<BaseballFieldSvg className="w-full max-w-sm" />);

    const svg = screen.getByTestId("baseball-field-svg");
    expect(svg).toHaveClass("w-full", "max-w-sm");
  });

  it("has accessible role and label", () => {
    render(<BaseballFieldSvg />);

    const svg = screen.getByRole("img", { name: "野球フィールド" });
    expect(svg).toBeInTheDocument();
  });
});
