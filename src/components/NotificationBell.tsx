"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import { Bell, CheckCheck, Loader2 } from "lucide-react";
import { useUser } from "@clerk/nextjs";
import { fetcher } from "@/lib/fetcher";
import { useBranchContext } from "@/contexts/BranchContext";

interface NotificationItem {
  _id: string;
  actionType: string;
  message: string;
  actorName: string;
  isRead: boolean;
  createdAt: string;
}

interface NotificationResponse {
  notifications: NotificationItem[];
  unreadCount: number;
}

const ACTION_LABELS: Record<string, string> = {
  beneficiary_created: "إضافة مستفيد",
  beneficiary_updated: "تعديل مستفيد",
  initiative_created: "إضافة مبادرة",
  initiative_updated: "تحديث مبادرة",
  treasury_income_created: "عملية وارد",
  treasury_expense_created: "عملية مصروف",
  loan_disbursed: "صرف قرض",
  loan_repayment_created: "سداد قرض",
  warehouse_movement_in: "حركة مخزن وارد",
  warehouse_movement_out: "حركة مخزن صادر",
};

function formatTimestamp(value: string) {
  const date = new Date(value);
  return new Intl.DateTimeFormat("ar-EG", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default function NotificationBell() {
  const { user, isLoaded } = useUser();
  const { selectedBranchId, isSuperAdmin } = useBranchContext();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const role = user?.publicMetadata?.role || user?.unsafeMetadata?.role;
  const canViewNotifications = role === "member" || role === "admin" || role === "superadmin";

  const branchQuery = useMemo(() => {
    if (isSuperAdmin && selectedBranchId) {
      return `&branchId=${selectedBranchId}`;
    }
    return "";
  }, [isSuperAdmin, selectedBranchId]);

  const notificationsKey =
    isLoaded && canViewNotifications ? `/api/notifications?limit=20${branchQuery}` : null;

  const { data, isLoading, mutate } = useSWR<NotificationResponse>(
    notificationsKey,
    fetcher,
    {
      refreshInterval: 10000,
      revalidateOnFocus: true,
    }
  );

  const notifications = data?.notifications || [];
  const unreadCount = data?.unreadCount || 0;

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (!dropdownRef.current) return;
      if (!dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const markOneAsRead = async (notificationId: string) => {
    const suffix = isSuperAdmin && selectedBranchId ? `?branchId=${selectedBranchId}` : "";
    await fetch(`/api/notifications/${notificationId}${suffix}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isRead: true }),
    });
    await mutate();
  };

  const markAllAsRead = async () => {
    if (!notificationsKey) return;
    await fetch(`/api/notifications${notificationsKey.includes("?") ? notificationsKey.slice(notificationsKey.indexOf("?")) : ""}`, {
      method: "PATCH",
    });
    await mutate();
  };

  if (!canViewNotifications) {
    return null;
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="relative inline-flex items-center justify-center w-10 h-10 rounded-full border border-border bg-background hover:bg-muted transition-colors"
        title="مركز الإشعارات"
        aria-label="مركز الإشعارات"
      >
        <Bell className="w-5 h-5 text-foreground" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-600 text-white text-[10px] leading-[18px] text-center font-semibold">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-2 w-[min(92vw,380px)] max-h-[70vh] overflow-hidden rounded-xl border border-border bg-card shadow-xl z-[60]">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h3 className="font-semibold text-foreground">الإشعارات</h3>
            <button
              type="button"
              onClick={markAllAsRead}
              className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80"
            >
              <CheckCheck className="w-4 h-4" />
              تعليم الكل كمقروء
            </button>
          </div>

          <div className="max-h-[60vh] overflow-y-auto">
            {isLoading ? (
              <div className="px-4 py-8 flex items-center justify-center text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin ml-2" />
                جاري تحميل الإشعارات...
              </div>
            ) : notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                لا توجد إشعارات حالياً.
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {notifications.map((notification) => (
                  <li key={notification._id}>
                    <button
                      type="button"
                      onClick={() => {
                        if (!notification.isRead) {
                          void markOneAsRead(notification._id);
                        }
                      }}
                      className={`w-full text-right px-4 py-3 hover:bg-muted/60 transition-colors ${
                        notification.isRead ? "" : "bg-primary/5"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                          {ACTION_LABELS[notification.actionType] || "نشاط"}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatTimestamp(notification.createdAt)}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-foreground leading-relaxed">
                        {notification.message}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        بواسطة: {notification.actorName}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
