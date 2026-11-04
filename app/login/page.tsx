import { signIn } from "@/auth";
import { Tent } from "@/components/icons";

export const metadata = { title: "Anmelden" };

const MESSAGES: Record<string, string> = {
  AccessDenied: "Nur Konten der Organisation sind zugelassen. Melde dich mit deiner Pfadi-Adresse an.",
  Configuration: "Die Anmeldung ist falsch konfiguriert (AUTH_GOOGLE_ID / AUTH_SECRET prüfen).",
};

export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string; callbackUrl?: string }> }) {
  const { error, callbackUrl } = await searchParams;
  const domain = process.env.ALLOWED_DOMAIN ?? "pfadis.ch";
  return (
    <main className="login">
      <div className="card">
        <div style={{ color: "var(--forest)", justifySelf: "center" }}><Tent size={40} /></div>
        <h1 style={{ fontSize: 30 }}>Lagerplaner</h1>
        <p className="muted" style={{ margin: 0 }}>Programm aus eCamp, Listen und Ablage aus dem Drive – an einem Ort.</p>
        {error && <div className="notice error">{MESSAGES[error] ?? "Anmeldung fehlgeschlagen."}</div>}
        <form
          action={async () => {
            "use server";
            // only ever redirect back to a path on this app
            let target = "/";
            try {
              if (callbackUrl) { const u = new URL(callbackUrl, "http://app.local"); target = u.pathname + u.search; }
            } catch {}
            await signIn("google", { redirectTo: target.startsWith("//") ? "/" : target });
          }}
        >
          <button className="btn primary" style={{ width: "100%", justifyContent: "center", padding: "10px 14px" }}>
            Mit Google anmelden
          </button>
        </form>
        <p className="small muted" style={{ margin: 0 }}>Nur für Konten @{domain}</p>
      </div>
    </main>
  );
}
