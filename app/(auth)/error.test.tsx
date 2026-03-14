import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import AuthError from "./error";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

describe("AuthError", () => {
  const error = new Error("test error");
  const reset = vi.fn();

  it("認証エラーメッセージを表示する", () => {
    render(<AuthError error={error} reset={reset} />);
    expect(screen.getByText("エラーが発生しました")).toBeInTheDocument();
    expect(
      screen.getByText("認証処理中にエラーが発生しました。再試行してください。")
    ).toBeInTheDocument();
  });

  it("再試行ボタンで reset を呼び出す", () => {
    render(<AuthError error={error} reset={reset} />);
    fireEvent.click(screen.getByText("再試行"));
    expect(reset).toHaveBeenCalled();
  });

  it("ログインページに戻るリンクがある", () => {
    render(<AuthError error={error} reset={reset} />);
    const link = screen.getByText("ログインページに戻る").closest("a");
    expect(link).toHaveAttribute("href", "/login");
  });
});
