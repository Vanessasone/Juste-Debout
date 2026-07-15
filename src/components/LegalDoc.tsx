/**
 * Rendu d'un document légal (CGU, Confidentialité, Mentions légales).
 */
import { PageHeader, Screen, T } from '@/components/ui';
import { Space } from '@/constants/brand';
import { useColors } from '@/lib/theme';

export type LegalSection = { h: string; body: string[] };

export function LegalDoc({
  title,
  subtitle,
  updated,
  intro,
  sections,
}: {
  title: string;
  subtitle: string;
  updated: string;
  intro?: string;
  sections: LegalSection[];
}) {
  const c = useColors();
  return (
    <Screen>
      <PageHeader title={title} subtitle={subtitle} />
      <T variant="caption" color={c.textMute}>
        Dernière mise à jour : {updated}
      </T>
      {intro ? (
        <T variant="small" color={c.textDim} style={{ marginTop: Space.md, lineHeight: 21 }}>
          {intro}
        </T>
      ) : null}

      {sections.map((s, i) => (
        <LegalSectionBlock key={i} index={i + 1} section={s} />
      ))}

      <T variant="caption" color={c.textMute} style={{ marginTop: Space.xl, marginBottom: Space.lg, lineHeight: 18 }}>
        Ce document est un modèle de départ pour Juste Debout. Il doit être relu et validé par un
        professionnel du droit avant la publication sur les stores.
      </T>
    </Screen>
  );
}

function LegalSectionBlock({ index, section }: { index: number; section: LegalSection }) {
  const c = useColors();
  return (
    <>
      <T variant="h3" style={{ marginTop: Space.xl }}>
        {index}. {section.h}
      </T>
      {section.body.map((p, i) => (
        <T key={i} variant="small" color={c.textDim} style={{ marginTop: Space.sm, lineHeight: 21 }}>
          {p}
        </T>
      ))}
    </>
  );
}
