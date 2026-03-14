import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import GameDetailError from "./error";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

describe("GameDetailError", () => {
  const error = new Error("test error");
  const reset = vi.fn();

  it("試合データの読み込みエラーメッセージを表示する", () => {
    render(<GameDetailError error={error} reset={reset} />);
    expect(
      screen.getByText("試合データの読み込みに失敗しました")
    ).toBeInTheDocument();
  });

  it("再試行ボタンで reset を呼び出す", () => {
    render(<GameDetailError error={error} reset={reset} />);
    fireEvent.click(screen.getByText("再試行"));
    expect(reset).toHaveBeenCalled();
  });

  it("試合一覧に戻るリンクがある", () => {
    render(<GameDetailError error={error} reset={reset} />);
    const link = screen.getByText("試合一覧に戻る").closest("a");
    expect(link).toHaveAttribute("href", "/games");
  });
});
