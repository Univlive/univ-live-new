import { motion } from "framer-motion";
import { UserPlus, ClipboardList, Palette, Rocket, Clock, Zap, CheckCircle2 } from "lucide-react";
import { ButtonWithIcon } from "@shared/ui/button";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

const steps = [
  {
    icon: UserPlus,
    number: "01",
    title: "Sign Up",
    subtitle: "Create your account instantly",
    description: "Register on Univ.live and access your dashboard within seconds.",
    visual: "signup",
  },
  {
    icon: ClipboardList,
    number: "02",
    title: "Complete Basic Details",
    subtitle: "Takes less than 2 minutes",
    description: "Fill a short form to set up your coaching institute profile.",
    visual: "form",
  },
  {
    icon: Palette,
    number: "03",
    title: "Choose Your Theme",
    subtitle: "Match your institute's brand",
    description: "Select a theme that reflects your coaching center's identity.",
    visual: "theme",
  },
  {
    icon: Rocket,
    number: "04",
    title: "Go Live",
    subtitle: "Start testing immediately",
    description: "Your branded test platform is ready to use.",
    visual: "live",
  },
];

// Visual components for each step card
const StepVisual = ({ type }: { type: string }) => {
  switch (type) {
    case "signup":
      return (
        <div className="bg-muted/50 rounded-2xl p-4 mt-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <UserPlus className="w-5 h-5 text-primary" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Welcome to</div>
              <div className="text-sm font-semibold text-foreground">Univ.live</div>
            </div>
          </div>
          <div className="space-y-2">
            <div className="h-8 bg-background rounded-lg border border-border flex items-center px-3">
              <span className="text-xs text-muted-foreground">Enter your email...</span>
            </div>
            <div className="h-8 bg-primary rounded-lg flex items-center justify-center">
              <span className="text-xs font-medium text-primary-foreground">Get Started</span>
            </div>
          </div>
        </div>
      );
    case "form":
      return (
        <div className="bg-muted/50 rounded-2xl p-4 mt-4">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-accent" />
            <span className="text-xs font-medium text-accent">~2 min</span>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              <span className="text-xs text-foreground">Institute Name</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              <span className="text-xs text-foreground">Contact Details</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/30" />
              <span className="text-xs text-muted-foreground">Location</span>
            </div>
          </div>
          <div className="mt-3 h-1.5 bg-background rounded-full overflow-hidden">
            <div className="h-full w-2/3 bg-gradient-to-r from-primary to-accent rounded-full" />
          </div>
        </div>
      );
    case "theme":
      return (
        <div className="bg-muted/50 rounded-2xl p-4 mt-4">
          <div className="text-xs text-muted-foreground mb-2">Select Theme</div>
          <div className="grid grid-cols-3 gap-2">
            <div className="aspect-square rounded-lg bg-gradient-to-br from-primary to-accent ring-2 ring-primary ring-offset-2 ring-offset-muted/50" />
            <div className="aspect-square rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500" />
            <div className="aspect-square rounded-lg bg-gradient-to-br from-orange-500 to-red-500" />
            <div className="aspect-square rounded-lg bg-gradient-to-br from-green-500 to-emerald-500" />
            <div className="aspect-square rounded-lg bg-gradient-to-br from-purple-500 to-pink-500" />
            <div className="aspect-square rounded-lg bg-gradient-to-br from-gray-700 to-gray-900" />
          </div>
        </div>
      );
    case "live":
      return (
        <div className="bg-muted/50 rounded-2xl p-4 mt-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs font-medium text-green-600">Live</span>
            </div>
            <Zap className="w-4 h-4 text-accent" />
          </div>
          <div className="bg-background rounded-lg p-3 border border-border">
            <div className="text-xs text-muted-foreground mb-1">Your Platform</div>
            <div className="text-sm font-semibold text-foreground">yourcoaching.univ.live</div>
          </div>
          <div className="mt-3 flex gap-2">
            <div className="flex-1 h-6 bg-primary/10 rounded flex items-center justify-center">
              <span className="text-[10px] font-medium text-primary">Share Link</span>
            </div>
            <div className="flex-1 h-6 bg-accent/10 rounded flex items-center justify-center">
              <span className="text-[10px] font-medium text-accent">Dashboard</span>
            </div>
          </div>
        </div>
      );
    default:
      return null;
  }
};

export function StepsSection() {
  return (
    <section className="section-padding bg-gradient-to-b from-background to-muted/30">
      <div className="container-main">
        <motion.div
          className="text-center max-w-3xl mx-auto mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <span className="inline-block px-4 py-1.5 bg-primary/10 text-primary text-sm font-semibold rounded-full mb-4">
            How It Works
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4">
            Get Started in{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">4 Simple Steps</span>
          </h2>
          <p className="text-muted-foreground text-lg">
            Launch your branded test platform in minutes, not weeks
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {steps.map((step, index) => (
            <motion.div
              key={step.title}
              className="relative bg-card rounded-3xl p-6 border border-border shadow-soft hover:shadow-elevated transition-all duration-300 group"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: index * 0.1 }}
            >
              {/* Step number */}
              <div className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent text-white text-xs font-bold flex items-center justify-center shadow-lg">
                {step.number}
              </div>

              {/* Title & Description */}
              <h3 className="text-xl font-bold text-foreground mb-1">{step.title}</h3>
              <p className="text-sm font-medium text-primary mb-2">{step.subtitle}</p>
              <p className="text-sm text-muted-foreground leading-relaxed">{step.description}</p>

              {/* Visual Element */}
              <StepVisual type={step.visual} />

              {/* Connection arrow for desktop */}
              {index < steps.length - 1 && (
                <div className="hidden lg:flex absolute top-1/2 -right-3 transform -translate-y-1/2 z-10">
                  <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center">
                    <ArrowRight className="w-3 h-3 text-muted-foreground" />
                  </div>
                </div>
              )}
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
