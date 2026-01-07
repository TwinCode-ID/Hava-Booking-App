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
  { id: "purchase-packages", name: "Purchase Packages", icon: Package },
  { id: "manage-packages", name: "Manage Packages", icon: Package },
  { id: "class-booking", name: "Book The Class", icon: FileUser },
  { id: "manage-bookings", name: "Manage Bookings", icon: FileUser },
  { id: "manage-account", name: "Account Setting", icon: Users },
  { id: "medical-records", name: "Medical Records", icon: BriefcaseMedical },
];

export const NAVIGATION_MENU_DEV = [
  { id: "development-dashboard", name: "Dashboard", icon: LayoutDashboard },
];
