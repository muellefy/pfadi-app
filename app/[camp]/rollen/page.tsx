import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { getConfig } from "@/lib/data/config";
import { getMyCamp } from "@/lib/data/myRoles";
import { CAMP_ROLES, ROLE_LABEL, mergeRoles } from "@/lib/campRoles";
import { canManageRoles, rolesOf } from "@/lib/roles";
import { RoleEditor } from "@/components/RoleEditor";

export const metadata = { title: "Rollen" };

const HINT = {
  hauptleitung: "Leitet das Lager: vergibt die Rollen, sieht die Coach-Durchsicht.",
  leiter: "Wer hier steht, sieht dieses Lager. Sobald mindestens ein Leiter eingetragen ist, sehen alle anderen (ausser AL und Coach) das Lager in der App nicht mehr. Die Ordner im Drive bleiben so freigegeben, wie sie sind.",
  kueche: "Startet auf dem Menüplan. Sobald jemand Küche ist, dürfen nur Küche, Hauptleitung und Abteilungsleitung den Menüplan und Küchen-Buchungen ändern.",
} as const;

/** Who has which role in this camp. The Hauptleitung (the camp's admin) and the AL manage it here. */
export default async function RollenPage({ params }: { params: Promise<{ camp: string }> }) {
  const { camp: slug } = await params;
  const [camp, config, session] = await Promise.all([getMyCamp(slug), getConfig(), auth()]);
  if (!camp) notFound();
  const editable = canManageRoles(rolesOf(session?.user?.email, config.roles, camp));
  const fixed = camp.fixedRoles ?? mergeRoles({});

  return (
    <>
      <header className="page-head">
        <div>
          <div className="eyebrow">{camp.name}</div>
          <h1>Rollen</h1>
          <p>
            {editable ? "Du kannst die Rollen dieses Lagers vergeben." : "Rollen vergeben kann die Hauptleitung dieses Lagers oder die Abteilungsleitung."}
            {" "}Rollen ändern nichts an den Berechtigungen im Drive.
          </p>
        </div>
      </header>
      <div className="grid grid-2">
        {CAMP_ROLES.map((r) => (
          <RoleEditor key={r} slug={slug} role={r} label={ROLE_LABEL[r]} hint={HINT[r]} emails={camp[r]} fixed={fixed[r]} editable={editable} domain={(process.env.ALLOWED_DOMAIN ?? "pfadis.ch").toLowerCase()} />
        ))}
      </div>
      <section className="card" style={{ marginTop: 20 }}>
        <div className="card-head"><h2>Abteilung</h2></div>
        <p className="small muted" style={{ marginTop: 0 }}>Abteilungsleitung und J+S-Coaches gelten für alle Lager und stehen in config/camps.json.</p>
        <p><b>Abteilungsleitung:</b> {config.roles.al.join(", ") || "–"}</p>
        <p><b>J+S-Coach:</b> {config.roles.coach.join(", ") || "–"}</p>
      </section>
    </>
  );
}
