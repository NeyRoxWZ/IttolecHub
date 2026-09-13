import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export interface LegalSection {
  title: string;
  body: React.ReactNode;
}

/** Shared frame for the terms and privacy pages, in the site's own style. */
export default function LegalPage({
  title, updated, intro, sections,
}: {
  title: string;
  updated: string;
  intro: React.ReactNode;
  sections: LegalSection[];
}) {
  return (
    <main className="min-h-screen bg-transparent text-tx-base px-4 sm:px-6 pt-4 md:pt-6 pb-12">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/"
            aria-label="Accueil"
            className="h-11 w-11 shrink-0 rounded-xl border-[3px] border-brand-border bg-brand-inner flex items-center justify-center hover:border-tx-base transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="font-display text-3xl leading-none">{title}</h1>
            <p className="text-[11px] text-tx-muted mt-1">Dernière mise à jour : {updated}</p>
          </div>
        </div>

        <div className="bg-brand-card border-4 border-brand-border rounded-[28px] p-5 sm:p-8 shadow-brutal">
          <div className="text-sm text-tx-secondary leading-relaxed">{intro}</div>

          <div className="mt-6 space-y-6">
            {sections.map((section, i) => (
              <section key={section.title}>
                <h2 className="font-display text-lg text-tx-base mb-2">
                  {i + 1}. {section.title}
                </h2>
                <div className="text-sm text-tx-secondary leading-relaxed space-y-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_b]:text-tx-base">
                  {section.body}
                </div>
              </section>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
