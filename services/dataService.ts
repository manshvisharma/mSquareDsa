import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  getDocs, 
  query, 
  where, 
  orderBy,
  serverTimestamp,
  getDoc,
  setDoc,
  increment,
  writeBatch,
  deleteField
} from "firebase/firestore";
import { db } from "../firebase";
import { COLLECTIONS } from "../constants";
import { Sheet, Topic, SubPattern, Problem, UserProfile, Note } from "../types";

// Generic soft delete
export const softDelete = async (collectionName: string, id: string) => {
  const ref = doc(db, collectionName, id);
  await updateDoc(ref, { isDeleted: true });
};

// Generic restore
export const restoreItem = async (collectionName: string, id: string) => {
  const ref = doc(db, collectionName, id);
  await updateDoc(ref, { isDeleted: false });
};

export const reorderItem = async (
  collectionName: string, 
  item: { id: string, order: number }, 
  direction: 'up' | 'down',
  siblings: { id: string, order: number }[]
) => {
  const sorted = [...siblings].sort((a, b) => a.order - b.order);
  const currentIndex = sorted.findIndex(i => i.id === item.id);
  
  if (currentIndex === -1) return;
  
  const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
  
  if (targetIndex < 0 || targetIndex >= sorted.length) return;
  
  const targetItem = sorted[targetIndex];
  
  const batch = writeBatch(db);
  const itemRef = doc(db, collectionName, item.id);
  const targetRef = doc(db, collectionName, targetItem.id);
  
  batch.update(itemRef, { order: targetItem.order });
  batch.update(targetRef, { order: item.order });
  
  await batch.commit();
};

export const getChildCount = async (parentCollection: string, parentId: string): Promise<number> => {
  let childCollection = '';
  let foreignKey = '';

  if (parentCollection === COLLECTIONS.TOPICS) {
    childCollection = COLLECTIONS.SUBPATTERNS;
    foreignKey = 'topicId';
  } else if (parentCollection === COLLECTIONS.SUBPATTERNS) {
    childCollection = COLLECTIONS.PROBLEMS;
    foreignKey = 'subPatternId';
  } else {
    return 0;
  }

  const q = query(collection(db, childCollection), where(foreignKey, '==', parentId), where('isDeleted', '==', false));
  const snap = await getDocs(q);
  return snap.size;
};

// --- Fetching ---

export const getSheets = async (includeDeleted = false): Promise<Sheet[]> => {
  const ref = collection(db, COLLECTIONS.SHEETS);
  let q;
  if (!includeDeleted) {
    q = query(ref, where('isDeleted', '==', false));
  } else {
    q = query(ref);
  }
  const snapshot = await getDocs(q);
  const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Sheet));
  return data.sort((a, b) => b.createdAt - a.createdAt);
};

export const getTopics = async (sheetId: string): Promise<Topic[]> => {
  const ref = collection(db, COLLECTIONS.TOPICS);
  const q = query(ref, where('sheetId', '==', sheetId), where('isDeleted', '==', false));
  const snapshot = await getDocs(q);
  const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Topic));
  return data.sort((a, b) => a.order - b.order);
};

export const getSubPatterns = async (topicId: string): Promise<SubPattern[]> => {
  const ref = collection(db, COLLECTIONS.SUBPATTERNS);
  const q = query(ref, where('topicId', '==', topicId), where('isDeleted', '==', false));
  const snapshot = await getDocs(q);
  const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as SubPattern));
  return data.sort((a, b) => a.order - b.order);
};

export const getProblems = async (subPatternId: string): Promise<Problem[]> => {
  const ref = collection(db, COLLECTIONS.PROBLEMS);
  const q = query(ref, where('subPatternId', '==', subPatternId), where('isDeleted', '==', false));
  const snapshot = await getDocs(q);
  const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Problem));
  return data.sort((a, b) => a.order - b.order);
};

export const getProblemDictionary = async (problemIds: string[]): Promise<Record<string, Problem>> => {
  const pRef = collection(db, COLLECTIONS.PROBLEMS);
  const pSnap = await getDocs(query(pRef));
  const dict: Record<string, Problem> = {};
  const idSet = new Set(problemIds);
  pSnap.docs.forEach(d => {
      if (idSet.has(d.id)) {
          dict[d.id] = { id: d.id, ...d.data() } as Problem;
      }
  });
  return dict;
};

// --- Advanced Stats Fetching ---

