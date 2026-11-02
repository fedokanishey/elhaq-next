import { SignIn } from "@clerk/nextjs";

export default function Page() {
  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-80px)] bg-background py-12">
      <SignIn />
    </div>
  );
}
