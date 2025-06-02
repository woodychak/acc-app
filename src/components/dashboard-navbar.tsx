"use client";

import Link from "next/link";
import { createClient } from "../../supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Button } from "./ui/button";
import {
  UserCircle,
  Home,
  Package2,
  Users,
  FileText,
  CreditCard,
  Globe,
  BarChart3,
  DollarSign,
} from "lucide-react";
import { useRouter, usePathname } from "next/navigation";
import { ThemeSwitcher } from "./theme-switcher";


export default function DashboardNavbar() {
  const supabase = createClient();
  const router = useRouter();
  const pathname = usePathname();

  const navItems = [
    {
      name: "Dashboard",
      href: "/dashboard",
      icon: <Home className="h-5 w-5" />,
    },
    {
      name: "Products",
      href: "/dashboard/products",
      icon: <Package2 className="h-5 w-5" />,
    },
    {
      name: "Customers",
      href: "/dashboard/customers",
      icon: <Users className="h-5 w-5" />,
    },
    {
      name: "Invoices",
      href: "/dashboard/invoices",
      icon: <FileText className="h-5 w-5" />,
    },
    {
      name: "Payments",
      href: "/dashboard/payments",
      icon: <CreditCard className="h-5 w-5" />,
    },
    {
      name: "Currencies",
      href: "/dashboard/currencies",
      icon: <Globe className="h-5 w-5" />,
    },
    {
      name: "Company",
      href: "/dashboard/company-profile",
      icon: <BarChart3 className="h-5 w-5" />,
    },
    {
      name: "Financial Reports",
      href: "/dashboard/reports",
      icon: <BarChart3 className="h-5 w-5" />,
    },
  ];

  return (
    <nav className="w-full border-b border-gray-200 bg-white py-4">
      <div className="container mx-auto px-4 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            prefetch
            className="text-xl font-bold flex items-center"
          >
            <DollarSign className="h-6 w-6 mr-2 text-blue-600" />
            <span>Accounting</span>
          </Link>
        </div>

        <div className="hidden md:flex items-center space-x-1">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname?.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-2 rounded-md text-sm font-medium flex items-center ${
                  isActive
                    ? "bg-gray-100 text-gray-900"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                }`}
              >
                <span className="mr-2">{item.icon}</span>
                {item.name}
              </Link>
            );
          })}
        </div>

        <div className="flex gap-4 items-center">
          <ThemeSwitcher />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <UserCircle className="h-6 w-6" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={async () => {
                  const { error } = await supabase.auth.signOut();
                  if (!error) {
                    router.push("/sign-in"); // 👈 redirect to login
                  } else {
                    console.error("Sign-out error:", error.message);
                  }
                }}
              >
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Mobile navigation */}
      <div className="md:hidden overflow-x-auto flex whitespace-nowrap px-4 py-2 border-t border-gray-100">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname?.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`px-3 py-2 rounded-md text-sm font-medium flex items-center mr-2 ${
                isActive
                  ? "bg-gray-100 text-gray-900"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              <span className="mr-2">{item.icon}</span>
              {item.name}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
