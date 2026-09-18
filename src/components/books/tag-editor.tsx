"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Tag as TagIcon, X } from "lucide-react";

import { setTagsAction } from "@/server/actions/books";
import { useToast } from "@/components/ui/toast";

export function TagEditor({
  userBookId,
  tags,
  suggestions = [],
}: {
  userBookId: string;
  tags: string[];
  suggestions?: string[];
}) {
  const [current, setCurrent] = useState(tags);
  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState(false);
  const [, startTransition] = useTransition();
  const { toast } = useToast();
  const router = useRouter();

  const persist = (next: string[]) => {
    setCurrent(next);
    startTransition(async () => {
      const result = await setTagsAction(userBookId, next);
      if (result.ok) router.refresh();
      else toast(result.error, "error");
    });
  };

  const add = (tag: string) => {
    const clean = tag.trim().slice(0, 32);
    setDraft("");
    if (!clean || current.includes(clean)) return;
    persist([...current, clean]);
  };

  const free = suggestions.filter((s) => !current.includes(s)).slice(0, 5);

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {current.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1.5 rounded-full bg-paper-deep/70 px-2.5 py-1 text-xs text-ink dark:bg-white/10"
        >
          <TagIcon size={11} className="text-ink-faint" />
          {tag}
          <button
            type="button"
            onClick={() => persist(current.filter((t) => t !== tag))}
            aria-label={`${tag} entfernen`}
            className="text-ink-faint transition-colors hover:text-clay-600"
          >
            <X size={12} />
          </button>
        </span>
      ))}

      {adding ? (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add(draft);
            }
            if (e.key === "Escape") {
              setDraft("");
              setAdding(false);
            }
          }}
          onBlur={() => {
            if (draft) add(draft);
            setAdding(false);
          }}
          placeholder="neuer Tag"
          className="w-28 rounded-full border border-ink/12 bg-surface px-2.5 py-1 text-xs outline-none focus:border-clay-300 dark:border-white/12 dark:bg-white/5"
        />
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="inline-flex items-center gap-1 rounded-full border border-dashed border-ink/15 px-2.5 py-1 text-xs text-ink-faint transition-colors hover:border-clay-300 hover:text-ink dark:border-white/15"
        >
          <Plus size={11} />
          Tag
        </button>
      )}

      {free.map((suggestion) => (
        <button
          key={suggestion}
          type="button"
          onClick={() => add(suggestion)}
          className="text-xs text-ink-faint underline-offset-2 hover:underline"
        >
          + {suggestion}
        </button>
      ))}
    </div>
  );
}
