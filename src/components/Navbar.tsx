"use client";

import { UserButton, useUser } from "@clerk/nextjs";
import Link from "next/link";
import { useState, useEffect } from "react";
import { Menu, X } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";
import Image from "next/image";

export default function Navbar() {
  const { user, isLoaded } = useUser();
  const [menuOpen, setMenuOpen] = useState(false);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const checkTheme = () => {
      setIsDark(document.documentElement.classList.contains('dark'));
    };
    
    checkTheme();
    
    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });
    
    return () => observer.disconnect();
  }, []);

  const role = user?.publicMetadata?.role || user?.unsafeMetadata?.role;
  const isAdmin = role === "admin";
  const isMember = role === "member";
  const canViewBeneficiaries = isAdmin || isMember;

  const toggleMenu = () => setMenuOpen(!menuOpen);

  return (
    <nav className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between md:flex-row flex-row-reverse">
          {/* Logo */}
          <div className="flex items-center">
            <Link href="/" className="flex items-center gap-2 ">
              <Image 
                src={isDark ? "/logos/3-04-white.png" : "/logos/3-04.png"} 
                alt="دعوة الحق" 
                width={90} 
                height={90}
                quality={100}
                priority
                unoptimized
                className="object-contain w-20 h-20"
              />
            </Link>
          </div>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center gap-6">
            {isLoaded && user ? (
              <>
                {isAdmin && (
                  <Link
                    href="/admin/dashboard"
                    className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
                  >
                    لوحة التحكم
                  </Link>
                )}
                {canViewBeneficiaries && (
                  <Link
                    href="/beneficiaries"
                    className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
                  >
                    المستفيدين
                  </Link>
                )}
                {canViewBeneficiaries && (
                  <Link
                    href="/admin/treasury"
                    className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
                  >
                    الخزينة
                  </Link>
                )}
                {canViewBeneficiaries && (
                  <Link
                    href="/admin/donors"
                    className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
                  >
                    المتبرعين
                  </Link>
                )}
                {canViewBeneficiaries && (
                  <Link
                    href="/admin/loans"
                    className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
                  >
                    القرض الحسن
                  </Link>
                )}
                {canViewBeneficiaries && (
                  <Link
                    href="/admin/warehouse"
                    className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
                  >
                    المخزن
                  </Link>
                )}
                <ThemeToggle />
                <UserButton afterSignOutUrl="/" />
              </>
            ) : (
              <>
                <ThemeToggle />
                <Link
                  href="/sign-in"
                  className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
                >
                  دخول
                </Link>
                <Link
                  href="/sign-up"
                  className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  إنشاء حساب
                </Link>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="flex md:hidden items-center gap-2">
            
            <div className="flex items-center gap-2 bg-blue-500 rounded-3xl pr-1">
              {isLoaded && user && (
                <UserButton afterSignOutUrl="/" />
              )}
              <button
                onClick={toggleMenu}
                className="inline-flex items-center justify-center rounded-md p-2 text-amber-50"
              >
                <span className="sr-only">Open main menu</span>
                {menuOpen ? (
                  <X className="block h-6 w-6" aria-hidden="true" />
                ) : (
                  <Menu className="block h-6 w-6" aria-hidden="true" />
                )}
              </button>
            </div><ThemeToggle />
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {menuOpen && (
        <div className="md:hidden border-t bg-background">
          <div className="space-y-1 px-2 pb-3 pt-2">
            {isLoaded && user ? (
              <>
                {isAdmin && (
                  <Link
                    href="/admin/dashboard"
                    className="block rounded-md px-3 py-2 text-base font-medium text-foreground hover:bg-accent hover:text-accent-foreground"
                    onClick={() => setMenuOpen(false)}
                  >
                    لوحة التحكم
                  </Link>
                )}
                {canViewBeneficiaries && (
                  <Link
                    href="/beneficiaries"
                    className="block rounded-md px-3 py-2 text-base font-medium text-foreground hover:bg-accent hover:text-accent-foreground"
                    onClick={() => setMenuOpen(false)}
                  >
                    المستفيدين
                  </Link>
                )}
                {canViewBeneficiaries && (
                  <Link
                    href="/admin/treasury"
                    className="block rounded-md px-3 py-2 text-base font-medium text-foreground hover:bg-accent hover:text-accent-foreground"
                    onClick={() => setMenuOpen(false)}
                  >
                    الخزينة
                  </Link>
                )}
                {canViewBeneficiaries && (
                  <Link
                    href="/admin/donors"
                    className="block rounded-md px-3 py-2 text-base font-medium text-foreground hover:bg-accent hover:text-accent-foreground"
                    onClick={() => setMenuOpen(false)}
                  >
                    المتبرعين
                  </Link>
                )}
                {canViewBeneficiaries && (
                  <Link
                    href="/admin/loans"
                    className="block rounded-md px-3 py-2 text-base font-medium text-foreground hover:bg-accent hover:text-accent-foreground"
                    onClick={() => setMenuOpen(false)}
                  >
                    القرض الحسن
                  </Link>
                )}
                {canViewBeneficiaries && (
                  <Link
                    href="/admin/warehouse"
                    className="block rounded-md px-3 py-2 text-base font-medium text-foreground hover:bg-accent hover:text-accent-foreground"
                    onClick={() => setMenuOpen(false)}
                  >
                    المخزن
                  </Link>
                )}
              </>
            ) : (
              <>
                <Link
                  href="/sign-in"
                  className="block rounded-md px-3 py-2 text-base font-medium text-foreground hover:bg-accent hover:text-accent-foreground"
                  onClick={() => setMenuOpen(false)}
                >
                  دخول
                </Link>
                <Link
                  href="/sign-up"
                  className="block rounded-md px-3 py-2 text-base font-medium text-foreground hover:bg-accent hover:text-accent-foreground"
                  onClick={() => setMenuOpen(false)}
                >
                  إنشاء حساب
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
