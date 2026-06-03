import {
  getParcours,
  getProgressionByParcours,
  getProgressionsByUser,
} from './src/js/backend.mjs';

const parcours = await getParcours();
console.table(parcours.map(p => ({ id: p.id, nom: p.nom_parcours, ordre: p.ordre })));

const testUserId = process.env.OCTY_TEST_USER_ID || '';
const firstParcoursId = parcours[0]?.id || '';

if (!testUserId) {
  console.log('Progression: test complet impossible sans utilisateur authentifie.');
  console.log('Progression user vide:', await getProgressionsByUser(testUserId));
  console.log('Progression parcours vide:', await getProgressionByParcours(testUserId, firstParcoursId));
} else {
  const progressions = await getProgressionsByUser(testUserId);
  console.table(progressions.map((item) => ({
    id: item.id,
    parcours: item.parcours,
    pourcentage: item.pourcentage,
    statut: item.statut,
  })));
  console.log(
    'Progression premier parcours:',
    await getProgressionByParcours(testUserId, firstParcoursId),
  );
}
