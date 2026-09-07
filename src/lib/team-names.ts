// Short club names for tight rows (fixture slips, feed cards). Anything not
// listed falls back to the full name. National teams are short already.
const SHORT: Record<string, string> = {
  'Internazionale': 'Inter',
  'Paris Saint-Germain': 'PSG',
  'Manchester City': 'Man City',
  'Manchester United': 'Man United',
  'Borussia Dortmund': 'Dortmund',
  'Bayern Munich': 'Bayern',
  'Atlético Madrid': 'Atlético',
  'Feyenoord Rotterdam': 'Feyenoord',
  'PSV Eindhoven': 'PSV',
  'Sporting CP': 'Sporting',
  'Club Brugge': 'Brugge',
  'Shakhtar Donetsk': 'Shakhtar',
  'Slovan Bratislava': 'Slovan',
  'Slavia Prague': 'Slavia',
  'RB Leipzig': 'Leipzig',
  'VfB Stuttgart': 'Stuttgart',
  'Real Betis': 'Betis',
  'FC Porto': 'Porto',
  'AEK Athens': 'AEK',
  'LASK Linz': 'LASK',
  'Bodo/Glimt': 'Bodø/Glimt',
  'Viking FK': 'Viking',
  'Sabah FK': 'Sabah',
  'AS Roma': 'Roma',
  'Tottenham Hotspur': 'Tottenham',
  'Bayer Leverkusen': 'Leverkusen',
  'Eintracht Frankfurt': 'Frankfurt',
  'Olympique Marseille': 'Marseille',
  'Estados Unidos': 'EE. UU.',
  'Bosnia y Herzegovina': 'Bosnia',
  'República Checa': 'Chequia',
  'Costa de Marfil': 'C. de Marfil',
};

export function shortTeamName(name: string): string {
  return SHORT[name] ?? name;
}
