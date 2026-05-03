import { motion } from "framer-motion";
import { Target, Heart, Lightbulb, Users, ArrowRight } from "lucide-react";
import { ButtonWithIcon } from "@shared/ui/button";
import { Link } from "react-router-dom";

const features = [
  { icon: Target, title: "Real CBT exam simulation", gradient: "from-blue-500/20 to-primary/20", iconColor: "text-blue-600" },
  { icon: Lightbulb, title: "High-quality test content curated by expert academic teams", gradient: "from-primary/20 to-accent/20", iconColor: "text-primary" },
  { icon: Users, title: "Actionable analytics for teachers and students", gradient: "from-accent/20 to-purple-500/20", iconColor: "text-accent" },
  { icon: Heart, title: "Pay-per-student pricing with zero upfront cost", gradient: "from-purple-500/20 to-pink-500/20", iconColor: "text-purple-600" },
];

export function AboutSection() {
  return (
    <section className="section-padding section-4" id="about">
      <div className="container-main">
        {/* Header */}
        <motion.div
          className="text-center max-w-3xl mx-auto mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <span className="inline-block px-4 py-1.5 bg-primary/10 text-primary text-sm font-semibold rounded-full mb-4">
            About Us
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4">
            About{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">
              Univ.live
            </span>
          </h2>
          <p className="text-2xl text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent font-bold mb-4">
            Tayari Exam Jaisi.
          </p>
          <p className="text-lg text-muted-foreground">
            Univ.live is a technology platform built to help coaching centers deliver{" "}
            <strong className="text-foreground">real CUET CBT exam preparation</strong>—exactly the
            way the exam is conducted.
          </p>
        </motion.div>

        {/* Problem Card */}
        <motion.div
          className="max-w-4xl mx-auto mb-16"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <div className="bg-gradient-to-br from-card via-card to-primary/5 rounded-3xl p-8 lg:p-12 border-2 border-border shadow-card relative overflow-hidden">
            {/* Decorative element */}
            <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-primary/10 to-accent/10 rounded-full blur-3xl" />
            
            <p className="text-lg text-muted-foreground leading-relaxed mb-6 relative z-10">
              We exist to solve one simple but critical problem: most mock tests are still conducted
              on <strong className="text-foreground">OMR sheets</strong>, while the actual CUET exam
              is <strong className="text-foreground">computer-based (CBT)</strong>. This gap often
              leads to poor time management, confusion, and unnecessary panic on exam day.
            </p>
            <p className="text-lg font-semibold text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent relative z-10">
              Univ.live bridges this gap by enabling coaching centers to offer exam-realistic CBT
              practice to their students.
            </p>
          </div>
        </motion.div>

        {/* Why Univ.live */}
        <motion.div
          className="text-center max-w-3xl mx-auto mb-12"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <h3 className="text-2xl lg:text-3xl font-bold mb-4">Why Univ.live</h3>
          <p className="text-muted-foreground text-lg">
            We believe preparation should feel exactly like the real exam.
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {features.map((item, index) => (
            <motion.div
              key={item.title}
              className="bg-card rounded-2xl p-6 border border-border shadow-soft text-center hover-lift group"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: index * 0.1 }}
            >
              <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${item.gradient} flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300`}>
                <item.icon className={`h-7 w-7 ${item.iconColor}`} />
              </div>
              <p className="font-medium text-sm">{item.title}</p>
            </motion.div>
          ))}
        </div>

        <motion.div
          className="flex flex-wrap justify-center gap-6 text-muted-foreground mb-12"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          {["No installations.", "No fixed fees.", "No technical barriers."].map((text, i) => (
            <span key={text} className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-gradient-to-r from-primary to-accent" />
              {text}
            </span>
          ))}
        </motion.div>

        {/* CTA */}
        <motion.div
          className="flex flex-wrap justify-center gap-4"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <Link to="/about">
            <ButtonWithIcon variant="heroOutline" size="lg" className="group">
              Learn More About Us
              <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </ButtonWithIcon>
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
