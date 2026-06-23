import { db } from '../firebase';
import { collection, doc, getDocs, getDoc, addDoc, updateDoc, deleteDoc, query, where, orderBy, writeBatch } from 'firebase/firestore';
import { COLLECTIONS } from '../constants';
import { Course, LearningTopic, Lesson, Slide } from '../types';

export const learnAdminService = {
  // --- Courses ---
  async getCourses(): Promise<Course[]> {
    const q = query(collection(db, COLLECTIONS.LEARN_COURSES), orderBy('order', 'asc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Course));
  },
  
  async createCourse(data: Omit<Course, 'id'>): Promise<Course> {
    const docRef = await addDoc(collection(db, COLLECTIONS.LEARN_COURSES), data);
    return { id: docRef.id, ...data };
  },

  async updateCourse(id: string, data: Partial<Course>): Promise<void> {
    const docRef = doc(db, COLLECTIONS.LEARN_COURSES, id);
    await updateDoc(docRef, data);
  },

  async deleteCourse(id: string): Promise<void> {
    const docRef = doc(db, COLLECTIONS.LEARN_COURSES, id);
    await deleteDoc(docRef);
  },

  // --- Topics ---
  async getTopics(courseId: string): Promise<LearningTopic[]> {
    const q = query(collection(db, COLLECTIONS.LEARN_TOPICS), where('course_id', '==', courseId));
    const snapshot = await getDocs(q);
    const topics = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LearningTopic));
    return topics.sort((a, b) => a.order - b.order);
  },

  async createTopic(data: Omit<LearningTopic, 'id'>): Promise<LearningTopic> {
    const docRef = await addDoc(collection(db, COLLECTIONS.LEARN_TOPICS), data);
    return { id: docRef.id, ...data };
  },

  async updateTopic(id: string, data: Partial<LearningTopic>): Promise<void> {
    const docRef = doc(db, COLLECTIONS.LEARN_TOPICS, id);
    await updateDoc(docRef, data);
  },

  async deleteTopic(id: string): Promise<void> {
    const docRef = doc(db, COLLECTIONS.LEARN_TOPICS, id);
    await deleteDoc(docRef);
  },

  // --- Lessons ---
  async getLessons(topicId: string): Promise<Lesson[]> {
    const q = query(collection(db, COLLECTIONS.LEARN_LESSONS), where('topic_id', '==', topicId));
    const snapshot = await getDocs(q);
    const lessons = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Lesson));
    return lessons.sort((a, b) => a.order - b.order);
  },

  async createLesson(data: Omit<Lesson, 'id'>): Promise<Lesson> {
    const docRef = await addDoc(collection(db, COLLECTIONS.LEARN_LESSONS), data);
    return { id: docRef.id, ...data };
  },

  async updateLesson(id: string, data: Partial<Lesson>): Promise<void> {
    const docRef = doc(db, COLLECTIONS.LEARN_LESSONS, id);
    await updateDoc(docRef, data);
  },

  async deleteLesson(id: string): Promise<void> {
    const docRef = doc(db, COLLECTIONS.LEARN_LESSONS, id);
    await deleteDoc(docRef);
  },

  // --- Slides ---
  async getSlides(lessonId: string): Promise<Slide[]> {
    const q = query(collection(db, COLLECTIONS.LEARN_SLIDES), where('lesson_id', '==', lessonId));
    const snapshot = await getDocs(q);
    const slides = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Slide));
    return slides.sort((a, b) => a.order - b.order);
  },

  async createSlide(data: Omit<Slide, 'id'>): Promise<Slide> {
    const docRef = await addDoc(collection(db, COLLECTIONS.LEARN_SLIDES), data);
    return { id: docRef.id, ...data };
  },

  async updateSlide(id: string, data: Partial<Slide>): Promise<void> {
    const docRef = doc(db, COLLECTIONS.LEARN_SLIDES, id);
    await updateDoc(docRef, data);
  },

  async deleteSlide(id: string): Promise<void> {
    const docRef = doc(db, COLLECTIONS.LEARN_SLIDES, id);
    await deleteDoc(docRef);
  }
};
