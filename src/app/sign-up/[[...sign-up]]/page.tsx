import { SignUp } from "@clerk/nextjs";

export default function Page() {
  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-80px)] bg-gradient-to-b from-blue-50 to-white py-12">
      <SignUp />
    </div>
  );
}
