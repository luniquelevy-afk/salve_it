// Création du tout premier compte admin (aucune auto-inscription possible, EF-01).
// Usage : pnpm --filter @salve/backend bootstrap:admin --email admin@centre.cg --name "Prénom Nom"
import { parseArgs } from 'node:util';
import { supabaseAdmin } from '../lib/supabase.js';
import { createAccount } from '../services/accounts.js';

const { values } = parseArgs({
  options: { email: { type: 'string' }, name: { type: 'string' } },
  allowPositionals: true,
});

if (!values.email || !values.name) {
  console.error('Usage : pnpm --filter @salve/backend bootstrap:admin --email admin@centre.cg --name "Prénom Nom"');
  process.exit(1);
}

const { count, error } = await supabaseAdmin.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'admin');
if (error) throw error;
if ((count ?? 0) > 0) {
  console.error('Un compte admin existe déjà : créez les autres comptes depuis le back-office.');
  process.exit(1);
}

const { account, temporaryPassword } = await createAccount({ email: values.email, fullName: values.name, role: 'admin' }, null);

console.log(`Admin créé : ${account.email}`);
console.log(`Mot de passe temporaire (affiché une seule fois) : ${temporaryPassword}`);
console.log('À la première connexion : changement du mot de passe puis activation de la MFA.');