export const getSheetsWithStats = async (userSolvedIds: Set<string>): Promise<(Sheet & { total: number, solved: number })[]> => {
  // 1. Fetch Sheets
  const sheets = await getSheets();
  if (sheets.length === 0) return [];

  // 2. Fetch ALL non-deleted problems (Optimized for small-medium datasets)
  // For larger datasets, we would denormalize counters onto the Sheet document.
  const pRef = collection(db, COLLECTIONS.PROBLEMS);
  const pSnap = await getDocs(query(pRef, where('isDeleted', '==', false)));
  const allProblems = pSnap.docs.map(d => ({ id: d.id, ...d.data() } as Problem));

  // 3. Fetch Structure map to link Problem -> SubPattern -> Topic -> Sheet
  const sRef = collection(db, COLLECTIONS.SUBPATTERNS);
  const sSnap = await getDocs(query(sRef));
  const subToTopic = new Map<string, string>(); // subId -> topicId
  sSnap.docs.forEach(d => subToTopic.set(d.id, d.data().topicId));

  const tRef = collection(db, COLLECTIONS.TOPICS);
  const tSnap = await getDocs(query(tRef));
  const topicToSheet = new Map<string, string>(); // topicId -> sheetId
  tSnap.docs.forEach(d => topicToSheet.set(d.id, d.data().sheetId));

  // 4. Aggregate
  const stats = new Map<string, { total: number, solved: number }>();
  
  allProblems.forEach(p => {
    const topicId = subToTopic.get(p.subPatternId);
    if (!topicId) return;
    const sheetId = topicToSheet.get(topicId);
    if (!sheetId) return;

    if (!stats.has(sheetId)) stats.set(sheetId, { total: 0, solved: 0 });
    const s = stats.get(sheetId)!;
    s.total++;
    if (userSolvedIds.has(p.id)) s.solved++;
  });

  return sheets.map(sheet => {
    const s = stats.get(sheet.id) || { total: 0, solved: 0 };
    return { ...sheet, ...s };
  });
};

// --- Notes System ---

export const saveNote = async (userId: string, problemId: string, content: string) => {
  const noteId = `${userId}_${problemId}`;
  const ref = doc(db, 'notes', noteId);
  await setDoc(ref, {
    userId,
    problemId,
    content,
    updatedAt: Date.now()
  });
};

export const getNotesForSheet = async (userId: string, problemIds: string[]): Promise<Record<string, string>> => {
  const ref = collection(db, 'notes');
  const q = query(ref, where('userId', '==', userId));
  const snap = await getDocs(q);
  
  const notesMap: Record<string, string> = {};
  snap.forEach(d => {
    const data = d.data() as Note;
    notesMap[data.problemId] = data.content;
  });
  return notesMap;
};

// --- Data Assembly ---

const sheetStructureCache = new Map<string, { timestamp: number, data: any }>();
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes for memory/localStorage

export const clearSheetCache = (sheetId?: string) => {
  if (sheetId) {
     sheetStructureCache.delete(sheetId);
     localStorage.removeItem(`sheet_cache_${sheetId}`);
  } else {
     sheetStructureCache.clear();
     Object.keys(localStorage).forEach(k => {
         if (k.startsWith('sheet_cache_')) localStorage.removeItem(k);
     });
  }
};

export const getSheetFullStructure = async (sheetId: string) => {
  const now = Date.now();
  
  // 1. Check memory cache
  const cached = sheetStructureCache.get(sheetId);
  if (cached && (now - cached.timestamp < CACHE_DURATION)) {
    return cached.data;
  }

  // 2. Check localStorage cache
  const localCachedStr = localStorage.getItem(`sheet_cache_${sheetId}`);
  if (localCachedStr) {
      try {
          const localCached = JSON.parse(localCachedStr);
          if (now - localCached.timestamp < CACHE_DURATION) {
              sheetStructureCache.set(sheetId, localCached);
              return localCached.data;
          }
      } catch (e) {}
  }

  const topics = await getTopics(sheetId);
  if (topics.length === 0) return [];

  const subPatternPromises = topics.map(t => getSubPatterns(t.id));
  const subPatternsNested = await Promise.all(subPatternPromises);

  const topicSubMap = new Map<string, SubPattern[]>();
  const allSubPatterns: SubPattern[] = [];
  
  topics.forEach((t, index) => {
    topicSubMap.set(t.id, subPatternsNested[index]);
    allSubPatterns.push(...subPatternsNested[index]);
  });

  const problemPromises = allSubPatterns.map(sp => getProblems(sp.id));
  const problemsNested = await Promise.all(problemPromises);

  const subProblemMap = new Map<string, Problem[]>();
  allSubPatterns.forEach((sp, index) => {
    subProblemMap.set(sp.id, problemsNested[index]);
  });

  const result = topics.map(t => ({
    ...t,
    subPatterns: (topicSubMap.get(t.id) || []).map(sp => ({
      ...sp,
      problems: subProblemMap.get(sp.id) || []
    }))
  }));

  const cachePayload = { timestamp: now, data: result };
  sheetStructureCache.set(sheetId, cachePayload);
  try {
      localStorage.setItem(`sheet_cache_${sheetId}`, JSON.stringify(cachePayload));
  } catch (e) {
      // Handle quota exceeded
  }
  
  return result;
};

