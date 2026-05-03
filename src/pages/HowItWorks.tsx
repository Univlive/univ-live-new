import { motion } from "framer-motion";
import Navbar from "@widgets/layout/Navbar";
import Footer from "@widgets/layout/Footer";
import { UserPlus, Palette, Wand2, Clock, Rocket, Settings, ArrowRight } from "lucide-react";
import { Button } from "@shared/ui/button";
import { Link } from "react-router-dom";

const steps = [
  {
    icon: UserPlus,
    title: "Create Your Account",
    description: "Sign up in under 2 minutes with your basic details. Choose your role as an educator or institution.",
    duration: "2 min",
  },
  {
    icon: Settings,
    title: "Complete Onboarding",
    description: "Fill in your coaching details, upload your logo, add courses, and set up your batches.",
    duration: "15 min",
  },
  {
    icon: Palette,
    title: "Choose Your Theme",
    description: "Select from beautifully designed templates. Customize colors to match your brand identity.",
    duration: "5 min",
  },
  {
    icon: Wand2,
    title: "AI Website Generation",
    description: "Our AI analyzes your inputs and generates a fully functional, SEO-optimized website.",
    duration: "~6 hours",
  },
  {
    icon: Clock,
    title: "Review & Customize",
    description: "Preview your generated website. Make final tweaks to content, images, and layout.",
    duration: "30 min",
  },
  {
    icon: Rocket,
    title: "Go Live!",
    description: "Publish your website on your branded subdomain. Start enrolling students immediately.",
    duration: "Instant",
  },
];

export default function HowItWorks() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="pt-24 pb-20">
        {/* Hero */}
        <section className="container mx-auto px-4 lg:px-8 py-16 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <span className="inline-block px-4 py-1.5 rounded-full bg-brand-start/10 text-sm font-medium text-brand-blue mb-4">
              How It Works
            </span>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-display font-bold mb-6">
              From Zero to <span className="gradient-text">Live Website</span>
              <br />in Just 6 Hours
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              A simple, guided process to transform your coaching institute with AI-powered technology.
            </p>
          </motion.div>
        </section>

        {/* Timeline */}
        <section className="container mx-auto px-4 lg:px-8 py-16">
          <div className="max-w-4xl mx-auto">
            {steps.map((step, index) => (
              <motion.div
                key={step.title}
                initial={{ opacity: 0, x: -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="relative pl-12 lg:pl-16 pb-12 last:pb-0"
              >
                {/* Timeline Line */}
                {index < steps.length - 1 && (
                  <div className="absolute left-[18px] lg:left-[22px] top-12 bottom-0 w-0.5 bg-gradient-to-b from-brand-start to-brand-end" />
                )}

                {/* Icon */}
                <div className="absolute left-0 w-10 h-10 lg:w-12 lg:h-12 rounded-xl gradient-bg flex items-center justify-center shadow-glow">
                  <step.icon className="w-5 h-5 lg:w-6 lg:h-6 text-white" />
                </div>

                {/* Content */}
                <div className="bg-card rounded-2xl p-6 lg:p-8 border border-border/50 shadow-card hover:shadow-card-hover transition-all">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xl font-display font-bold">{step.title}</h3>
                    <span className="px-3 py-1 rounded-full bg-secondary text-sm font-medium text-muted-foreground">
                      {step.duration}
                    </span>
                  </div>
                  <p className="text-muted-foreground">{step.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="container mx-auto px-4 lg:px-8 py-16">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center"
          >
            <h2 className="text-3xl font-display font-bold mb-6">
              Ready to Get Started?
            </h2>
            <Button variant="hero" size="xl" asChild className="group">
              <Link to="/signup">
                Create Your Website Now
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
            </Button>
          </motion.div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
