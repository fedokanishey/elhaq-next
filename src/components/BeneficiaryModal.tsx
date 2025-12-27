import { useEffect, useMemo, useState } from "react";
import { Loader2, X } from "lucide-react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import BeneficiaryForm from "@/app/admin/beneficiaries/components/BeneficiaryForm";
import BeneficiaryDetailsView from "@/app/admin/beneficiaries/components/BeneficiaryDetailsView";
import { mapBeneficiaryToForm } from "@/app/admin/beneficiaries/utils";

interface BeneficiaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  beneficiaryId?: string; // If present, edit/view mode
  onSuccess: () => void;
  initialMode?: "create" | "edit" | "view";
}

export default function BeneficiaryModal({ 
  isOpen, 
  onClose, 
  beneficiaryId, 
  onSuccess,
  initialMode = "create"
}: BeneficiaryModalProps) {
  const [mode, setMode] = useState<"create" | "edit" | "view">(initialMode);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode, isOpen]);

  // Fetch data if editing/viewing
  const { data, error, isLoading } = useSWR(
    isOpen && beneficiaryId ? `/api/beneficiaries/${beneficiaryId}` : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  const record = data?.beneficiary ?? data;

  const initialValues = useMemo(() => {
    if (!beneficiaryId || mode === "create") return undefined; 
    return mapBeneficiaryToForm(record);
  }, [record, beneficiaryId, mode]);

  // Handle Internal Success
  const handleSuccess = () => {
    onSuccess();
    onClose();
  };

  if (!isOpen) return null;

  const loading = beneficiaryId && isLoading && !record;
  const hasError = beneficiaryId && error;

  const getTitle = () => {
    if (mode === "view") return "تفاصيل المستفيد";
    if (mode === "edit") return "تعديل بيانات المستفيد";
    return "إضافة مستفيد جديد";
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
       {/* Modal Container - Max Width Large for Form */}
      <div className="bg-background rounded-lg shadow-lg w-full max-w-5xl my-8 relative flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-border shrink-0">
          <h2 className="text-xl font-bold">
            {getTitle()}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-full">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto flex-1">
          {loading ? (
             <div className="flex justify-center py-12">
               <Loader2 className="h-8 w-8 animate-spin text-primary" />
             </div>
          ) : hasError ? (
             <div className="text-center py-12 text-destructive">
               فشل تحميل البيانات
             </div>
          ) : mode === "view" && beneficiaryId ? (
            <BeneficiaryDetailsView 
              beneficiaryId={beneficiaryId} 
              isModal={true} 
              onEdit={() => setMode("edit")}
              onClose={onClose}
            />
          ) : (
            <BeneficiaryForm 
              mode={mode === "edit" ? "edit" : "create"}
              beneficiaryId={beneficiaryId}
              initialValues={initialValues}
              onSuccess={handleSuccess}
              onCancel={onClose}
              isModal={true}
            />
          )}
        </div>
      </div>
    </div>
  );
}
