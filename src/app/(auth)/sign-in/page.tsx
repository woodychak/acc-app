import { signInAction } from "@/app/actions";
import { FormMessage, Message } from "@/components/form-message";
import Navbar from "@/components/navbar";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";

interface LoginProps {
  searchParams?: Record<string, string | string[] | undefined>;
}
// 自訂一個局部型別，不依賴全域的 Message 型別
type LocalMessage = {
  type: "success" | "error";
  message: string;
} | null;

export default async function SignInPage({ searchParams }: LoginProps) {
  
  const message: LocalMessage = searchParams?.message
  ? {
      type: searchParams?.type === "error" ? "error" : "success",
      message: String(searchParams.message),
    }
  : null;

  return (
    <>
      <Navbar />
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-8">
        <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-sm">
          {message && <FormMessage message={message} />}
          <form className="flex flex-col space-y-6">
            <div className="space-y-2 text-center">
              <h1 className="text-3xl font-semibold tracking-tight">Sign in</h1>
              <p className="text-sm text-muted-foreground">
                Don't have an account?{" "}
                <Link
                  className="text-primary font-medium hover:underline transition-all"
                  href="/sign-up"
                >
                  Sign up
                </Link>
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium">
                  Email
                </Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="you@example.com"
                  required
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label htmlFor="password" className="text-sm font-medium">
                    Password
                  </Label>
                  <Link
                    className="text-xs text-muted-foreground hover:text-foreground hover:underline transition-all"
                    href="/forgot-password"
                  >
                    Forgot Password?
                  </Link>
                </div>
                <Input
                  id="password"
                  type="password"
                  name="password"
                  placeholder="Your password"
                  required
                  className="w-full"
                />
              </div>
            </div>

            <SubmitButton
              className="w-full"
              pendingText="Signing in..."
              formAction={signInAction}
            >
              Sign in
            </SubmitButton>
          </form>
        </div>
      </div>
    </>
  );
}