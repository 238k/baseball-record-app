"use client";

import { Button } from "@/components/ui/button";

const RESULT_GROUPS = [
  {
    title: "安打系",
    items: [
      { code: "1B", label: "単打" },
      { code: "2B", label: "二塁打" },
      { code: "3B", label: "三塁打" },
      { code: "HR", label: "本塁打" },
    ],
  },
  {
    title: "アウト系",
    items: [
      { code: "GO", label: "ゴロ" },
      { code: "FO", label: "フライ" },
      { code: "LO", label: "ライナー" },
      { code: "K", label: "三振(空)" },
      { code: "KK", label: "三振(見)" },
    ],
  },
  {
    title: "出塁系",
    items: [
      { code: "BB", label: "四球" },
      { code: "IBB", label: "故意四球" },
      { code: "HBP", label: "死球" },
      { code: "E", label: "エラー" },
    ],
  },
  {
    title: "その他",
    items: [
      { code: "SH", label: "犠打" },
      { code: "SF", label: "犠飛" },
      { code: "DP", label: "併殺打" },
      { code: "FC", label: "FC" },
    ],
  },
];

interface AtBatInputProps {
  onSelect: (code: string, label: string) => void;
  disabled?: boolean;
  highlightCode?: string | null;
}

export function AtBatInput({ onSelect, disabled, highlightCode }: AtBatInputProps) {
  return (
    <div className="grid grid-cols-2 gap-4">
      {RESULT_GROUPS.map((group) => (
        <div key={group.title} className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">
            {group.title}
          </h3>
          <div className="space-y-2">
            {group.items.map((item) => {
              const isHighlighted = highlightCode === item.code;
              return (
                <Button
                  key={item.code}
                  size="lg"
                  variant={isHighlighted ? "default" : "outline"}
                  className={`w-full min-h-16 text-lg ${
                    isHighlighted ? "ring-2 ring-primary ring-offset-2" : ""
                  }`}
                  disabled={disabled}
                  onClick={() => onSelect(item.code, item.label)}
                >
                  {item.label}
                </Button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

export { RESULT_GROUPS };
