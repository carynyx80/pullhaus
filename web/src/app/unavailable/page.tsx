import { Mark } from "@/components/mark";

export default function UnavailablePage() {
  return (
    <section className="mx-auto max-w-xl px-4 py-24">
      <Mark size={72} />
      <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.32em] text-gold">Unavailable</p>
      <h1 className="mt-3 font-display text-5xl">Pullhaus is not offered here.</h1>
      <p className="mt-4 text-muted">The country list is an operator setting. If you believe this is a mistake, the operator can change BLOCKED_COUNTRIES.</p>
    </section>
  );
}
