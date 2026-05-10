"use client";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { useBranchContext } from "@/contexts/BranchContext";
import {
  HardDrive,
  Download,
  Loader2,
  CheckCircle2,
  XCircle,
  Shield,
  Building2,
} from "lucide-react";

interface Branch {
  _id: string;
  name: string;
  code: string;
}

export default function BackupSection() {
  const { user } = useUser();
  const { selectedBranchId } = useBranchContext();
  const role = user?.publicMetadata?.role || user?.unsafeMetadata?.role;
  const isSuperAdmin = role === "superadmin";
  const isAdmin = role === "admin";

  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [targetBranch, setTargetBranch] = useState<string>("");

  useEffect(() => {
    if (isSuperAdmin) {
      fetch("/api/branches")
        .then((r) => r.json())
        .then((data) => {
          if (data.branches) setBranches(data.branches);
        })
        .catch(console.error);
    }
  }, [isSuperAdmin]);

  if (!isAdmin && !isSuperAdmin) return null;

  const handleBackup = async () => {
    setLoading(true);
    setStatus(null);

    try {
      const body: Record<string, string> = {};
      if (isSuperAdmin && targetBranch) {
        const branch = branches.find((b) => b._id === targetBranch);
        body.targetBranchId = targetBranch;
        body.targetBranchCode = branch?.code || branch?.name || targetBranch;
      }

      const res = await fetch("/api/backup/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json();
        setStatus({ type: "error", message: err.error || "فشل إنشاء النسخة الاحتياطية" });
        return;
      }

      // Trigger file download
      const blob = await res.blob();
      const fileName = res.headers.get("Content-Disposition")?.match(/filename="(.+)"/)?.[1] || "backup.json.gz";
      const docs = res.headers.get("X-Backup-Documents") || "0";

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setStatus({
        type: "success",
        message: `تم تحميل النسخة الاحتياطية — ${Number(docs).toLocaleString()} سجل`,
      });
    } catch (err) {
      setStatus({
        type: "error",
        message: err instanceof Error ? err.message : "حدث خطأ غير متوقع",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-card border border-border rounded-lg shadow-sm p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-cyan-100 dark:bg-cyan-900/30 rounded-lg">
          <HardDrive className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
        </div>
        <h3 className="text-lg font-bold text-foreground">نسخ احتياطي للبيانات</h3>
      </div>

      <p className="text-sm text-muted-foreground mb-4">
        {isSuperAdmin
          ? "اختر الفرع وسيتم تحميل ملف النسخة الاحتياطية على جهازك."
          : "سيتم تحميل نسخة احتياطية لبيانات فرعك على جهازك."}
      </p>

      {isSuperAdmin && (
        <div className="mb-4">
          <label className="block text-sm font-medium text-foreground mb-1">
            <Building2 className="inline h-4 w-4 ml-1" />
            اختر الفرع
          </label>
          <select
            value={targetBranch}
            onChange={(e) => setTargetBranch(e.target.value)}
            className="w-full p-2.5 rounded-lg border border-border bg-background text-foreground text-sm focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
          >
            <option value="">-- اختر فرع --</option>
            {branches.map((b) => (
              <option key={b._id} value={b._id}>
                {b.name} ({b.code})
              </option>
            ))}
          </select>
        </div>
      )}

      <button
        onClick={handleBackup}
        disabled={loading || (isSuperAdmin && !targetBranch)}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-cyan-600 hover:bg-cyan-700 text-white dark:bg-cyan-700 dark:hover:bg-cyan-600"
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            جاري إنشاء النسخة الاحتياطية...
          </>
        ) : (
          <>
            <Download className="h-4 w-4" />
            تحميل نسخة احتياطية
          </>
        )}
      </button>

      <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Shield className="h-3.5 w-3.5" />
        <span>{isSuperAdmin ? "سيتم تحميل الملف على جهازك مباشرة" : "النسخة تشمل بيانات فرعك فقط"}</span>
      </div>

      {status && (
        <div
          className={`mt-4 p-3 rounded-lg border text-sm flex items-center gap-2 ${
            status.type === "success"
              ? "bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300"
              : "bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300"
          }`}
        >
          {status.type === "success" ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <XCircle className="h-4 w-4 shrink-0" />}
          {status.message}
        </div>
      )}
    </div>
  );
}
