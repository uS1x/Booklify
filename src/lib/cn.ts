type ClassValue = string | false | null | undefined;

/** Kleiner Klassen-Joiner – bewusst ohne zusätzliche Dependency. */
export function cn(...classes: ClassValue[]) {
  return classes.filter(Boolean).join(" ");
}
