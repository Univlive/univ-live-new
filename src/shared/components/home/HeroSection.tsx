import { motion } from "framer-motion";
import { ArrowRight, Play, Users, GraduationCap, BookOpen, Search } from "lucide-react";
import { Button } from "@shared/ui/button";
import { Link } from "react-router-dom";

const stats = [
  { value: "25 Lakh+", label: "Students", bgColor: "bg-pastel-mint" },
  { value: "10 Lakh+", label: "App Downloads", bgColor: "bg-pastel-yellow" },
  { value: "1.8 Lakh+", label: "Teaching Hours", bgColor: "bg-pastel-lavender" },
  { value: "24,000+", label: "Learning Courses", bgColor: "bg-pastel-peach" },
];

const categories = [
  "Engineering Courses",
  "MBA Courses", 
  "Language Courses",
  "SSC & PSC Courses",
  "Creative Courses",
  "Health & Nursing"
];

export default function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center overflow-hidden pt-20 pb-12">
      {/* Background */}
      <div className="absolute inset-0 -z-10 bg-pastel-cream dark:bg-background" />
      
      <div className="container mx-auto px-4 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left Content */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          >
            {/* Headline */}
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-4xl sm:text-5xl lg:text-6xl font-display font-bold leading-tight mb-6"
            >
              <span className="gradient-text">Education</span> is the
              <br />
              Key of Success
            </motion.h1>

            {/* Subheadline */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-lg lg:text-xl text-muted-foreground leading-relaxed mb-8 max-w-lg"
            >
              Launch your AI-powered coaching website in just 6 hours. 
              Advanced CBT practice platform for students. One platform, endless possibilities.
            </motion.p>

            {/* Search Bar Style CTA */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="relative mb-8"
            >
              <div className="bg-card rounded-2xl p-2 shadow-card border border-border/30 flex items-center gap-2 max-w-lg">
                <div className="flex-1 flex items-center gap-3 px-4">
                  <Search className="w-5 h-5 text-muted-foreground" />
                  <span className="text-muted-foreground text-sm">Search Your Courses</span>
                </div>
                <Button variant="gradient" className="rounded-xl px-6">
                  <ArrowRight className="w-5 h-5" />
                </Button>
              </div>
            </motion.div>

            {/* Category Pills */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="flex flex-wrap gap-2 mb-10"
            >
              {categories.map((category, index) => (
                <span
                  key={category}
                  className="px-4 py-2 rounded-full bg-card border border-border/30 text-sm font-medium text-foreground hover:border-primary/50 transition-colors cursor-pointer"
                >
                  {category}
                </span>
              ))}
            </motion.div>
          </motion.div>

          {/* Right Content - Hero Image/Illustration */}
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.3, ease: "easeOut" }}
            className="relative"
          >
            {/* Main Hero Visual */}
            <div className="relative bg-pastel-mint dark:bg-surface rounded-[2rem] p-6 lg:p-8 overflow-hidden">
              {/* Decorative elements */}
              <div className="absolute top-4 right-4 w-16 h-16 rounded-full bg-pastel-yellow dark:bg-pastel-yellow/30" />
              <div className="absolute bottom-8 left-8 w-12 h-12 rounded-full bg-pastel-lavender dark:bg-pastel-lavender/30" />
              
              {/* Hero Content */}
              <div className="relative z-10 text-center py-8">
                <div className="w-24 h-24 mx-auto mb-6 rounded-full gradient-bg flex items-center justify-center">
                  <GraduationCap className="w-12 h-12 text-white" />
                </div>
                <h3 className="text-xl font-display font-bold mb-3">Your Coaching, Your Brand</h3>
                <p className="text-muted-foreground text-sm mb-6 max-w-xs mx-auto">
                  AI-generated professional websites for coaching institutes
                </p>
                
                {/* Mini Dashboard Preview */}
                <div className="bg-card rounded-2xl p-4 shadow-card border border-border/30 mx-auto max-w-sm">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full gradient-bg flex items-center justify-center">
                      <span className="text-white font-bold text-sm">EA</span>
                    </div>
                    <div className="text-left">
                      <p className="font-semibold text-sm">Elite Academy</p>
                      <p className="text-xs text-muted-foreground">yourcoaching.univ.live</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-pastel-mint dark:bg-secondary rounded-xl p-2 text-center">
                      <p className="font-bold text-sm gradient-text">1,247</p>
                      <p className="text-xs text-muted-foreground">Students</p>
                    </div>
                    <div className="bg-pastel-yellow dark:bg-secondary rounded-xl p-2 text-center">
                      <p className="font-bold text-sm gradient-text">156</p>
                      <p className="text-xs text-muted-foreground">Tests</p>
                    </div>
                    <div className="bg-pastel-lavender dark:bg-secondary rounded-xl p-2 text-center">
                      <p className="font-bold text-sm gradient-text">₹4.2L</p>
                      <p className="text-xs text-muted-foreground">Revenue</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Floating Badge */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.8 }}
              className="absolute -left-4 top-1/4 bg-card rounded-2xl p-4 shadow-card-hover border border-border/30 animate-float"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-pastel-mint dark:bg-secondary flex items-center justify-center">
                  <Users className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-bold text-sm">50+</p>
                  <p className="text-xs text-muted-foreground">Institutes</p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>

        {/* Stats Section */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="mt-16 lg:mt-24"
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 lg:gap-6">
            {stats.map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.6 + index * 0.1 }}
                className={`${stat.bgColor} dark:bg-secondary rounded-2xl lg:rounded-3xl p-6 text-center`}
              >
                <p className="text-2xl lg:text-3xl font-display font-bold text-foreground mb-1">
                  {stat.value}
                </p>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
