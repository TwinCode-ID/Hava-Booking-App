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
} from "lucide-react";

export const NAVIGATION_MENU_ADMIN = [
  { id: "admin-dashboard", name: "Dashboard", icon: LayoutDashboard },
  { id: "studio-activities", name: "Studio Management", icon: FolderKanban },
  { id: "studio-settings", name: "Studio Settings", icon: Cog },
];

export const NAVIGATION_MENU_CLIENT = [
  { id: "client-dashboard", name: "Dashboard", icon: LayoutDashboard },
  { id: "client-activities", name: "Menu", icon: FolderKanban },
];

export const NAVIGATION_MENU_DEV = [
  { id: "development-dashboard", name: "Dashboard", icon: LayoutDashboard },
];
