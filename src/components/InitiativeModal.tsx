import { useEffect, useMemo, useState } from "react";
import { Loader2, X } from "lucide-react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import InitiativeForm, { InitiativeFormValues } from "@/app/admin/initiatives/components/InitiativeForm";
import InitiativeDetailsView from "@/app/admin/initiatives/components/InitiativeDetailsView";

interface InitiativeModalProps {
  isOpen: boolean;
  onClose: () => void;
  initiativeId?: string; // If present, edit/view mode
  onSuccess: () => void;
  initialMode?: "create" | "edit" | "view";
}

export default function InitiativeModal({ 
  isOpen, 
  onClose, 
  initiativeId, 
  onSuccess,
  initialMode = "create"
}: InitiativeModalProps) {
  const [mode, setMode] = useState<"create" | "edit" | "view">(initialMode);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode, isOpen]);

  // Fetch data if editing/viewing
  // Note: InitiativeForm fetches its own data usually if we don't pass initialValues? 
  // Checking InitiativeForm: it takes initialValues OR loads from API if we assume standard pattern?
  // Actually InitiativeForm logic:
  // It takes initialValues. If not provided, it uses default.
  // It DOES NOT fetch initiative data by ID itself.
  // So we MUST fetch here if we want to Edit.
  
  const { data, error, isLoading } = useSWR(
    isOpen && initiativeId && mode !== "create" ? `/api/initiatives/${initiativeId}` : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  const record = data;

  const initialValues: InitiativeFormValues | undefined = useMemo(() => {
    if (!initiativeId || mode === "create" || !record) return undefined; 
    return {
       name: record.name,
       description: record.description,
       date: record.date ? new Date(record.date).toISOString().split("T")[0] : "",
       totalAmount: record.totalAmount,
       status: record.status,
       images: record.images || [],
       // beneficiaries are handled separately in form via initialBeneficiaryIds
    };
  }, [record, initiativeId, mode]);
  
  const initialBeneficiaryIds = useMemo(() => {
     if (!record?.beneficiaries) return [];
     // eslint-disable-next-line @typescript-eslint/no-explicit-any
     return record.beneficiaries.map((b: any) => b._id || b);
  }, [record]);

  // Handle Internal Success
  const handleSuccess = () => {
    onSuccess();
    onClose();
  };

  if (!isOpen) return null;

  const loading = initiativeId && isLoading && !record && mode !== "create";
  const hasError = initiativeId && error && mode !== "create";

  const getTitle = () => {
    if (mode === "view") return "تفاصيل المبادرة";
    if (mode === "edit") return "تعديل المبادرة";
    return "إضافة مبادرة جديدة";
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
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
          ) : mode === "view" && initiativeId ? (
            <InitiativeDetailsView 
              initiativeId={initiativeId} 
              isModal={true} 
              onEdit={() => setMode("edit")}
              onClose={onClose}
            />
          ) : (
            <InitiativeForm 
              mode={mode === "edit" ? "edit" : "create"}
              initiativeId={initiativeId}
              initialValues={initialValues}
              initialBeneficiaryIds={initialBeneficiaryIds}
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
