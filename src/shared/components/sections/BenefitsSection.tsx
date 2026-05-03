import { motion } from "framer-motion";
import { FileText, Users, Brain, Headphones, Gift, ArrowRight } from "lucide-react";
import { ButtonWithIcon } from "@shared/ui/button";
import { Link } from "react-router-dom";

const benefits = [
  {
    icon: FileText,
    title: "Real Exam–Like Test Experience",
    description: "Feels exactly like the actual CUET exam with authentic interface, timer, and navigation.",
    gradient: "from-orange-500/20 to-red-500/20",
    iconColor: "text-orange-600",
  },
  {
    icon: FileText,
    title: "10 Full-Length CUET Mock Tests",
    description: "Curated by top academic teams with case-based, fill-in-the-blanks, statement-based, match-the-following, and assertion-reasoning questions.",
    gradient: "from-blue-500/20 to-primary/20",
    iconColor: "text-blue-600",
  },
  {
    icon: Users,
    title: "Teacher-First Platform",
    description: "View detailed student performance reports and manage your batches with ease.",
    gradient: "from-primary/20 to-accent/20",
    iconColor: "text-primary",
  },
  {
    icon: Brain,
    title: "AI-Powered Advanced Analytics",
    description: "Question-wise accuracy, time taken per question/section, and clear identification of strengths and weak areas.",
    gradient: "from-accent/20 to-purple-500/20",
    iconColor: "text-accent",
  },
  {
    icon: Headphones,
    title: "Dedicated Support Team",
    description: "Helping you throughout the day with any queries or technical assistance.",
    gradient: "from-purple-500/20 to-pink-500/20",
    iconColor: "text-purple-600",
  },
  {
    icon: Gift,
    title: "100% Free Platform — Pay Only Per Student",
    description: "No setup fees, no upfront cost — you pay only when students enroll.",
    gradient: "from-pink-500/20 to-orange-500/20",
    iconColor: "text-pink-600",
  },
];

export function BenefitsSection() {
  return (
    <section className="section-padding section-3 overflow-hidden">
      <div className="container-main">
        <motion.div
          className="text-center max-w-3xl mx-auto mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <span className="inline-block px-4 py-1.5 bg-primary/10 text-primary text-sm font-semibold rounded-full mb-4">
            Why Choose Us
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4">
            Benefits of Univ — Why{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">Coaching Centers Love It!</span>
          </h2>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {benefits.map((benefit, index) => (
            <motion.div
              key={benefit.title}
              className="bg-card rounded-2xl p-6 border border-border shadow-soft hover-lift group"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: index * 0.1 }}
            >
              <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${benefit.gradient} flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300`}>
                <benefit.icon className={`h-7 w-7 ${benefit.iconColor}`} />
              </div>
              <h3 className="text-lg font-bold mb-3 group-hover:text-primary transition-colors">{benefit.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{benefit.description}</p>
            </motion.div>
          ))}
        </div>

        {/* CTA Buttons */}
        <motion.div
          className="flex flex-wrap justify-center gap-4"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <Link to="/signup">
            <ButtonWithIcon variant="hero" size="lg" className="group">
              Get Started for Free
              <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </ButtonWithIcon>
          </Link>
          <a href="https://calendly.com/info-univlive" target="_blank" rel="noopener noreferrer">
            <ButtonWithIcon variant="heroOutline" size="lg">
              Book a Demo
            </ButtonWithIcon>
          </a>
        </motion.div>
      </div>
    </section>
  );
}
