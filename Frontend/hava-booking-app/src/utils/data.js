import {
  Search,
  Users,
  FileText,
  MessageSquare,
  BarChart3,
  Shield,
  Clock,
  Award,
  Package,
  NotepadText,
  LayoutDashboard,
  Plus,
  House,
} from "lucide-react";

export const NAVIGATION_MENU_ADMIN = [
  { id: "admin-dashboard", name: "Dashboard", icon: LayoutDashboard },
  { id: "manage-booking", name: "Manage Bookings", icon: NotepadText },
  { id: "manage-package", name: "Manage Packages", icon: Package },
  { id: "manage-studio", name: "Manage Studio", icon: House },
];

export const NAVIGATION_MENU_CLIENT = [
  { id: "client-dashboard", name: "Dashboard", icon: LayoutDashboard },
];

export const NAVIGATION_MENU_DEV = [
  { id: "development-dashboard", name: "Dashboard", icon: LayoutDashboard },
];
