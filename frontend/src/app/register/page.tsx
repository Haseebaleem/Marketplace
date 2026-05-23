"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  registerSchema,
  type RegisterInput,
  type Role,
} from "@marketplace/shared";
import { registerRequest } from "@/lib/auth-api";
import { ApiError } from "@/lib/api";
import { useAuthStore } from "@/stores/auth.store";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type FormRole = Extract<Role, "BUYER" | "SUPPLIER">;

interface FormValues {
  email: string;
  password: string;
  name: string;
  role: FormRole;
  storeName?: string;
}

export default function RegisterPage() {
  const router = useRouter();
  const setSession = useAuthStore((s) => s.setSession);
  const [role, setRole] = useState<FormRole>("BUYER");

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: { role: "BUYER" },
    resolver: zodResolver(registerSchema),
  });

  const mutation = useMutation({
    mutationFn: (data: FormValues) => registerRequest(data as RegisterInput),
    onSuccess: (data) => {
      setSession(data.token, data.user);
      toast.success(`Account created. Welcome, ${data.user.name}!`);
      router.push("/");
    },
    onError: (err: unknown) => {
      if (err instanceof ApiError) {
        toast.error(err.message);
      } else {
        toast.error("Could not create your account. Please try again.");
      }
    },
  });

  const selectRole = (next: FormRole) => {
    setRole(next);
    setValue("role", next, { shouldValidate: false });
  };

  return (
    <main className="container flex min-h-screen items-center justify-center py-12">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Create your account</CardTitle>
          <CardDescription>
            Buy from local vendors or sell your products on the platform.
          </CardDescription>
        </CardHeader>
        <form
          onSubmit={handleSubmit((data) => mutation.mutate(data))}
          noValidate
        >
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>I want to</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => selectRole("BUYER")}
                  className={cn(
                    "rounded-md border p-3 text-sm font-medium transition-colors",
                    role === "BUYER"
                      ? "border-primary bg-primary/5 text-foreground"
                      : "border-input text-muted-foreground hover:bg-accent",
                  )}
                >
                  Buy products
                </button>
                <button
                  type="button"
                  onClick={() => selectRole("SUPPLIER")}
                  className={cn(
                    "rounded-md border p-3 text-sm font-medium transition-colors",
                    role === "SUPPLIER"
                      ? "border-primary bg-primary/5 text-foreground"
                      : "border-input text-muted-foreground hover:bg-accent",
                  )}
                >
                  Sell products
                </button>
              </div>
              <input type="hidden" {...register("role")} value={role} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Full name</Label>
              <Input id="name" autoComplete="name" {...register("name")} />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name.message}</p>
              )}
            </div>

            {role === "SUPPLIER" && (
              <div className="space-y-2">
                <Label htmlFor="storeName">Store name</Label>
                <Input
                  id="storeName"
                  placeholder="My Awesome Store"
                  {...register("storeName")}
                />
                {errors.storeName && (
                  <p className="text-sm text-destructive">
                    {errors.storeName.message}
                  </p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                {...register("email")}
              />
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                {...register("password")}
              />
              <p className="text-xs text-muted-foreground">
                At least 8 characters, with at least one letter and one number.
              </p>
              {errors.password && (
                <p className="text-sm text-destructive">
                  {errors.password.message}
                </p>
              )}
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            <Button
              type="submit"
              className="w-full"
              disabled={mutation.isPending}
            >
              {mutation.isPending ? "Creating account…" : "Create account"}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Already have one?{" "}
              <Link
                href="/login"
                className="font-medium text-foreground hover:underline"
              >
                Sign in
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </main>
  );
}
