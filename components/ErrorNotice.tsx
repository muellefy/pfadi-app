export function ErrorNotice({ error }: { error: string }) {
  return <div className="notice error">{error}</div>;
}
