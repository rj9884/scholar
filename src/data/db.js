const DB_NAME = 'scholar-db';
const DB_VERSION = 1;
const TEACHERS_STORE = 'teachers';
const STUDENTS_STORE = 'students';

const openDB = () =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(TEACHERS_STORE)) {
        db.createObjectStore(TEACHERS_STORE, { keyPath: 'email' });
      }
      if (!db.objectStoreNames.contains(STUDENTS_STORE)) {
        const store = db.createObjectStore(STUDENTS_STORE, { keyPath: 'id', autoIncrement: true });
        store.createIndex('byTeacher', 'teacherEmail', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const runTransaction = async (storeName, mode, action) => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    const request = action(store);
    tx.oncomplete = () => resolve(request?.result);
    tx.onerror = () => reject(tx.error);
  });
};

export const setupDB = () => openDB();

export const getAllTeachers = async () =>
  runTransaction(TEACHERS_STORE, 'readonly', (store) => store.getAll());

export const addTeacher = async (teacher) => {
  return runTransaction(TEACHERS_STORE, 'readwrite', (store) => store.add(teacher));
};

export const validateTeacher = async (email, password) => {
  const teacher = await runTransaction(TEACHERS_STORE, 'readonly', (store) => store.get(email));
  if (teacher && teacher.password === password) return teacher;
  return null;
};

export const upsertStudent = async (student) => {
  const clean = { ...student };
  if (!clean.id) delete clean.id; // allow auto increment on insert
  return runTransaction(STUDENTS_STORE, 'readwrite', (store) => store.put(clean));
};

export const deleteStudent = async (id) =>
  runTransaction(STUDENTS_STORE, 'readwrite', (store) => store.delete(id));

export const clearTeacherStudents = async (teacherEmail) => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STUDENTS_STORE, 'readwrite');
    const store = tx.objectStore(STUDENTS_STORE);
    const index = store.index('byTeacher');
    const range = IDBKeyRange.only(teacherEmail);
    const request = index.openCursor(range);

    request.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

export const getStudentsForTeacher = async (teacherEmail) => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STUDENTS_STORE, 'readonly');
    const store = tx.objectStore(STUDENTS_STORE);
    const index = store.index('byTeacher');
    const range = IDBKeyRange.only(teacherEmail);
    const students = [];
    const request = index.openCursor(range);

    request.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        students.push(cursor.value);
        cursor.continue();
      }
    };

    tx.oncomplete = () => resolve(students);
    tx.onerror = () => reject(tx.error);
  });
};
