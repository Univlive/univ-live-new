import { doc, onSnapshot } from "firebase/firestore";
import { useEffect, useState } from "react";
import { db } from "@shared/lib/firebase";

export type EducatorFeatures = {
  contentLibrary: boolean;
  chatbot: boolean;
  dpp: boolean;
};

// Fields default to true when not set — preserves access for existing educators.
const DEFAULTS: EducatorFeatures = { contentLibrary: true, chatbot: true, dpp: true };

export function useEducatorFeatures(educatorId: string | undefined) {
  const [features, setFeatures] = useState<EducatorFeatures>(DEFAULTS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!educatorId) { setLoading(false); return; }
    const unsub = onSnapshot(doc(db, "educators", educatorId), (snap) => {
      if (snap.exists()) {
        const f = (snap.data()?.features as Partial<EducatorFeatures>) || {};
        setFeatures({
          contentLibrary: f.contentLibrary ?? true,
          chatbot: f.chatbot ?? true,
          dpp: f.dpp ?? true,
        });
      }
      setLoading(false);
    });
    return unsub;
  }, [educatorId]);

  return { features, loading };
}
