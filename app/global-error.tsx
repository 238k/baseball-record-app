"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global error:", error);
  }, [error]);

  return (
    <html lang="ja">
      <body>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "100vh",
            gap: "24px",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="hsl(0, 84%, 60%)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
            <path d="M12 9v4" />
            <path d="M12 17h.01" />
          </svg>
          <div style={{ textAlign: "center" }}>
            <h2 style={{ fontSize: "20px", fontWeight: 600, margin: "0 0 8px" }}>
              エラーが発生しました
            </h2>
            <p style={{ fontSize: "14px", color: "#666", margin: 0 }}>
              予期しないエラーが発生しました。再試行するか、トップページに戻ってください。
            </p>
          </div>
          <div style={{ display: "flex", gap: "12px" }}>
            <button
              onClick={reset}
              style={{
                padding: "10px 20px",
                border: "1px solid #ccc",
                borderRadius: "6px",
                background: "white",
                cursor: "pointer",
                fontSize: "14px",
              }}
            >
              再試行
            </button>
            <a
              href="/"
              style={{
                padding: "10px 20px",
                borderRadius: "6px",
                background: "#171717",
                color: "white",
                textDecoration: "none",
                fontSize: "14px",
              }}
            >
              トップに戻る
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
