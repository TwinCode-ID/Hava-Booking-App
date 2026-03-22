import {
  Users,
  Package,
  NotepadText,
  LayoutDashboard,
  House,
  FileUser,
  BriefcaseMedical,
  Cog,
  LayoutList,
  FolderKanban,
  MessageCircle,
} from "lucide-react";

export const NAVIGATION_MENU_ADMIN = [
  { id: "admin-dashboard", name: "Dashboard", icon: LayoutDashboard },
  { id: "studio-activities", name: "Studio Management", icon: FolderKanban },
  { id: "admin-inbox", name: "Message", icon: MessageCircle },
  { id: "studio-settings", name: "Studio Settings", icon: Cog },
];

export const NAVIGATION_MENU_CLIENT = [
  { id: "client-dashboard", name: "Dashboard", icon: LayoutDashboard },
  { id: "client-activities", name: "Menu", icon: FolderKanban },
  { id: "client-inbox", name: "Message", icon: MessageCircle },
];

export const NAVIGATION_MENU_DEV = [
  { id: "development-dashboard", name: "Dashboard", icon: LayoutDashboard },
];
