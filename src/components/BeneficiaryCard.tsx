"use client";

import { Phone, MapPin, Users, AlertCircle, Edit, Trash2 } from "lucide-react";

interface BeneficiaryCardProps {
  id: string;
  name: string;
  phone: string;
  address: string;
  familyMembers: number;
  priority: number;
  profileImage?: string;
  onEdit?: () => void;
  onDelete?: () => void;
  isReadOnly?: boolean;
}

export default function BeneficiaryCard({
  id,
  name,
  phone,
  address,
  familyMembers,
  priority,
  profileImage,
  onEdit,
  onDelete,
  isReadOnly = false,
}: BeneficiaryCardProps) {
  return (
    <div className="bg-card border border-border rounded-lg shadow-sm p-4 sm:p-6 hover:shadow-md transition-all border-r-4 border-r-primary">
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Profile Image */}
        {profileImage ? (
          <div className="w-20 h-20 sm:w-24 sm:h-24 shrink-0">
            <img
              src={profileImage}
              alt={name}
              className="w-full h-full object-cover rounded-lg bg-muted"
            />
          </div>
        ) : (
          <div className="w-20 h-20 sm:w-24 sm:h-24 shrink-0 bg-primary/10 rounded-lg flex items-center justify-center text-primary font-bold text-2xl">
            {name[0]}
          </div>
        )}

        {/* Info */}
        <div className="flex-1">
          <h3 className="text-lg sm:text-xl font-bold text-foreground mb-2">
            {name}
          </h3>

          <div className="space-y-2 text-sm sm:text-base text-muted-foreground">
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4" />
              <span>{phone}</span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              <span>{address}</span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              <span>{familyMembers} أفراد</span>
            </div>
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              <span>الأولوية: {priority}</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        {!isReadOnly && (
          <div className="flex sm:flex-col gap-2 mt-4 sm:mt-0 justify-end">
            {onEdit && (
              <button
                onClick={onEdit}
                className="flex items-center justify-center px-3 py-2 bg-primary/10 text-primary rounded-md hover:bg-primary/20 transition-colors text-sm font-medium"
              >
                <Edit className="w-4 h-4 ml-1" />
                تعديل
              </button>
            )}
            {onDelete && (
              <button
                onClick={onDelete}
                className="flex items-center justify-center px-3 py-2 bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 rounded-md hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors text-sm font-medium"
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
