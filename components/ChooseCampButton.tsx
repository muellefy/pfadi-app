"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { chooseCamp } from "@/app/lager/actions";

export function ChooseCampButton({ slug }: { slug: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <button
      className="btn ghost"
      disabled={pending}
      onClick={() => start(async () => { await chooseCamp(slug); router.push(`/${slug}`); })}
    >
      Als aktuell wählen
    </button>
  );
}
