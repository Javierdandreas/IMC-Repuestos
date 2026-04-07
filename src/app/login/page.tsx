import { redirect } from "next/navigation";
import LoginForm from "@/components/auth/LoginForm";
import { canAccessApp, getServerInternalUser } from "@/lib/auth";

export default async function LoginPage() {
  const session = await getServerInternalUser();

  if (canAccessApp(session)) {
    redirect("/");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 px-4 py-10">
      <LoginForm />
    </div>
  );
}
