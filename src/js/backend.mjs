import PocketBase from 'pocketbase';

export const pb = new PocketBase('https://octypb.antonin-seichepine.fr');
pb.autoCancellation(false);

export async function getParcours() {
  try {
    const data = await pb.collection('parcours').getFullList({ sort: 'ordre' });
    return data;
  } catch {
    return [];
  }
}

export async function getEtapesByParcours(parcoursId) {
  try {
    const data = await pb.collection('etape').getFullList({
      filter: `parcours = "${parcoursId}"`,
      sort: 'ordre',
      requestKey: `etapes-parcours-${parcoursId}`,
    });
    return data;
  } catch {
    return [];
  }
}

export async function getContenusByEtape(etapeId) {
  try {
    const data = await pb.collection('contenu').getFullList({
      filter: `etape = "${etapeId}"`,
      sort: 'ordre',
      requestKey: `contenus-etape-${etapeId}`,
    });
    return data;
  } catch {
    return [];
  }
}

export async function getQuizByEtape(etapeId) {
  try {
    const data = await pb.collection('quiz').getFullList({
      filter: `etape = "${etapeId}"`,
      requestKey: `quiz-etape-${etapeId}`,
    });
    return data;
  } catch {
    return [];
  }
}

export async function getQuestionsByQuiz(quizId) {
  try {
    const data = await pb.collection('question').getFullList({
      filter: `quiz = "${quizId}"`,
      sort: 'ordre',
      requestKey: `questions-quiz-${quizId}`,
    });
    return data;
  } catch {
    return [];
  }
}

export async function getReponsesByQuestion(questionId) {
  try {
    const data = await pb.collection('reponse').getFullList({
      filter: `question = "${questionId}"`,
      sort: 'created',
      requestKey: `reponses-question-${questionId}`,
    });
    return data;
  } catch {
    return [];
  }
}

// Récupère level et xp depuis PocketBase (retourne null en cas d'échec)
export async function fetchProgressFromPocketBase(userId) {
  if (!userId || userId === 'guest') return null;
  try {
    const user = await pb.collection('users').getOne(userId, {
      fields: 'id,level,xp',
      requestKey: `user-progress-${userId}`,
    });
    return {
      level: Math.min(16, Math.max(0, Number.parseInt(user.level, 10) || 0)),
      xp: Math.min(16, Math.max(0, Number.parseInt(user.xp, 10) || 0)),
    };
  } catch {
    return null;
  }
}

// Pousse level et xp vers PocketBase (silencieux en cas d'échec réseau)
export async function syncProgressToPocketBase(userId, level, xp) {
  if (!userId || userId === 'guest') return false;
  try {
    await pb.collection('users').update(
      userId,
      { level: Math.min(16, Math.max(0, level)), xp: Math.min(16, Math.max(0, xp)) },
      { requestKey: `sync-progress-${userId}` },
    );
    return true;
  } catch {
    return false;
  }
}

const sanitizeProgressPercent = (value) => {
  const percent = Number.parseInt(value, 10);
  if (!Number.isFinite(percent)) return 0;
  return Math.min(100, Math.max(0, percent));
};

const uniqueIds = (items) => {
  if (!Array.isArray(items)) return [];
  return [...new Set(items.filter(Boolean).map(String))];
};

const escapeFilterValue = (value) =>
  String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');

export async function getProgressionByParcours(userId, parcoursId) {
  if (!userId || userId === 'guest' || !parcoursId) return null;
  try {
    const data = await pb.collection('progression').getFullList({
      filter: `utilisateur = "${escapeFilterValue(userId)}" && parcours = "${escapeFilterValue(parcoursId)}"`,
      requestKey: `progression-${userId}-${parcoursId}`,
    });
    return data[0] || null;
  } catch {
    return null;
  }
}

export async function getProgressionsByUser(userId) {
  if (!userId || userId === 'guest') return [];
  try {
    const data = await pb.collection('progression').getFullList({
      filter: `utilisateur = "${escapeFilterValue(userId)}"`,
      requestKey: `progressions-user-${userId}`,
    });
    return data;
  } catch {
    return [];
  }
}

export async function createOrUpdateProgression(userId, parcoursId, quizId, pourcentage) {
  if (!userId || userId === 'guest' || !parcoursId || !quizId) return false;

  const safePercent = sanitizeProgressPercent(pourcentage);
  const statut = safePercent >= 100 ? 'termine' : 'en_cours';

  try {
    const progression = await getProgressionByParcours(userId, parcoursId);

    if (progression) {
      const previousQuizTermines = Array.isArray(progression.quiz_termines)
        ? progression.quiz_termines
        : [];
      const quizTermines = uniqueIds([...previousQuizTermines, quizId]);
      await pb.collection('progression').update(
        progression.id,
        {
          quiz_termines: quizTermines,
          pourcentage: safePercent,
          statut,
        },
        { requestKey: `update-progression-${progression.id}` },
      );
      return true;
    }

    await pb.collection('progression').create(
      {
        utilisateur: userId,
        parcours: parcoursId,
        quiz_termines: [quizId],
        pourcentage: safePercent,
        statut,
      },
      { requestKey: `create-progression-${userId}-${parcoursId}` },
    );
    return true;
  } catch {
    return false;
  }
}
