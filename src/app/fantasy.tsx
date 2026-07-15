import { ComingSoon } from '@/components/ComingSoon';

export default function Fantasy() {
  return (
    <ComingSoon
      title="Fantasy JD"
      subtitle="Deviens manager : compose ton équipe de danseurs et marque des points quand ils brillent aux Juste Debout du monde entier."
      icon="game-controller"
      bullets={[
        'Constitue ton équipe de danseurs avant chaque saison',
        'Gagne des points selon leurs vraies performances : passages, victoires et titres',
        'Grimpe au classement mondial des managers Fantasy',
        'Crée des ligues privées et défie tes amis',
      ]}
    />
  );
}
