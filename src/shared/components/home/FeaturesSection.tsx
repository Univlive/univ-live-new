import { motion } from "framer-motion";
import { useInView } from "framer-motion";
import { useRef } from "react";
import {
  Globe,
  BarChart3,
  Users,
  FileCheck,
  Brain,
  Shield,
  Zap,
  Smartphone,
} from "lucide-react";

const features = [
  {
    icon: Globe,
    title: "Branded Subdomain",
    description: "Get your own yourcoaching.univ.live subdomain with custom branding and design.",
    bgColor: "bg-pastel-mint",
  },
  {
    icon: BarChart3,
    title: "Analytics Dashboard",
    description: "Track student performance, test results, and revenue with detailed insights.",
    bgColor: "bg-pastel-yellow",
  },
  {
    icon: FileCheck,
    title: "Test Management",
    description: "Import or create tests easily. Support for MCQ, subjective, and mixed formats.",
    bgColor: "bg-pastel-lavender",
  },
  {
    icon: Users,
    title: "Student Portal",
    description: "Dedicated portal for students to access courses, take tests, and track progress.",
    bgColor: "bg-pastel-peach",
  },
  {
    icon: Brain,
    title: "AI-Powered Review",
    description: "Intelligent answer analysis and personalized feedback for every student.",
    bgColor: "bg-pastel-pink",
  },
  {
    icon: Shield,
    title: "Secure Platform",
    description: "Enterprise-grade security with encrypted data and access controls.",
    bgColor: "bg-pastel-mint",
  },
  {
    icon: Zap,
    title: "Instant Setup",
    description: "AI generates your complete website in just 6 hours. No coding required.",
    bgColor: "bg-pastel-yellow",
  },
  {
    icon: Smartphone,
    title: "Mobile Optimized",
    description: "Responsive design that works perfectly on all devices and screen sizes.",
    bgColor: "bg-pastel-lavender",
  },
];

export default function FeaturesSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section className="py-20 lg:py-32 relative bg-pastel-cream dark:bg-surface" ref={ref}>
      <div className="container mx-auto px-4 lg:px-8">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center max-w-3xl mx-auto mb-16"
        >
          <span className="inline-block px-5 py-2 rounded-full bg-pastel-lavender dark:bg-secondary text-sm font-medium text-foreground mb-4">
            Features
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-display font-bold mb-6">
            Everything You Need to{" "}
            <span className="gradient-text">Succeed</span>
          </h2>
          <p className="text-lg text-muted-foreground">
            A comprehensive platform designed for modern coaching institutes and ambitious students.
          </p>
        </motion.div>

        {/* Features Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 30 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: index * 0.08 }}
              className="group"
            >
              <div className={`${feature.bgColor} dark:bg-card rounded-3xl p-6 h-full border border-border/20 dark:border-border/50 transition-all duration-300 hover:-translate-y-1 hover:shadow-card-hover`}>
                {/* Icon Container */}
                <div className="w-14 h-14 rounded-2xl bg-card dark:bg-secondary flex items-center justify-center mb-5 shadow-soft group-hover:scale-105 transition-transform duration-300">
                  <feature.icon className="w-7 h-7 text-primary" />
                </div>

                {/* Content */}
                <h3 className="text-lg font-display font-bold mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
