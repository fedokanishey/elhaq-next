// "use client";

// import Link from "next/link";
// import { Suspense } from "react";

// async function UserInfo() {
//   try {
//     const { useUser } = await import("@clerk/nextjs");
//     const { user } = useUser();
    
//     if (!user) {
//       return (
//         <div className="flex gap-4 justify-center">
//           <Link href="/sign-in" className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-lg font-semibold">
//             تسجيل الدخول
//           </Link>
//           <Link href="/sign-up" className="px-8 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 text-lg font-semibold">
//             إنشاء حساب
//           </Link>
//         </div>
//       );
//     }

//     return (
//       <div className="space-y-4">
//         <p className="text-lg">أهلاً {user.firstName || "المستخدم"}</p>
//         <div className="flex gap-4 justify-center">
//           <Link href="/beneficiaries" className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
//             المستفيدين
//           </Link>
//           <Link href="/initiatives" className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700">
//             المبادرات
//           </Link>
//           <Link href="/profile" className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700">
//             الملف الشخصي
//           </Link>
//         </div>
//       </div>
//     );
//   } catch (error) {
//     return (
//       <div className="flex gap-4 justify-center">
//         <Link href="/sign-in" className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-lg font-semibold">
//           تسجيل الدخول
//         </Link>
//         <Link href="/sign-up" className="px-8 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 text-lg font-semibold">
//           إنشاء حساب
//         </Link>
//       </div>
//     );
//   }
// }

// export default function Home() {
//   return (
//     <div className="flex min-h-screen flex-col items-center justify-center gap-4">
//       <div className="text-center">
//         <h1 className="text-4xl font-bold mb-4">دعوة الحق</h1>
//         <p className="text-lg text-gray-600 mb-8">نظام إدارة العمل الخيري الشامل</p>

//         <Suspense fallback={<div className="text-lg">جاري التحميل...</div>}>
//           <UserInfo />
//         </Suspense>
//       </div>
//     </div>
//   );
// }
