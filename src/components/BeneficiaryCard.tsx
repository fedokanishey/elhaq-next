"use client";

import { useMemo } from "react";

import {
  Phone,
  MapPin,
  Users,
  AlertCircle,
  Edit,
  Trash2,
  MessageCircle,
  Hash,
} from "lucide-react";

interface BeneficiaryCardProps {
  id: string;
  name: string;
  phone: string;
  whatsapp?: string;
  address: string;
  familyMembers: number;
  priority: number;
  profileImage?: string;
  idImage?: string;
  nationalId?: string;
  maritalStatus?: string;
  spouseName?: string;
  onEdit?: () => void;
  onDelete?: () => void;
  onView?: () => void;
  isReadOnly?: boolean;
}

export default function BeneficiaryCard({
  name,
  phone,
  whatsapp,
  address,
  familyMembers,
  priority,
  profileImage,
  idImage,
  nationalId,
  maritalStatus,
  spouseName,
  onEdit,
  onDelete,
  onView,
  isReadOnly = false,
}: BeneficiaryCardProps) {

  // ==============================
  // ⭐ تعديل الواتساب هنا
  // ==============================
  const whatsappLink = useMemo(() => {
    if (!whatsapp) return null;

    let normalized = whatsapp.replace(/\D/g, ""); // إزالة أي شيء ليس رقمًا

    if (!normalized) return null;

    // إذا الرقم يبدأ بـ 00 → صيغة دولية 00
    if (normalized.startsWith("00")) {
      normalized = normalized.slice(2);
    }
    // إذا يبدأ بـ 0 → رقم محلي مصري
    else if (normalized.startsWith("0")) {
      normalized = "20" + normalized.slice(1);
    }
    // إذا يبدأ بـ 20 فهذا دولي وجاهز

    return `https://wa.me/${normalized}`;
  }, [whatsapp]);
  // ==============================

  const handleActionClick = (
    e: React.MouseEvent<HTMLButtonElement | HTMLAnchorElement>,
    action?: () => void
  ) => {
    e.stopPropagation();
    action?.();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!onView) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onView();
    }
  };

  const clickableProps = onView
    ? {
        role: "button" as const,
        tabIndex: 0,
        onClick: onView,
        onKeyDown: handleKeyDown,
      }
    : {};

  const renderAvatar = (image?: string, label?: string, fallback?: string) => (
    <div className="flex flex-col items-center gap-1">
      <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-lg overflow-hidden border border-border bg-muted">
        {image ? (
          <img
            src={image}
            alt={label || fallback || name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-primary font-semibold text-xl">
            {fallback || name.charAt(0)}
          </div>
        )}
      </div>
      {label && <span className="text-xs text-muted-foreground">{label}</span>}
    </div>
  );

  return (
    <div
      {...clickableProps}
      className={`bg-card border border-border rounded-lg shadow-sm p-4 sm:p-6 hover:shadow-md transition-all border-r-4 border-r-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
        onView ? "cursor-pointer" : ""
      }`}
    >
      <div className="flex flex-col gap-4">
        <div className="flex justify-between gap-4 flex-row-reverse">
          {renderAvatar(profileImage, "صورة الزوج")}
          {renderAvatar(idImage, "صورة الزوجة", spouseName || "الزوجة")}
        </div>

        <div className="space-y-1">
          <h3 className="text-lg sm:text-xl font-bold text-foreground">{name}</h3>
          {spouseName && (
            <p className="text-sm text-muted-foreground">زوج/زوجة: {spouseName}</p>
          )}
        </div>

        <div className="space-y-2 text-sm sm:text-base text-muted-foreground">
          {nationalId && (
            <div className="flex items-center gap-2">
              <Hash className="w-4 h-4" />
              <span>رقم المستفيد: {nationalId}</span>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Phone className="w-4 h-4" />
            <span>{phone}</span>

            {whatsappLink && (
              <a
                href={whatsappLink}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => handleActionClick(e)}
                className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-700"
              >
                <MessageCircle className="w-3 h-3" />
                واتساب
              </a>
            )}
          </div>

          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            <span>{address}</span>
          </div>

          <div className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            <span>{familyMembers} أفراد</span>
          </div>

          {maritalStatus && (
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              <span>الحالة الاجتماعية: {translateMaritalStatus(maritalStatus)}</span>
            </div>
          )}

          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            <span>الأولوية: {priority}</span>
          </div>
        </div>

        {!isReadOnly && (
          <div className="flex flex-col sm:flex-row gap-2">
            {onEdit && (
              <button
                onClick={(e) => handleActionClick(e, onEdit)}
                className="flex-1 flex items-center justify-center px-3 py-2 bg-primary/10 text-primary rounded-md hover:bg-primary/20 transition-colors text-sm font-medium"
              >
                <Edit className="w-4 h-4 ml-1" />
                تعديل
              </button>
            )}

            {onDelete && (
              <button
                onClick={(e) => handleActionClick(e, onDelete)}
                className="flex-1 flex items-center justify-center px-3 py-2 bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 rounded-md hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors text-sm font-medium"
              >
                <Trash2 className="w-4 h-4 ml-1" />
                حذف
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function translateMaritalStatus(status?: string) {
  switch (status) {
    case "married":
      return "متزوج";
    case "divorced":
      return "مطلق";
    case "widowed":
      return "أرمل";
    case "single":
      return "أعزب";
    default:
      return "غير محدد";
  }
}
