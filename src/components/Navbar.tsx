"use client";

import { UserButton, useUser } from "@clerk/nextjs";
import Link from "next/link";
import { useState } from "react";

export default function Navbar() {
  const { user } = useUser();
  const [menuOpen, setMenuOpen] = useState(false);

  const isAdmin = user?.publicMetadata?.role === "admin" || user?.unsafeMetadata?.role === "admin";

  return (
    <nav className="sticky top-0 z-50 bg-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <div className="text-2xl font-bold text-blue-600">دعوة الحق</div>
          </Link>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center gap-6">
            {user ? (
              <>
                {isAdmin && (
                  <Link
                    href="/admin/dashboard"
                    className="text-gray-700 hover:text-blue-600 font-medium"
                  >
                    لوحة التحكم
                  </Link>
                )}
                <Link
                  href="/beneficiaries"
                  className="text-gray-700 hover:text-blue-600 font-medium"
                >
                  المستفيدين
                </Link>
                <UserButton afterSignOutUrl="/" />
              </>
            ) : (
              <>
                <Link
                  href="/sign-in"
                  className="px-4 py-2 text-gray-700 hover:text-blue-600"
                >
                  دخول
                </Link>
                <Link
                  href="/sign-up"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  تسجيل
                </Link>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="md:hidden text-2xl"
          >
            ☰
          </button>
        </div>

        {/* Mobile Menu */}
        {menuOpen && (
          <div className="md:hidden pb-4 space-y-2">
            {user ? (
              <>
                {isAdmin && (
                  <Link
                    href="/admin/dashboard"
                    className="block text-gray-700 hover:text-blue-600 font-medium py-2"
                    onClick={() => setMenuOpen(false)}
                  >
                    لوحة التحكم
                  </Link>
                )}
                <Link
                  href="/beneficiaries"
                  className="block text-gray-700 hover:text-blue-600 font-medium py-2"
                  onClick={() => setMenuOpen(false)}
                >
                  المستفيدين
                </Link>
              </>
            ) : (
              <>
                <Link
                  href="/sign-in"
                  className="block text-gray-700 hover:text-blue-600 py-2"
                  onClick={() => setMenuOpen(false)}
                >
                  دخول
                </Link>
                <Link
                  href="/sign-up"
                  className="block text-gray-700 hover:text-blue-600 py-2"
                  onClick={() => setMenuOpen(false)}
                >
                  تسجيل
                </Link>
              </>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}
