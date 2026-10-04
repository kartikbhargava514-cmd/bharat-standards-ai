import type { ReactNode } from "react";

type Spec = { heading: string; text: string; points: string[] };
export type ReportContent = {
  formal_title?: string;
  procurement_type?: string;
  item_name?: string;
  delivery_location?: string;
  delivery_period?: string;
  service_environment?: string;
  scope?: string[];
  approximate_dimensions?: string[];
  technical_specifications?: Spec[];
  dimensional_parameters?: string[];
};
type Reco = { id: string; is_number: string; title: string | null; category: string; relevance: number; reason: string | null; evidence: string | null };

const groups: { n: string; label: string; test: RegExp }[] = [
  { n: "6.1", label: "Primary Product Standard", test: /core/i },
  { n: "6.2", label: "Material / Related Standards", test: /related/i },
  { n: "6.3", label: "Safety Standards", test: /safety/i },
  { n: "6.4", label: "Testing Standards", test: /test/i },
  { n: "6.5", label: "Related / Normative References", test: /normative|terminology|installation/i },
];

function Section({ n, title, children }: { n: string; title: string; children: ReactNode }) {
  return (
    <section className="break-inside-avoid overflow-hidden rounded-md border border-primary/25">
      <h3 className="bg-primary/10 px-4 py-2 font-display text-sm font-bold tracking-wide text-navy uppercase">
        {n}. {title}
      </h3>
      <div className="space-y-2 px-4 py-3 text-sm">{children}</div>
    </section>
  );
}

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });

