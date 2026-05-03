import  Layout  from "@widgets/layout/Layout";
import SEO from "@shared/components/SEO";
import { motion } from "framer-motion";
import { FileText, Users, Brain, Headphones, Gift, CheckCircle } from "lucide-react";

const features = [
  {
    icon: FileText,
    title: "10 Full-Length CUET Mock Tests",
    description: "Curated by top academic teams with case-based, fill-in-the-blanks, statement-based, match-the-following, and assertion-reasoning questions for Commerce & Humanities.",
  },
  {
    icon: Users,
    title: "Teacher-First Platform",
    description: "View detailed student performance reports, manage batches, and track progress with an intuitive dashboard designed for educators.",
  },
  {
    icon: Brain,
    title: "AI-Powered Advanced Analytics",
    description: "Question-wise accuracy, time taken per question/section, and clear identification of strengths and weak areas for every student.",
  },
  {
    icon: Headphones,
    title: "Dedicated Support Team",
    description: "Our support team is available throughout the day to help you with any queries or technical assistance you may need.",
  },
  {
    icon: Gift,
    title: "100% Free Platform — Pay Only Per Student",
    description: "No setup fees, no upfront cost — you pay only when students enroll. Start risk-free today.",
  },
  {
    icon: CheckCircle,
    title: "Real CBT Exam Experience",
    description: "Provide students with an authentic computer-based test experience that mirrors the actual CUET exam environment.",
  },
];

const Features = () => {
  return (
    <Layout>
      <SEO
        title="Features — AI-Powered Test Series & Coaching Management | Univ.live"
        description="Explore Univ.live features: AI question import, objective & subjective tests, student analytics, AI chatbot tutor, rankings, and support for JEE, NEET, CUET, CBSE and all exams."
        canonical="https://univlive.tech/features"
      />
      <section className="section-padding section-1">
        <div className="container-main">
          <motion.div
            className="text-center max-w-3xl mx-auto mb-16"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6">
              Features
            </h1>
            <p className="text-lg text-muted-foreground">
              Everything you need to launch and manage your own CUET CBT test platform.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                className="bg-card rounded-3xl p-8 border border-border shadow-soft hover-lift"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
              >
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center mb-6">
                  <feature.icon className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default Features;