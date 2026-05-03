import { motion } from "framer-motion";
import { useInView } from "framer-motion";
import { useRef } from "react";
import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@shared/ui/button";
import { Link } from "react-router-dom";

export default function CTASection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section className="py-20 lg:py-32 relative overflow-hidden" ref={ref}>
      <div className="container mx-auto px-4 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="relative rounded-[2rem] lg:rounded-[3rem] overflow-hidden"
        >
          {/* Background Gradient */}
          <div className="absolute inset-0 gradient-bg" />
          
          {/* Pattern Overlay */}
          <div
            className="absolute inset-0 opacity-10"
            style={{
              backgroundImage: `radial-gradient(circle at 2px 2px, white 1px, transparent 0)`,
              backgroundSize: "32px 32px",
            }}
          />

          {/* Decorative Elements */}
          <div className="absolute top-8 left-8 w-20 h-20 rounded-full bg-white/10" />
          <div className="absolute bottom-8 right-8 w-32 h-32 rounded-full bg-white/10" />
          <div className="absolute top-1/2 left-1/4 w-16 h-16 rounded-full bg-white/5" />

          {/* Content */}
          <div className="relative px-8 py-16 lg:px-16 lg:py-24 text-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={isInView ? { opacity: 1, scale: 1 } : {}}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-white/10 backdrop-blur-sm mb-6"
            >
              <Sparkles className="w-4 h-4 text-white" />
              <span className="text-sm font-medium text-white">
                Start your 14-day free trial
              </span>
            </motion.div>

            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="text-3xl sm:text-4xl lg:text-5xl font-display font-bold text-white mb-6 max-w-3xl mx-auto"
            >
              Ready to Transform Your Coaching Institute?
            </motion.h2>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="text-lg text-white/80 mb-10 max-w-2xl mx-auto"
            >
              Join 500+ coaching institutes already using UNIV.LIVE. 
              Get your AI-powered website in just 6 hours.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.5 }}
              className="flex flex-wrap items-center justify-center gap-4"
            >
              <Button
                size="xl"
                className="bg-white text-foreground hover:bg-white/90 hover:scale-105 transition-all shadow-xl rounded-full px-8"
                asChild
              >
                <Link to="/signup" className="group">
                  Get Started Free
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Link>
              </Button>
              <a href="https://calendly.com/info-univlive" target="_blank" rel="noopener noreferrer">
              <Button
                size="xl"
                variant="ghost"
                className="text-white hover:bg-white/10 rounded-full"
                asChild
              >
                Book a Demo
              </Button>
              </a>
            </motion.div>

            {/* Trust Badges */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={isInView ? { opacity: 1 } : {}}
              transition={{ duration: 0.6, delay: 0.6 }}
              className="mt-12 flex flex-wrap items-center justify-center gap-6 text-white/60 text-sm"
            >
              <span>✓ No credit card required</span>
              <span>✓ 14-day free trial</span>
              <span>✓ Cancel anytime</span>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
