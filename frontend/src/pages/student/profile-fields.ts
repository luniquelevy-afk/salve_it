// Options des menus du profil étudiant (EF-39) et table de libellés partagée,
// réutilisée par le suivi enseignant. Séparée du composant pour le hot-reload.
export type Options = [string, string][];

export const EDUCATION: Options = [
  ['lycee', 'Lycée'],
  ['baccalaureat', 'Baccalauréat obtenu'],
  ['licence_en_cours', 'Licence en cours'],
  ['licence', 'Licence obtenue'],
  ['master', 'Master'],
  ['autre', 'Autre'],
];
export const ENGLISH: Options = [['aucun', 'Aucune notion'], ...(['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map((level) => [level, level]) as Options)];
export const INSTITUTION: Options = [
  ['public', 'Université publique'],
  ['prive', 'Établissement privé'],
  ['indifferent', 'Indifférent'],
];
export const OBJECTIVE: Options = [
  ['licence', 'Licence'],
  ['master', 'Master'],
  ['formation_pro', 'Formation professionnelle'],
  ['mobilite', 'Mobilité / échange'],
];
export const BUDGET: Options = [
  ['moins_500', 'Moins de 500 € par mois'],
  ['500_800', '500 à 800 € par mois'],
  ['800_1200', '800 à 1 200 € par mois'],
  ['plus_1200', 'Plus de 1 200 € par mois'],
  ['non_defini', 'Pas encore défini'],
];
export const FINANCING: Options = [
  ['famille', 'Ma famille'],
  ['garant', 'Un garant'],
  ['bourse', 'Une bourse'],
  ['personnel', 'Moi-même'],
  ['non_defini', 'Pas encore défini'],
];
export const VISA: Options = [
  ['etudes', 'Visa pour études'],
  ['tourisme', 'Visa touristique'],
  ['travail', 'Visa pour travail'],
];
export const STAGE: Options = [
  ['exploration', 'Je me renseigne'],
  ['choix_formation', 'Je choisis ma formation'],
  ['preparation_tests', 'Je prépare les tests d’admission'],
  ['preinscription', 'Préinscription en cours (Universitaly)'],
  ['visa', 'Je prépare ma demande de visa'],
  ['depart', 'Départ imminent'],
];

export const PROFILE_LABELS: Record<'education' | 'english' | 'institution' | 'objective' | 'budget' | 'financing' | 'stage', Record<string, string>> = {
  education: Object.fromEntries(EDUCATION),
  english: Object.fromEntries(ENGLISH),
  institution: Object.fromEntries(INSTITUTION),
  objective: Object.fromEntries(OBJECTIVE),
  budget: Object.fromEntries(BUDGET),
  financing: Object.fromEntries(FINANCING),
  stage: Object.fromEntries(STAGE),
};
