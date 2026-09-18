"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BookOpenCheck, Pencil, Star, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ProgressDialog } from "@/components/books/progress-dialog";
import { EditBookDialog, type GenreOption } from "@/components/books/edit-book-dialog";
import { useToast } from "@/components/ui/toast";
import { deleteUserBookAction, toggleFavoriteAction } from "@/server/actions/books";
import { cn } from "@/lib/cn";
import type { ShelfBook } from "@/server/queries/books";

export function BookActions({ book, genres }: { book: ShelfBook; genres: GenreOption[] }) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [progressOpen, setProgressOpen] = useState(false);
  const [favorite, setFavorite] = useState(book.favorite);
  const [, startTransition] = useTransition();
  const { toast } = useToast();
  const router = useRouter();

  const toggleFavorite = () =>
    startTransition(async () => {
      const result = await toggleFavoriteAction(book.id);
      if (result.ok) {
        setFavorite(result.data.favorite);
        router.refresh();
      } else {
        toast(result.error, "error");
      }
    });

  return (
    <div className="flex flex-wrap gap-2">
      {book.status === "READING" || book.currentPage > 0 ? (
        <Button variant="soft" size="sm" onClick={() => setProgressOpen(true)}>
          <BookOpenCheck size={15} />
          Fortschritt
        </Button>
      ) : null}

      <Button
        variant="soft"
        size="sm"
        onClick={toggleFavorite}
        className={cn(favorite && "bg-honey-100 text-honey-500 dark:bg-honey-400/20 dark:text-honey-200")}
      >
        <Star size={15} fill={favorite ? "currentColor" : "none"} />
        {favorite ? "Favorit" : "Favorit"}
      </Button>

      <Button variant="soft" size="sm" onClick={() => setEditOpen(true)}>
        <Pencil size={15} />
        Bearbeiten
      </Button>

      <Button variant="ghost" size="sm" onClick={() => setDeleteOpen(true)}>
        <Trash2 size={15} />
        Entfernen
      </Button>

      <EditBookDialog open={editOpen} onClose={() => setEditOpen(false)} book={book} genres={genres} />

      <ProgressDialog
        open={progressOpen}
        onClose={() => setProgressOpen(false)}
        userBookId={book.id}
        title={book.title}
        pageCount={book.pageCount}
        currentPage={book.currentPage}
      />

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Buch aus dem Regal nehmen?"
        description={
          <>
            „{book.title}“ wird mit allen Notizen, Antworten, Moodboards und Zeichnungen entfernt.
            Die Ausleihhistorie geht dabei ebenfalls verloren.
          </>
        }
        confirmLabel="Endgültig entfernen"
        tone="danger"
        onConfirm={async () => {
          const result = await deleteUserBookAction(book.id);
          if (result.ok) {
            toast("Buch entfernt");
            router.push("/books");
            router.refresh();
          } else {
            toast(result.error, "error");
          }
        }}
      />
    </div>
  );
}
