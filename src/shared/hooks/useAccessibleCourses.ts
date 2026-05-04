import { useEffect, useState } from "react";
import { doc, getDoc, getDocs, collection } from "firebase/firestore";
import { db } from "@shared/lib/firebase";

export type GlobalCourse = { id: string; name: string };
export type GlobalSubject = { id: string; name: string; courseId: string };

type Result = {
  courses: GlobalCourse[];
  subjects: GlobalSubject[];
  allowedSubjectIds: string[];
  loading: boolean;
};

export function useAccessibleCourses(educatorId: string): Result {
  const [courses, setCourses] = useState<GlobalCourse[]>([]);
  const [subjects, setSubjects] = useState<GlobalSubject[]>([]);
  const [allowedSubjectIds, setAllowedSubjectIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!educatorId) { setLoading(false); return; }

    async function load() {
      setLoading(true);
      try {
        const eduSnap = await getDoc(doc(db, "educators", educatorId));
        const ids: string[] = eduSnap.exists() ? (eduSnap.data().allowedSubjectIds ?? []) : [];
        setAllowedSubjectIds(ids);

        if (ids.length === 0) { setCourses([]); setSubjects([]); return; }

        // Load allowed subjects
        const subjectSnap = await getDocs(collection(db, "subjects"));
        const allSubjects: GlobalSubject[] = subjectSnap.docs.map((d) => ({
          id: d.id,
          name: d.data().name as string,
          courseId: d.data().courseId as string,
        }));
        const allowedSubjects = allSubjects.filter((s) => ids.includes(s.id));
        setSubjects(allowedSubjects);

        // Derive unique courseIds from allowed subjects
        const courseIds = [...new Set(allowedSubjects.map((s) => s.courseId).filter(Boolean))];
        if (courseIds.length === 0) { setCourses([]); return; }

        // Load those courses
        const courseSnaps = await Promise.all(courseIds.map((id) => getDoc(doc(db, "courses", id))));
        setCourses(
          courseSnaps
            .filter((d) => d.exists() && d.data()?.isActive !== false)
            .map((d) => ({ id: d.id, name: d.data()!.name as string }))
        );
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [educatorId]);

  return { courses, subjects, allowedSubjectIds, loading };
}