export function ReportDocument({
  p,
  report,
  recos,
  profile,
}: {
  p: { ref_no: string; title: string; created_at: string; quantity: string | null; unit: string | null; application: string | null; category: string | null; status: string };
  report: ReportContent;
  recos: Reco[];
  profile?: { full_name: string; department: string; org_type: string | null } | null | undefined;
}) {
  const title = report.formal_title || p.title;
  const qty = `${p.quantity ?? "—"} ${p.unit ?? ""}`.trim();
  const info: [string, string][] = [
    ["Organisation", profile?.org_type ? `${profile.org_type} Organisation` : "Government Department / Public Sector Organisation"],
    ["Department", profile?.department ?? "—"],
    ["Procurement Reference No.", p.ref_no],
    ["Date of Issue", fmtDate(p.created_at)],
    ["Procurement Type", report.procurement_type || "Supply of Technical Material"],
    ["Item Category", p.category ?? title],
    ["Quantity Required", qty],
    ["Delivery Location", report.delivery_location || "To be specified by the procuring authority"],
    ["Required Delivery Period", report.delivery_period || "To be specified by the procuring authority"],
    ["Intended Application", p.application ?? "—"],
    ["Expected Service Environment", report.service_environment || "—"],
  ];

  return (
    <article className="rounded-xl border border-border bg-card p-6 shadow-card sm:p-8">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-navy pb-4">
        <div className="flex-1 text-center">
          <h2 className="font-display text-xl font-bold tracking-wide text-navy uppercase">Government Procurement</h2>
          <p className="font-display text-base font-bold text-navy uppercase">Technical Specification Document</p>
          <p className="mt-2 text-lg">{title}</p>
        </div>
        <div className="rounded-md border border-primary/25 bg-primary/5 p-3 text-xs">
          <p className="font-semibold">Procurement Reference No.:</p>
          <p className="font-mono">{p.ref_no}</p>
          <p className="mt-1">Date of Issue: {fmtDate(p.created_at)}</p>
          <p>Document Status: {p.status}</p>
          {profile?.full_name && <p>Prepared by: {profile.full_name}</p>}
        </div>
      </header>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <Section n="1" title="Procurement Information">
            <dl className="divide-y divide-border">
              {info.map(([k, v]) => (
                <div key={k} className="grid grid-cols-[11rem_1fr] gap-2 py-1.5">
                  <dt className="font-semibold">{k}:</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          </Section>

          <Section n="2" title="Scope of Procurement">
            {(report.scope?.length ? report.scope : ["Scope will appear after AI analysis."]).map((s, i) => (
              <p key={i}>{s}</p>
            ))}
          </Section>

          <Section n="3" title="Quantity Requirement">
            <table className="w-full border border-border text-left">
              <thead className="bg-muted/60 text-xs">
                <tr>
                  <th className="px-2 py-1.5">Sl. No.</th>
                  <th className="px-2 py-1.5">Item</th>
                  <th className="px-2 py-1.5">Quantity</th>
                  <th className="px-2 py-1.5">Unit</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-border">
                  <td className="px-2 py-1.5">1</td>
                  <td className="px-2 py-1.5">{report.item_name || title}</td>
                  <td className="px-2 py-1.5">{p.quantity ?? "—"}</td>
                  <td className="px-2 py-1.5">{p.unit ?? "—"}</td>
                </tr>
              </tbody>
            </table>
            {report.approximate_dimensions?.length ? (
              <>
                <p className="font-semibold">Approximate dimensions:</p>
                <ul className="list-disc pl-5">
                  {report.approximate_dimensions.map((d) => <li key={d}>{d}</li>)}
                </ul>
              </>
            ) : null}
            <p className="text-muted-foreground">
              The final dimensions shall be verified against the approved technical specification before supply.
            </p>
          </Section>

          <Section n="4" title="Technical Specifications">
            {(report.technical_specifications ?? []).map((s, i) => (
              <div key={i}>
                <p className="font-semibold text-primary">4.{i + 1} {s.heading}</p>
                <p>{s.text}</p>
                {s.points.length > 0 && (
                  <ul className="list-disc pl-5">
                    {s.points.map((pt) => <li key={pt}>{pt}</li>)}
                  </ul>
                )}
              </div>
            ))}
          </Section>
        </div>

        <div className="space-y-4">
          <Section n="5" title="Dimensional Requirements">
            <p>The following parameters shall be checked:</p>
            <ul className="grid list-disc grid-cols-2 gap-x-6 pl-5">
              {(report.dimensional_parameters ?? []).map((d) => <li key={d}>{d}</li>)}
            </ul>
            <p>All dimensions shall comply with the applicable Indian Standard for the supplied product.</p>
          </Section>

          <Section n="6" title="Applicable Indian Standards">
            <p>The supplier shall identify and comply with all Indian Standards applicable to the supplied item.</p>
            {groups.map((g) => {
              const list = recos.filter((r) => g.test.test(r.category));
              if (!list.length) return null;
              return (
                <div key={g.n}>
                  <p className="font-semibold text-primary">{g.n} {g.label}</p>
                  <ul className="mt-1 space-y-2">
                    {list.map((r) => (
                      <li key={r.id} className="rounded border border-border p-2">
                        <p className="font-semibold">
                          {r.is_number} — {r.title}{" "}
                          <span className="font-normal text-muted-foreground">({r.relevance}% relevance)</span>
                        </p>
                        <p><span className="font-medium">Reason for applicability:</span> {r.reason}</p>
                        {r.evidence && <p className="text-xs text-muted-foreground italic">Evidence: {r.evidence}</p>}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </Section>

          <Section n="7" title="Normative Reference Requirement">
            <p>
              The technical evaluation shall not be limited to keyword matching of the product name. The
              applicable primary standard shall be analysed for its normative references and associated
              technical standards.
            </p>
            <div className="flex flex-wrap items-center gap-1 text-xs">
              {["Procurement Requirement", "Primary Product Standard", "Material Standard", "Coating Standard", "Testing Standards", "Performance / Safety Requirements", "Installation Requirements"].map((s, i, a) => (
                <span key={s} className="flex items-center gap-1">
                  <span className="rounded border border-primary/40 bg-primary/5 px-2 py-1">{s}</span>
                  {i < a.length - 1 && <span>→</span>}
                </span>
              ))}
            </div>
            <p>Each identified standard above is listed with the reason it is relevant to this procurement.</p>
          </Section>
        </div>
      </div>

      <p className="mt-6 border-t border-border pt-4 text-xs text-muted-foreground">
        This document assists the procurement official's review and is not a legal determination of
        applicability. Always verify the latest published edition and amendments with BIS.
      </p>
    </article>
  );
}
