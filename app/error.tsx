"use client";
import { ErrorPanel } from "@/components/ErrorPanel";

/** Errors outside a camp (start page, "Alle Lager", a broken camps.json in the camp layout). */
export default function AppError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <main style={{ maxWidth: 720, margin: "48px auto", padding: "0 16px" }}><ErrorPanel {...props} /></main>;
}
