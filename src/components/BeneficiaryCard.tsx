"use client";

import { useMemo } from "react";

import {
  MapPin,
  Users,
  AlertCircle,
  Edit,
  Trash2,
  MessageCircle,
  Phone,
} from "lucide-react";
import CloudinaryImage from "./CloudinaryImage";

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
  internalId?: string;
  nationalId?: string;
  maritalStatus?: string;
  spouseName?: string;
  receivesMonthlyAllowance?: boolean;
  monthlyAllowanceAmount?: number;
  listName?: string;
  listNames?: string[];
  status?: string;
  category?: "A" | "B" | "C" | "D";
  loanDetails?: {
    amount: number;
    remainingAmount?: number;
    status: string;
  };
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
  internalId,
  nationalId,
  maritalStatus,
  spouseName,
  receivesMonthlyAllowance,
  monthlyAllowanceAmount,
  listName,
  listNames,
  status,
  category,
  loanDetails,
  onEdit,
  onDelete,
  onView,
  isReadOnly = false,
}: BeneficiaryCardProps) {

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
  const CallLink = useMemo(() => {
    if (!whatsapp) return null;

    let normalized = whatsapp.replace(/\D/g, ""); // إزالة أي شيء ليس رقمًا

    if (!normalized) return null;

    // إذا الرقم يبدأ بـ 00 → صيغة دولية 00
    if (normalized.startsWith("00")) {
      normalized = normalized.slice(2);
    }
    // إذا يبدأ بـ 0 → رقم محلي مصري
    else if (normalized.startsWith("0")) {
      normalized = "+20" + normalized.slice(1);
    }
    // إذا يبدأ بـ 20 فهذا دولي وجاهز

    return `${normalized}`;
  }, [ whatsapp ] );
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
          <CloudinaryImage
            src={image}
            alt={label || fallback || name}
            width="thumbnail"
            height={96}
            layout="thumbnail"
            crop="fill"
            gravity="face"
            quality="auto"
            className="w-full h-full"
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
          {renderAvatar(profileImage, "صورة المستفيد")}
          {renderAvatar(idImage, spouseName ? "صورة الزوج/الزوجة" : undefined, spouseName || undefined)}
        </div>

        <div className="space-y-1">
          <h3 className="text-lg sm:text-xl font-bold text-foreground">{name}</h3>
          {spouseName && (
            <p className="text-sm text-muted-foreground">زوج/زوجة: {spouseName}</p>
          )}
        </div>

        <div className="space-y-2 text-sm sm:text-base text-muted-foreground">
          {internalId && (
            <div className="flex flex-col gap-1 w-full">
              <span>رقم المستفيد الداخلي: {internalId}</span>
              <div className="flex flex-wrap gap-2 mt-1">
                 {/* List Names Badge */}
                 {(listNames && listNames.length > 0 ? listNames : [listName]).filter(Boolean).map((ln, idx) => (
                    <span key={idx} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-secondary text-secondary-foreground">
                       📋 {ln}
                    </span>
                 ))}
                  
                  {/* Category Badge */}
                  {category && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400">
                      فئة {category}
                    </span>
                  )}

                  {/* Status Badge */}
                  {status && (
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      status === 'active' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
                      status === 'pending' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' :
                      status === 'rejected' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' :
                      status === 'cancelled' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' :
                      'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400'
                    }`}>
                      {status === 'active' ? 'نشط' :
                       status === 'pending' ? 'انتظار' :
                       status === 'rejected' ? 'مرفوض' :
                       status === 'needs_research' ? 'يحتاج بحث' :
                       status === 'completed' ? 'مكتمل' :
                       status === 'cancelled' ? 'ملغى' :
                       status}
                    </span>
                  )}

                  {/* Active Loan Badge - Show only if there's remaining amount */}
                 {loanDetails && loanDetails.status === 'active' && (loanDetails.remainingAmount ?? loanDetails.amount) > 0 && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                      🤝 متبقي: {(loanDetails.remainingAmount ?? loanDetails.amount).toLocaleString()} ج.م
                    </span>
                 )}
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <span>{nationalId}</span>

            {CallLink && (
              <a
                href={`tel:${CallLink}`}
                onClick={(e) => handleActionClick(e)}
                className="inline-flex items-center gap-1 rounded-full bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700"
              >
                <Phone className="w-3 h-3" />
                اتصال
              </a>
            )}

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

          {receivesMonthlyAllowance && monthlyAllowanceAmount && (
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-full text-sm font-medium">
                💰 شهرية: {monthlyAllowanceAmount.toLocaleString("ar-EG")} ج.م
              </span>
            </div>
          )}
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
