import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyUnsub } from "@/lib/reminder-token";

/**
 * One-click unsubscribe for reminder emails.
 *
 * GET only shows a confirm button: mail scanners and link prefetchers GET every
 * link, and they must never unsubscribe anyone. The POST does the work, and is
 * also what mail clients send for the List-Unsubscribe one-click header.
 * Signed with CRON_SECRET (see reminder-token.ts).
 */
export const dynamic = "force-dynamic";

const html = (es: boolean, title: string, body: string, status = 200) =>
  new NextResponse(
    `<!doctype html><html lang="${es ? "es" : "en"}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex,nofollow">
<title>La Polla</title>
<style>
  body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#070B1F;color:#EAF1F9;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
  .c{max-width:380px;padding:28px;text-align:center}
  h1{font-size:20px;margin:0 0 8px} p{margin:0 0 18px;color:#9AA8C7;font-size:14px;line-height:1.5}
  button{padding:13px 26px;border:0;border-radius:12px;background:#5E7CFF;color:#fff;font-weight:700;font-size:15px;cursor:pointer}
</style></head><body><div class="c"><h1>${title}</h1>${body}</div></body></html>`,
    { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } }
  );

function parse(req: Request) {
  const sp = new URL(req.url).searchParams;
  const u = sp.get("u") ?? "";
  const s = sp.get("s") ?? "";
  const es = sp.get("l") !== "en";
  const ok = verifyUnsub(u, s, process.env.CRON_SECRET ?? "");
  return { u, s, es, ok, qs: new URL(req.url).search };
}

export async function GET(req: Request) {
  const { es, ok, qs } = parse(req);
  if (!ok) return html(es, es ? "Enlace no válido" : "Invalid link", `<p>${es ? "Este enlace no es válido o venció." : "This link is invalid or expired."}</p>`, 400);
  return html(
    es,
    es ? "¿Dejar de recibir recordatorios?" : "Stop reminder emails?",
    `<p>${es ? "No te enviaremos más correos de La Polla con recordatorios de picks." : "We won't send you any more La Polla pick reminders."}</p>
     <form method="POST" action="/api/unsubscribe${qs}"><button type="submit">${es ? "Sí, dejar de recibirlos" : "Yes, stop them"}</button></form>`
  );
}

export async function POST(req: Request) {
  const { u, es, ok } = parse(req);
  if (!ok) return html(es, es ? "Enlace no válido" : "Invalid link", `<p>${es ? "Este enlace no es válido o venció." : "This link is invalid or expired."}</p>`, 400);
  const { error } = await createAdminClient().from("users").update({ email_reminders: false }).eq("id", u);
  if (error) return html(es, es ? "Algo salió mal" : "Something went wrong", `<p>${es ? "Inténtalo de nuevo en un momento." : "Please try again in a moment."}</p>`, 500);
  return html(
    es,
    es ? "Listo" : "Done",
    `<p>${es ? "No recibirás más recordatorios por correo. Siempre puedes seguir jugando en la app." : "You won't get reminder emails anymore. You can keep playing in the app."}</p>`
  );
}
