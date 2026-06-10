import * as React from "react";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/api";

export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const user = await getSessionUser();

  if (!user) {
    redirect(`/${locale}/login`);
  }
  if (!user.isSuperadmin) {
    redirect(`/${locale}/dashboard`);
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-4 py-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">Panel de Admin</h1>
            <p className="text-sm text-muted-foreground">
              Solo superadmin · Ingresar resultados
            </p>
          </div>
          <a
            href={`/${locale}/dashboard`}
            className="text-sm font-semibold text-primary"
          >
            ← Volver
          </a>
        </div>
        {children}
      </div>
    </div>
  );
}
