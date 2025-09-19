"use client";

import Link from "next/link";
import { createClient } from "../../supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "./ui/dropdown-menu";
import { Button } from "./ui/button";
import {
  UserCircle,
  Home,
  Package2,
  Users,
  FileText,
  CreditCard,
  BarChart3,
  Receipt,
  FileCheck,
  Building2,
  Coins,
} from "lucide-react";
import { useRouter, usePathname } from "next/navigation";
import { ThemeSwitcher } from "./theme-switcher";
import Image from "next/image";

export default function DashboardNavbar() {
  const supabase = createClient();
  const router = useRouter();
  const pathname = usePathname();

  const navItems = [
    {
      name: "Dashboard",
      href: "/dashboard",
      icon: <Home className="h-4 w-4" />,
    },
    {
      name: "Products",
      href: "/dashboard/products",
      icon: <Package2 className="h-4 w-4" />,
    },
    {
      name: "Customers",
      href: "/dashboard/customers",
      icon: <Users className="h-4 w-4" />,
    },
    {
      name: "Quotations",
      href: "/dashboard/quotations",
      icon: <FileCheck className="h-4 w-4" />,
    },
    {
      name: "Invoices",
      href: "/dashboard/invoices",
      icon: <FileText className="h-4 w-4" />,
    },
    {
      name: "Payments",
      href: "/dashboard/payments",
      icon: <CreditCard className="h-4 w-4" />,
    },
    {
      name: "Expenses",
      href: "/dashboard/expenses",
      icon: <Receipt className="h-4 w-4" />,
    },
    {
      name: "Reports",
      href: "/dashboard/reports",
      icon: <BarChart3 className="h-4 w-4" />,
    },
  ];

  return (
    <nav className="w-full border-b bg-background py-3">
      <div className="container mx-auto px-4 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            prefetch
            className="text-lg font-bold flex items-center gap-2 text-foreground"
          >
             <Image
                      src="/zenit_logo.png"
                      alt="Zenit Logo"
                      width={100}
                      height={32}
                      className="h-8 w-auto object-contain"
                    />
            <span className="hidden sm:inline">Accounting</span>
          </Link>
        </div>

        <div className="hidden lg:flex items-center space-x-1">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname?.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`px-2 py-1.5 rounded-md text-sm font-medium flex items-center gap-1.5 transition-colors ${
                  isActive
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground"
                }`}
              >
                {item.icon}
                <span className="hidden xl:inline">{item.name}</span>
              </Link>
            );
          })}
        </div>

        <div className="flex gap-2 items-center">
          <ThemeSwitcher />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <UserCircle className="h-6 w-6" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem asChild>
                <Link href="/dashboard/company-profile" className="flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Company Profile
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/dashboard/currencies" className="flex items-center gap-2">
                  <Coins className="h-4 w-4" />
                  Currency Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={async () => {
                  await supabase.auth.signOut();
                  router.push('/sign-in');
                }}
                className="text-destructive focus:text-destructive"
              >
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Mobile navigation */}
      <div className="lg:hidden overflow-x-auto flex whitespace-nowrap px-4 py-2 border-t gap-1">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname?.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`px-3 py-2 rounded-md text-sm font-medium flex items-center gap-2 flex-shrink-0 transition-colors ${
                isActive
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground"
              }`}
            >
              {item.icon}
              <span className="text-xs">{item.name}</span>
            </Link>
          );
        })}
        {/* Company Profile in mobile menu */}
        <Link
          href="/dashboard/company-profile"
          className={`px-3 py-2 rounded-md text-sm font-medium flex items-center gap-2 flex-shrink-0 transition-colors ${
            pathname === "/dashboard/company-profile"
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground"
          }`}
        >
          <Building2 className="h-4 w-4" />
          <span className="text-xs">Company</span>
        </Link>
      </div>
    </nav>
  );
}