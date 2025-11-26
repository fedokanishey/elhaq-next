"use client";

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
    <div className="bg-white rounded-lg shadow-md p-4 sm:p-6 hover:shadow-lg transition-shadow border-r-4 border-blue-500">
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Profile Image */}
        {profileImage && (
          <div className="w-20 h-20 sm:w-24 sm:h-24 flex-shrink-0">
            <img
              src={profileImage}
              alt={name}
              className="w-full h-full object-cover rounded-lg"
            />
          </div>
        )}

        {/* Info */}
        <div className="flex-1">
          <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-2">
            {name}
          </h3>

          <div className="space-y-1 text-sm sm:text-base text-gray-600">
            <p>📱 {phone}</p>
            <p>📍 {address}</p>
            <p>👨‍👩‍👧‍👦 عدد أفراد الأسرة: {familyMembers}</p>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-yellow-500">⭐</span>
              <span className="font-semibold">{priority}/10 الأولوية</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        {!isReadOnly && (
          <div className="flex gap-2 flex-col sm:flex-col justify-end">
            {onEdit && (
              <button
                onClick={onEdit}
                className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
              >
                تعديل
              </button>
            )}
            {onDelete && (
              <button
                onClick={onDelete}
                className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium"
              >
                حذف
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
