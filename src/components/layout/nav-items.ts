import {
  Bell, BookOpen, ChartPie, Library, Users, UserRound, HandHeart,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: typeof BookOpen;
  exact?: boolean;
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Regal", icon: Library, exact: true },
  { href: "/books", label: "Meine Bücher", icon: BookOpen },
  { href: "/friends", label: "Freunde", icon: Users },
  { href: "/loans", label: "Ausleihen", icon: HandHeart },
  { href: "/stats", label: "Statistiken", icon: ChartPie },
  { href: "/notifications", label: "Benachrichtigungen", icon: Bell },
  { href: "/profile", label: "Profil", icon: UserRound },
];

export const MOBILE_PRIMARY: NavItem[] = [
  { href: "/", label: "Regal", icon: Library, exact: true },
  { href: "/books", label: "Bücher", icon: BookOpen },
  { href: "/friends", label: "Freunde", icon: Users },
];

export function isActive(pathname: string, item: NavItem) {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}
