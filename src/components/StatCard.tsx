import { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  colorClass: string;
}

export default function StatCard({ title, value, icon, colorClass }: StatCardProps) {
  return (
    <div className={`border rounded-xl shadow-sm p-4 flex items-center gap-4 ${colorClass}`}>
      <div className="p-3 bg-white/30 rounded-full text-current shrink-0">{icon}</div>
      <div>
        <p className="text-sm text-black dark:text-white  font-semibold">{title}</p>
        <p className="text-2xl font-bold">{value}</p>
      </div>
    </div>
  );
}
