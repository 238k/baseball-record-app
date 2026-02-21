"use client";

interface OutCountProps {
  outs: number;
}

export function OutCount({ outs }: OutCountProps) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={`w-5 h-5 rounded-full border-2 ${
              i < outs
                ? "bg-foreground border-foreground"
                : "bg-transparent border-muted-foreground"
            }`}
          />
        ))}
      </div>
      <span className="text-sm text-muted-foreground">アウト</span>
    </div>
  );
}
