export const PROGRESS_SCHEMA_VERSION = 1;

export function parseJson(value) {
  try {
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

const hasStorage = () => typeof window !== 'undefined' && typeof localStorage !== 'undefined';

const uniqueStrings = (items) => {
  if (!Array.isArray(items)) return [];
  return [...new Set(items.filter(Boolean).map(String))];
};

const progressKeys = (userId) => ({
  completedQuizzes: `octyCompletedQuizzes:${userId}`,
  completedParcours: `octyCompletedParcours:${userId}`,
  progress: `octyProgress:${userId}`,
  xp: `octyUserXp:${userId}`,
});

export function getPocketBaseUser() {
  if (!hasStorage()) return null;
  const auth = parseJson(localStorage.getItem('pocketbase_auth'));
  return auth && typeof auth === 'object' && auth.model ? auth.model : null;
}

export function getCurrentUserId(fallback = 'guest') {
  if (!hasStorage()) return fallback;
  const storedId = localStorage.getItem('userId') || sessionStorage.getItem('userId');
  const pocketBaseUser = getPocketBaseUser();
  return storedId || pocketBaseUser?.id || fallback;
}

export function getStoredList(key) {
  if (!hasStorage()) return [];
  return uniqueStrings(parseJson(localStorage.getItem(key)));
}

const setStoredList = (key, items) => {
  if (!hasStorage()) return;
  localStorage.setItem(key, JSON.stringify(uniqueStrings(items)));
};

const getStoredLevel = (key) => {
  if (!hasStorage()) return 0;
  const value = Number.parseInt(localStorage.getItem(key) || '0', 10);
  return Number.isFinite(value) && value > 0 ? value : 0;
};

const persistSnapshot = (progress) => {
  if (!hasStorage()) return;
  const keys = progressKeys(progress.userId);
  localStorage.setItem(
    keys.progress,
    JSON.stringify({
      version: PROGRESS_SCHEMA_VERSION,
      updatedAt: new Date().toISOString(),
      xp: progress.xp,
      level: progress.level,
      completedQuizzes: progress.completedQuizzes,
      completedParcours: progress.completedParcours,
    })
  );
};

export function getUserProgress(userId = getCurrentUserId()) {
  const normalizedUserId = userId || 'guest';
  const keys = progressKeys(normalizedUserId);
  const completedQuizzes = getStoredList(keys.completedQuizzes);
  const completedParcours = getStoredList(keys.completedParcours);
  const storedLevel = getStoredLevel(keys.xp);
  const level = Math.max(storedLevel, completedQuizzes.length);
  const progress = {
    userId: normalizedUserId,
    xp: level,
    level,
    completedQuizzes,
    completedParcours,
  };

  if (hasStorage() && String(storedLevel) !== String(level)) {
    localStorage.setItem(keys.xp, String(level));
  }

  persistSnapshot(progress);
  return progress;
}

export function completeQuizProgress({ quizId, parcoursId, userId = getCurrentUserId() } = {}) {
  const normalizedUserId = userId || 'guest';
  const currentProgress = getUserProgress(normalizedUserId);

  if (!quizId || currentProgress.completedQuizzes.includes(String(quizId))) {
    return { awarded: false, progress: currentProgress };
  }

  const keys = progressKeys(normalizedUserId);
  const completedQuizzes = [...currentProgress.completedQuizzes, String(quizId)];
  const completedParcours = parcoursId
    ? [...currentProgress.completedParcours, String(parcoursId)]
    : currentProgress.completedParcours;
  const level = Math.max(currentProgress.level + 1, completedQuizzes.length);
  const progress = {
    userId: normalizedUserId,
    xp: level,
    level,
    completedQuizzes: uniqueStrings(completedQuizzes),
    completedParcours: uniqueStrings(completedParcours),
  };

  setStoredList(keys.completedQuizzes, progress.completedQuizzes);
  setStoredList(keys.completedParcours, progress.completedParcours);
  if (hasStorage()) {
    localStorage.setItem(keys.xp, String(progress.level));
  }
  persistSnapshot(progress);

  // Sync vers PocketBase en arrière-plan — ne bloque pas, silencieux si hors-ligne
  if (normalizedUserId && normalizedUserId !== 'guest') {
    const { level: lvl, xp: x } = progress;
    import('./backend.mjs')
      .then(({ syncProgressToPocketBase }) => syncProgressToPocketBase(normalizedUserId, lvl, x))
      .catch(() => {});
  }

  return { awarded: true, progress };
}

export function getProgressPercent(quizIds = [], completedQuizzes = []) {
  const ids = uniqueStrings(quizIds);
  if (!ids.length) return 0;

  const completed = new Set(uniqueStrings(completedQuizzes));
  const completedCount = ids.filter((quizId) => completed.has(quizId)).length;
  return Math.round((completedCount / ids.length) * 100);
}
