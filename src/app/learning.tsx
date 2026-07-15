import { ComingSoon } from '@/components/ComingSoon';

export default function Learning() {
  return (
    <ComingSoon
      title="Formations"
      subtitle="Cours en ligne, masterclass et programmes des maîtres Juste Debout — pour progresser dans toutes les danses debout."
      icon="school"
      bullets={[
        'Masterclass filmées des juges et finalistes',
        'Parcours par discipline : Popping, House, Locking, Hip-Hop, Afro…',
        'Business de la danse : vivre de son art, monter son école',
      ]}
    />
  );
}
