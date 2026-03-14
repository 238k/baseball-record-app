import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import GameInputError from "./error";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "game-123" }),
}));

describe("GameInputError", () => {
  const error = new Error("test error");
  const reset = vi.fn();

  it("入力画面のエラーメッセージを表示する", () => {
    render(<GameInputError error={error} reset={reset} />);
    expect(
      screen.getByText("入力画面でエラーが発生しました")
    ).toBeInTheDocument();
  });

  it("未保存データに関する注意文言を表示する", () => {
    render(<GameInputError error={error} reset={reset} />);
    expect(
      screen.getByText(/保存済みのデータは失われません/)
    ).toBeInTheDocument();
  });

  it("再試行ボタンで reset を呼び出す", () => {
    render(<GameInputError error={error} reset={reset} />);
    fireEvent.click(screen.getByText("再試行"));
    expect(reset).toHaveBeenCalled();
  });

  it("試合詳細に戻るリンクがある", () => {
    render(<GameInputError error={error} reset={reset} />);
    const link = screen.getByText("試合詳細に戻る").closest("a");
    expect(link).toHaveAttribute("href", "/games/game-123");
  });
});
