import { ComingSoon } from '@/components/ComingSoon';

export default function HallOfFame() {
  return (
    <ComingSoon
      title="Hall of Fame"
      subtitle="Le panthéon Juste Debout : les vainqueurs de chaque discipline, année après année, depuis 2002."
      icon="trophy"
      bullets={[
        'Palmarès officiel par édition et par discipline',
        'Les légendes des danses debout mises à l’honneur',
        'Alimenté automatiquement par les résultats des finales',
      ]}
    />
  );
}
