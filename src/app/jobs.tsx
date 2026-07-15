import { ComingSoon } from '@/components/ComingSoon';

export default function Jobs() {
  return (
    <ComingSoon
      title="Job Board"
      subtitle="Castings, tournées, cours à donner, chorégraphies — les opportunités professionnelles de la communauté Juste Debout."
      icon="briefcase"
      bullets={[
        'Offres de casting et de tournées internationales',
        'Postes de professeur et missions de chorégraphie',
        'Postule directement depuis ton profil de danseur',
      ]}
    />
  );
}
