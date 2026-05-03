import { motion } from "framer-motion";
import { Check, X, ArrowRight, Sparkles } from "lucide-react";
import { ButtonWithIcon } from "@shared/ui/button";
import { Link } from "react-router-dom";

const plans = [
  {
    name: "Essential Plan",
    originalPrice: 241,
    price: 169,
    description: "Best for small coaching centers starting with CBT",
    features: [
      "5-day free trial",
      "No restriction on subject selection",
      "1 full-length CBT tests per subject",
      "AI-powered advanced analytics",
      "Upload your own content (test series, questions & question banks)",
      "AI-powered solutions",
      "Complete student performance analytics",
      "Email support",
    ],
    cta: "Get Started",
    popular: false,
  },
  {
    name: "Growth Plan",
    originalPrice: 284,
    price: 199,
    description: "Best for growing coaching centers",
    features: [
      "Everything in Essential, plus:",
      "5-day free trial",
      "1 full-length CBT tests per subject",
      "Priority call & chat support",
      "Personalized preference sheet",
      "Mentorship sessions with top university & college students",
      "Exclusive WhatsApp teacher community (fast CUET updates & discussions)",
      "Complete post-CUET student support (results, counselling & admissions guidance)",
    ],
    cta: "Get Started",
    popular: true,
  },
];

const comparisonData = [
  { feature: "Cost per test paper", omr: "₹5 (printing + OMR)", univ: "₹0", omrBad: true },
  { feature: "No. of papers (5 subjects × 10 tests)", omr: "50 papers", univ: "More Than 50 Tests", omrBad: true },
  { feature: "Total cost", omr: "₹250 per student", univ: "₹169-₹199", omrBad: true },
  { feature: "Manual checking", omr: "Required", univ: "Automated", omrBad: true },
  { feature: "Instant results", omr: "No", univ: "Yes", omrBad: true },
  { feature: "Real computer based experience", omr: "No", univ: "Yes", omrBad: true },
  { feature: "Performance analytics", omr: "Not available", univ: "AI-powered Advance", omrBad: true },
  { feature: "Time & accuracy insights", omr: "No", univ: "Yes", omrBad: true },
];

export function PricingSection() {
  return (
    <section className="section-padding section-3" id="pricing">
      <div className="container-main">
        {/* Pricing Header */}
        <motion.div
          className="text-center max-w-3xl mx-auto mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <span className="inline-block px-4 py-1.5 bg-primary/10 text-primary text-sm font-semibold rounded-full mb-4">
            Simple Pricing
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">Pricing</span>
          </h2>
          <p className="text-lg text-muted-foreground">
            No setup fee. No fixed cost. Pay only for enrolled students.
          </p>
        </motion.div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto mb-24">
          {plans.map((plan, index) => (
            <motion.div
              key={plan.name}
              className={`bg-card rounded-3xl p-8 border-2 shadow-card relative hover-lift ${
                plan.popular
                  ? "border-primary ring-4 ring-primary/10"
                  : "border-border"
              }`}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: index * 0.1 }}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-primary to-accent text-primary-foreground text-sm font-semibold px-5 py-1.5 rounded-full flex items-center gap-2 shadow-lg">
                  <Sparkles className="h-4 w-4" />
                  Most Popular
                </div>
              )}

              <div className="mb-8">
                <h3 className="text-xl font-semibold mb-2">{plan.name}</h3>
                
                {/* Updated Price Display with Discount */}
                <div className="flex flex-col gap-1 mb-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xl font-bold text-muted-foreground line-through decoration-2">
                      ₹{plan.originalPrice}
                    </span>
                    <span className="text-xs font-bold text-green-700 bg-green-500/20 px-2.5 py-0.5 rounded-full dark:text-green-400 dark:bg-green-500/10">
                      30% OFF
                    </span>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-5xl lg:text-6xl font-extrabold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                      ₹{plan.price}
                    </span>
                    <span className="text-muted-foreground font-medium">/ Student</span>
                  </div>
                </div>

                <p className="text-muted-foreground">{plan.description}</p>
              </div>

              <Link to="/signup" className="block mb-8">
                <ButtonWithIcon
                  variant={plan.popular ? "hero" : "heroOutline"}
                  size="lg"
                  className="w-full justify-center group"
                >
                  {plan.cta}
                  <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </ButtonWithIcon>
              </Link>

              <ul className="space-y-4">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <Check className="h-3 w-3 text-primary" />
                    </div>
                    <span className="text-muted-foreground text-sm leading-relaxed">{feature}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>

        {/* Comparison Section */}
        <motion.div
          className="text-center max-w-3xl mx-auto mb-12"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <span className="inline-block px-4 py-1.5 bg-primary/10 text-primary text-sm font-semibold rounded-full mb-4">
            Comparison
          </span>
          <h3 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-4">
            OMR vs Univ.live CBT — Per Student Comparison
          </h3>
        </motion.div>

        <motion.div
          className="bg-card rounded-3xl border-2 border-border shadow-card overflow-hidden max-w-4xl mx-auto mb-12"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-border">
                  <th className="text-left p-5 font-bold">Feature / Cost Factor</th>
                  <th className="text-center p-5 font-bold bg-destructive/10 text-destructive">Traditional OMR Tests</th>
                  <th className="text-center p-5 font-bold bg-primary/10 text-primary">Univ.live CBT Platform</th>
                </tr>
              </thead>
              <tbody>
                {comparisonData.map((row, index) => (
                  <tr key={row.feature} className={`border-b border-border/50 ${index % 2 === 0 ? "bg-muted/30" : ""}`}>
                    <td className="p-4 font-medium text-sm">{row.feature}</td>
                    <td className="text-center p-4 bg-destructive/5">
                      <span className="inline-flex items-center gap-2 text-destructive text-sm">
                        <X className="h-4 w-4" />
                        {row.omr}
                      </span>
                    </td>
                    <td className="text-center p-4 bg-primary/5">
                      <span className="inline-flex items-center gap-2 text-primary text-sm font-medium">
                        <Check className="h-4 w-4" />
                        {row.univ}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* CTA Buttons */}
        <motion.div
          className="flex flex-wrap justify-center gap-4"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <Link to="/signup">
            <ButtonWithIcon variant="hero" size="lg" className="group">
              Get Started For Free
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