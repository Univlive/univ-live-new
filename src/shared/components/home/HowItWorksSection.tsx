import { motion } from "framer-motion";
import { useInView } from "framer-motion";
import { useRef } from "react";
import { UserPlus, Wand2, Rocket, ArrowRight } from "lucide-react";
import { Button } from "@shared/ui/button";
import { Link } from "react-router-dom";

const steps = [
  {
    step: "01",
    icon: UserPlus,
    title: "Sign Up & Onboard",
    description:
      "Create your account in minutes. Fill in your coaching details, upload your logo, and choose your preferred theme.",
    bgColor: "bg-pastel-mint",
  },
  {
    step: "02",
    icon: Wand2,
    title: "AI Generates Your Site",
    description:
      "Our AI creates a fully branded website with your courses, content, and customized design in approximately 6 hours.",
    bgColor: "bg-pastel-yellow",
  },
  {
    step: "03",
    icon: Rocket,
    title: "Go Live & Grow",
    description:
      "Your website is ready! Start enrolling students, manage tests, track performance, and scale your coaching business.",
    bgColor: "bg-pastel-lavender",
  },
];

export default function HowItWorksSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section className="py-20 lg:py-32 relative overflow-hidden" ref={ref}>
      {/* Background */}
      <div className="absolute inset-0 bg-background -z-10" />

      <div className="container mx-auto px-4 lg:px-8">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center max-w-3xl mx-auto mb-16 lg:mb-20"
        >
          <span className="inline-block px-5 py-2 rounded-full bg-pastel-mint dark:bg-secondary text-sm font-medium text-foreground mb-4">
            How It Works
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-display font-bold mb-6">
            Three Steps to{" "}
            <span className="gradient-text">Transform</span> Your Coaching
          </h2>
          <p className="text-lg text-muted-foreground">
            Launch your professional coaching website with AI automation. 
            No technical skills required.
          </p>
        </motion.div>

        {/* Steps */}
        <div className="grid md:grid-cols-3 gap-6 lg:gap-8 mb-16">
          {steps.map((step, index) => (
            <motion.div
              key={step.step}
              initial={{ opacity: 0, y: 40 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: index * 0.15 }}
              className="relative group"
            >
              <div className={`${step.bgColor} dark:bg-secondary rounded-3xl p-8 h-full transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-card-hover`}>
                {/* Step Number */}
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl gradient-bg mb-6">
                  <span className="text-sm font-bold text-white">{step.step}</span>
                </div>

                {/* Icon */}
                <div className="w-16 h-16 rounded-2xl bg-card flex items-center justify-center mb-6 shadow-soft">
                  <step.icon className="w-8 h-8 text-primary" />
                </div>

                {/* Content */}
                <h3 className="text-xl font-display font-bold mb-3">{step.title}</h3>
                <p className="text-muted-foreground leading-relaxed">
                  {step.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="text-center"
        >
          <Button variant="gradient" size="lg" asChild className="rounded-full px-8 group">
            <Link to="/how-it-works">
              Learn More
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </Button>
        </motion.div>
      </div>
    </section>
  );
}
