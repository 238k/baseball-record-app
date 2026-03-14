import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import GlobalError from "./global-error";

describe("GlobalError", () => {
  const error = new Error("test error");
  const reset = vi.fn();

  it("エラーメッセージを表示する", () => {
    render(<GlobalError error={error} reset={reset} />);
    expect(screen.getByText("エラーが発生しました")).toBeInTheDocument();
  });

  it("再試行ボタンで reset を呼び出す", () => {
    render(<GlobalError error={error} reset={reset} />);
    fireEvent.click(screen.getByText("再試行"));
    expect(reset).toHaveBeenCalled();
  });

  it("トップに戻るリンクがある", () => {
    render(<GlobalError error={error} reset={reset} />);
    const link = screen.getByText("トップに戻る");
    expect(link).toHaveAttribute("href", "/");
  });
});