export const toggleProblem = async (userId: string, problemId: string, isSolved: boolean) => {
  const userRef = doc(db, COLLECTIONS.USERS, userId);
  const userSnap = await getDoc(userRef);
  
  if (!userSnap.exists()) return;

  const userData = userSnap.data() as UserProfile;
  const now = Date.now();
  const today = new Date().toISOString().split('T')[0];

  const updates: any = {
    // FIX: Use deleteField() so we don't leave "null" values in the map that mess up stats
    [`completedProblems.${problemId}`]: isSolved ? now : deleteField(),
    lastActive: now,
  };

  if (!isSolved) {
     // Unsolving - simple remove
  } else {
     // Solving logic (Streaks)
     if (userData.lastSolvedDate !== today) {
        updates.lastSolvedDate = today;
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];

        if (userData.lastSolvedDate === yesterdayStr) {
           updates.currentStreak = increment(1);
           if ((userData.currentStreak + 1) > userData.maxStreak) {
             updates.maxStreak = (userData.currentStreak + 1);
           }
        } else {
           updates.currentStreak = 1;
           if (userData.maxStreak === 0) updates.maxStreak = 1;
        }
     }
  }

  await updateDoc(userRef, updates);
};

export const batchAddProblems = async (subPatternId: string, problems: Omit<Problem, 'id' | 'subPatternId' | 'isDeleted' | 'order'>[]) => {
  const batch = writeBatch(db);
  const problemRef = collection(db, COLLECTIONS.PROBLEMS);
  
  const existing = await getProblems(subPatternId);
  let startOrder = existing.length + 1;

  problems.forEach(p => {
    const newDoc = doc(problemRef);
    batch.set(newDoc, {
      ...p,
      subPatternId,
      order: startOrder++,
      isDeleted: false
    });
  });

  await batch.commit();
};

export const getSheetsFullSearch = async (queryStr: string): Promise<{sheet: Sheet, problems: Problem[]}[]> => {
  const allSheets = await getSheets();
  const allProblemsRef = collection(db, COLLECTIONS.PROBLEMS);
  // doing client side search across all problems since no full text search engine is available in Firebase
  const pSnap = await getDocs(query(allProblemsRef, where('isDeleted', '==', false)));
  const allProblems = pSnap.docs.map(d => ({ id: d.id, ...d.data() } as Problem));
  
  const lowerQuery = queryStr.toLowerCase();
  const matchedProblems = allProblems.filter(p => p.title.toLowerCase().includes(lowerQuery) || p.platform.toLowerCase().includes(lowerQuery));
  
  if (matchedProblems.length === 0) return [];

  // Need mapping logic
  const sRef = collection(db, COLLECTIONS.SUBPATTERNS);
  const sSnap = await getDocs(query(sRef));
  const subToTopic = new Map<string, string>();
  sSnap.docs.forEach(d => subToTopic.set(d.id, d.data().topicId));

  const tRef = collection(db, COLLECTIONS.TOPICS);
  const tSnap = await getDocs(query(tRef));
  const topicToSheet = new Map<string, string>();
  tSnap.docs.forEach(d => topicToSheet.set(d.id, d.data().sheetId));

  const result: Record<string, {sheet: Sheet, problems: Problem[]}> = {};
  
  matchedProblems.forEach(p => {
     const topicId = subToTopic.get(p.subPatternId);
     if (topicId) {
         const sheetId = topicToSheet.get(topicId);
         if (sheetId) {
             const sheet = allSheets.find(s => s.id === sheetId);
             if (sheet) {
                 if (!result[sheetId]) {
                     result[sheetId] = { sheet, problems: [] };
                 }
                 result[sheetId].problems.push(p);
             }
         }
     }
  });

  return Object.values(result);
};

export const getAllUsers = async (): Promise<UserProfile[]> => {
  const ref = collection(db, COLLECTIONS.USERS);
  const q = query(ref, orderBy('lastActive', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => d.data() as UserProfile);
};