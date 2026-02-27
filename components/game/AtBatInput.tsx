"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

const RESULT_GROUPS = [
  {
    key: "hit",
    title: "ヒット",
    emoji: "🔴",
    categoryColor: "bg-red-50 border-red-300 text-red-900",
    detailColor: "bg-red-50 border-red-200 text-red-900",
    items: [
      { code: "1B", label: "単打" },
      { code: "2B", label: "二塁打" },
      { code: "3B", label: "三塁打" },
      { code: "HR", label: "本塁打" },
    ],
  },
  {
    key: "out",
    title: "アウト",
    emoji: "🔵",
    categoryColor: "bg-blue-50 border-blue-300 text-blue-900",
    detailColor: "bg-blue-50 border-blue-200 text-blue-900",
    items: [
      { code: "GO", label: "ゴロ" },
      { code: "FO", label: "フライ" },
      { code: "LO", label: "ライナー" },
      { code: "K", label: "三振(空)" },
      { code: "KK", label: "三振(見)" },
      { code: "DP", label: "併殺打" },
    ],
  },
  {
    key: "walk",
    title: "四死球",
    emoji: "🟢",
    categoryColor: "bg-green-50 border-green-300 text-green-900",
    detailColor: "bg-green-50 border-green-200 text-green-900",
    items: [
      { code: "BB", label: "四球" },
      { code: "IBB", label: "故意四球" },
      { code: "HBP", label: "死球" },
    ],
  },
  {
    key: "other",
    title: "その他",
    emoji: "🟠",
    categoryColor: "bg-orange-50 border-orange-300 text-orange-900",
    detailColor: "bg-orange-50 border-orange-200 text-orange-900",
    items: [
      { code: "E", label: "エラー" },
      { code: "SH", label: "犠打" },
      { code: "SF", label: "犠飛" },
      { code: "FC", label: "FC" },
    ],
  },
];

interface AtBatInputProps {
  onSelect: (code: string, label: string) => void;
  disabled?: boolean;
  highlightCode?: string | null;
}

function findCategoryForCode(code: string) {
  return RESULT_GROUPS.find((g) => g.items.some((i) => i.code === code));
}

export function AtBatInput({
  onSelect,
  disabled,
  highlightCode,
}: AtBatInputProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const highlightCategory = highlightCode
    ? findCategoryForCode(highlightCode)
    : null;

  const activeGroup = RESULT_GROUPS.find((g) => g.key === selectedCategory);

  if (activeGroup) {
    return (
      <div className="space-y-3">
        <button
          type="button"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => setSelectedCategory(null)}
        >
          <ArrowLeft className="h-4 w-4" />
          戻る
        </button>
        <h3 className="text-base font-medium">
          {activeGroup.emoji} {activeGroup.title}
        </h3>
        <div className="grid grid-cols-2 gap-3">
          {activeGroup.items.map((item) => {
            const isHighlighted = highlightCode === item.code;
            return (
              <Button
                key={item.code}
                size="lg"
                variant="outline"
                className={`min-h-16 text-lg border-2 ${activeGroup.detailColor} ${
                  isHighlighted ? "ring-2 ring-primary ring-offset-2" : ""
                }`}
                disabled={disabled}
                onClick={() => {
                  onSelect(item.code, item.label);
                  setSelectedCategory(null);
                }}
              >
                {item.label}
              </Button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      {RESULT_GROUPS.map((group) => {
        const isHighlighted = highlightCategory?.key === group.key;
        return (
          <Button
            key={group.key}
            size="lg"
            variant={isHighlighted ? "default" : "outline"}
            className={`min-h-20 text-lg border-2 ${
              isHighlighted
                ? "ring-2 ring-primary ring-offset-2"
                : group.categoryColor
            }`}
            disabled={disabled}
            onClick={() => setSelectedCategory(group.key)}
          >
            <span className="flex flex-col items-center gap-1">
              <span>{group.emoji}</span>
              <span>{group.title}</span>
            </span>
          </Button>
        );
      })}
    </div>
  );
}

export { RESULT_GROUPS };
