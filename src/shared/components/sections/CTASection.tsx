import { forwardRef } from "react";
import { motion } from "framer-motion";
import { ButtonWithIcon } from "@shared/ui/button";
import { Link } from "react-router-dom";
import { Sparkles, Zap, ArrowRight } from "lucide-react";

export const CTASection = forwardRef<HTMLElement>((_, ref) => {
  return (
    <section ref={ref} className="section-padding section-1">
      <div className="container-main">
        <motion.div
          className="relative bg-gradient-to-br from-primary via-accent to-primary rounded-3xl p-8 lg:p-16 text-center overflow-hidden"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          {/* Animated background elements */}
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute top-10 left-10 w-40 h-40 rounded-full bg-white/10 blur-3xl animate-pulse" />
            <div className="absolute bottom-10 right-10 w-60 h-60 rounded-full bg-white/10 blur-3xl animate-pulse" style={{ animationDelay: "1s" }} />
            <div className="absolute top-1/2 left-1/4 w-20 h-20 rounded-full bg-white/5 blur-2xl" />
            
            {/* Floating icons */}
            <motion.div
              className="absolute top-8 right-20"
              animate={{ y: [-5, 5, -5] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            >
              <Sparkles className="h-8 w-8 text-white/30" />
            </motion.div>
            <motion.div
              className="absolute bottom-12 left-16"
              animate={{ y: [5, -5, 5] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            >
              <Zap className="h-10 w-10 text-white/20" />
            </motion.div>
            <motion.div
              className="absolute top-1/3 right-1/4"
              animate={{ rotate: [0, 360] }}
              transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            >
              <Sparkles className="h-6 w-6 text-white/20" />
            </motion.div>
          </div>
          
          <div className="relative z-10">
            {/* Badge */}
            <motion.div
              className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm rounded-full px-4 py-2 mb-6"
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <Zap className="h-4 w-4 text-white" />
              <span className="text-sm font-medium text-white">No Payment Required</span>
            </motion.div>
            
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-primary-foreground mb-4">
              1 Free Computer Based Test per Subject
            </h2>
            <p className="text-primary-foreground/90 text-lg mb-8 max-w-2xl mx-auto">
              Experience the real CUET CBT environment before you commit. Start your free trial today!
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link to="/signup">
                <ButtonWithIcon
                  variant="heroOutline"
                  size="xl"
                  className="bg-white text-primary border-white hover:bg-white/90 shadow-lg group"
                >
                  Get Started For Free
                  <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </ButtonWithIcon>
              </Link>
              <a href="https://calendly.com/info-univlive" target="_blank" rel="noopener noreferrer">
                <ButtonWithIcon
                  variant="heroOutline"
                  size="xl"
                  className="text-white border-white/50 hover:bg-white/10 backdrop-blur-sm"
                >
                  Book a Demo
                </ButtonWithIcon>
              </a>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
});

CTASection.displayName = "CTASection";
