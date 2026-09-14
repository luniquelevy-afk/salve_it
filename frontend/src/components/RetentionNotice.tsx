import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { RetentionPolicy } from '../lib/types';

const duration = (months: number) => (months % 12 === 0 ? `${months / 12} an${months >= 24 ? 's' : ''}` : `${months} mois`);

// ENF-11 : l'étudiant sait combien de temps ses données sensibles sont conservées.
export function RetentionNotice({ context }: { context: 'embassy' | 'documents' }) {
  const [policy, setPolicy] = useState<RetentionPolicy | null>(null);

  useEffect(() => {
    api<RetentionPolicy>('/api/me/retention-policy')
      .then(setPolicy)
      .catch(() => setPolicy(null));
  }, []);

  if (!policy) return null;

  const sentences =
    context === 'embassy'
      ? [
          policy.embassySessionsMonths
            ? `Conservation : vos entretiens (transcript et rapport) sont supprimés automatiquement ${duration(policy.embassySessionsMonths)} après leur début.`
            : 'Conservation : vos entretiens sont gardés jusqu’à ce que vous les supprimiez ; le centre n’a pas encore fixé de durée de suppression automatique.',
          'Vous pouvez supprimer un entretien à tout moment.',
        ]
      : [
          policy.documentVersionsMonths
            ? `Conservation : les anciennes versions d’un document sont supprimées ${duration(policy.documentVersionsMonths)} après leur dépôt ; la version en cours est gardée.`
            : 'Conservation : vos documents et leurs anciennes versions sont gardés tant que vous ne les supprimez pas ; le centre n’a pas encore fixé de durée de suppression automatique.',
          ...(policy.suspendedStudentsMonths
            ? [`Si votre compte est suspendu, vos documents sont supprimés ${duration(policy.suspendedStudentsMonths)} après la suspension.`]
            : []),
        ];

  return <p className="text-xs text-stone-500">{sentences.join(' ')}</p>;
}
