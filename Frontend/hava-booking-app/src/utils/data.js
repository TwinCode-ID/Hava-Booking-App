import {
  Users,
  Package,
  NotepadText,
  LayoutDashboard,
  House,
  FileUser,
  BriefcaseMedical,
} from "lucide-react";

export const NAVIGATION_MENU_ADMIN = [
  { id: "admin-dashboard", name: "Dashboard", icon: LayoutDashboard },
  { id: "manage-bookings", name: "Manage Bookings", icon: NotepadText },
  { id: "manage-packages", name: "Manage Packages", icon: Package },
  { id: "manage-client", name: "Manage Client", icon: FileUser },
  { id: "manage-instructors", name: "Manage Instructors", icon: Users },
  { id: "manage-studio", name: "Manage Studio", icon: House },
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
