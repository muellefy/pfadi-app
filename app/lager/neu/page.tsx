import Link from "next/link";
import { getConfig } from "@/lib/data/config";
import { NewCampForm } from "@/components/NewCampForm";

export const metadata = { title: "Neues Lager" };

export default async function NeuesLager() {
  const config = await getConfig();
  return (
    <>
      <header className="page-head">
        <div>
          <div className="eyebrow"><Link href="/lager">Alle Lager</Link></div>
          <h1>Neues Lager</h1>
          <p>
            Die App kopiert die Ordnerstruktur der Vorlage (mit allen Dateien darin) in den Drive-Ordner, den du angibst,
            und findet Lagerdaten, TN- und Leiterliste in der Kopie selbst.
          </p>
        </div>
      </header>
      <NewCampForm defaultTemplate={config.templateFolderId ?? ""} />
    </>
  );
}
