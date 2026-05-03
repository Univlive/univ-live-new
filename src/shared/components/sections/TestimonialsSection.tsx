import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Star, Quote } from "lucide-react";

const testimonials = [
  {
    name: "Ankit Jain",
    role: "CUET Aspirant",
    avatar: "AJ",
    rating: 5,
    quote:
      "I gave multiple CUET mocks through Univ.live. The analytics clearly showed where I was losing marks, especially in time management.",
  },
  {
    name: "Amit Sharma",
    role: "SEA Classes, Indore",
    avatar: "AS",
    rating: 5,
    quote:
      "Univ.live is very teacher-friendly. At SEA Classes, Indore, we use it mainly for mock tests and student analysis, and it saves us a lot of manual work.",
  },
  {
    name: "Rajesh Verma",
    role: "Apex Commerce Academy, Jaipur",
    avatar: "RV",
    rating: 5,
    quote:
      "We started using Univ.live for our CUET mock tests at Apex Commerce Academy, Jaipur, and the transition was smooth. Our students adapted quickly, and the test experience feels very close to the real exam.",
  },
  {
    name: "Neha Sharma",
    role: "CUET Faculty, Bright Future Classes",
    avatar: "NS",
    rating: 5,
    quote:
      "The performance reports on Univ.live helped us identify weak areas much faster. At Bright Future Classes, Shivpuri, this has improved how we plan our revision sessions.",
  },
];

export function TestimonialsSection() {
  const [currentIndex, setCurrentIndex] = useState(0);

  const nextSlide = () => {
    setCurrentIndex((prev) => (prev + 1) % testimonials.length);
  };

  const prevSlide = () => {
    setCurrentIndex((prev) => (prev - 1 + testimonials.length) % testimonials.length);
  };

  return (
    <section className="section-padding section-4 overflow-hidden">
      <div className="container-main">
        <motion.div
          className="text-center max-w-2xl mx-auto mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <span className="inline-block px-4 py-1.5 bg-primary/10 text-primary text-sm font-semibold rounded-full mb-4">
            Testimonials
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4">
            What Coaching Centers Say About{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">Univ.live</span>
          </h2>
        </motion.div>

        {/* Carousel */}
        <div className="relative max-w-4xl mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentIndex}
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              transition={{ duration: 0.3 }}
              className="bg-card rounded-3xl p-8 lg:p-12 border-2 border-border shadow-card relative"
            >
              {/* Large quote icon */}
              <Quote className="absolute top-6 right-6 h-16 w-16 text-primary/10" />
              
              {/* Header */}
              <div className="flex items-center gap-5 mb-6">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg">
                  <span className="text-xl font-bold text-primary-foreground">{testimonials[currentIndex].avatar}</span>
                </div>
                <div>
                  <div className="font-bold text-lg">{testimonials[currentIndex].name}</div>
                  <div className="text-muted-foreground">{testimonials[currentIndex].role}</div>
                </div>
              </div>

              {/* Rating */}
              <div className="flex gap-1 mb-6">
                {[...Array(testimonials[currentIndex].rating)].map((_, i) => (
                  <Star key={i} className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                ))}
              </div>

              {/* Quote */}
              <p className="text-lg lg:text-xl text-foreground leading-relaxed">
                "{testimonials[currentIndex].quote}"
              </p>
            </motion.div>
          </AnimatePresence>

          {/* Dots indicator */}
          <div className="flex items-center justify-center gap-2 mt-8">
            {testimonials.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentIndex(index)}
                className={`w-3 h-3 rounded-full transition-all duration-300 ${
                  index === currentIndex 
                    ? "bg-gradient-to-r from-primary to-accent w-8" 
                    : "bg-muted hover:bg-muted-foreground/30"
                }`}
              />
            ))}
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-center gap-4 mt-6">
            <button
              onClick={prevSlide}
              className="w-12 h-12 rounded-full bg-card border-2 border-border flex items-center justify-center text-foreground shadow-soft hover:shadow-elevated hover:border-primary transition-all hover:-translate-y-0.5"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={nextSlide}
              className="w-12 h-12 rounded-full bg-gradient-to-r from-primary to-accent flex items-center justify-center text-primary-foreground shadow-soft hover:shadow-elevated transition-all hover:-translate-y-0.5"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
