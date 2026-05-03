export type StatItem = { label: string; value: string; icon?: string };
export type AchievementItem = { title: string; description: string; icon?: string };
export type FacultyItem = {
  name: string;
  subject?: string;
  designation?: string;
  experience?: string;
  bio?: string;
  image?: string;
};
export type TestimonialItem = {
  name: string;
  course?: string;
  rating?: number;
  text: string;
  avatar?: string;
};
export type FAQItem = { question: string; answer: string };

export type TestSeries = {
  id: string;
  title: string;
  description: string;
  price: string | number;
  coverImage?: string;
  subject?: string;
  difficulty?: string;
  testsCount?: number;
  durationMinutes?: number;
};
