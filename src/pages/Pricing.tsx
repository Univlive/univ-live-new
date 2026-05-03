import { useState } from "react";
import  Layout  from "@widgets/layout/Layout";
import SEO from "@shared/components/SEO";
import { motion } from "framer-motion";
import { Check, X } from "lucide-react";
import { ButtonWithIcon } from "@shared/ui/button";
import { Link } from "react-router-dom";

const plans = [
  {
    name: "Essential Plan",
    price: 169,
    description: "Best for small coaching centers starting with CBT",
    features: [
      "5-day free trial",
      "No restriction on subject selection",
      "10 full-length CBT tests per subject",
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
    price: 199,
    description: "Best for growing coaching centers",
    features: [
      "Everything in Essential, plus:",
      "5-day free trial",
      "Priority call & chat support",
      "Personalized preference sheet",
      "1-on-1 mentorship with top university & college students",
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

const Pricing = () => {
  return (
    <Layout>
      <SEO
        title="Pricing Plans — Affordable AI Test Series Platform for Coaching | Univ.live"
        description="Choose the right plan for your coaching institute. Univ.live offers affordable pricing for AI-powered test series covering JEE, NEET, CUET, CBSE and more."
        canonical="https://univlive.tech/pricing"
      />
      {/* Pricing Header */}
      <section className="section-padding section-1">
        <div className="container-main">
          <motion.div
            className="text-center max-w-3xl mx-auto mb-16"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-4">
              Pricing
            </h1>
            <p className="text-lg text-muted-foreground">
              No setup fee. No fixed cost. Pay only for enrolled students.
            </p>
          </motion.div>

          {/* Pricing Cards */}
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto mb-20">
            {plans.map((plan, index) => (
              <motion.div
                key={plan.name}
                className={`bg-card rounded-3xl p-8 border shadow-soft relative ${
                  plan.popular
                    ? "border-primary ring-2 ring-primary/20"
                    : "border-border"
                }`}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-primary to-accent text-primary-foreground text-xs font-semibold px-4 py-1 rounded-full">
                    Most Popular
                  </div>
                )}

                <div className="mb-6">
                  <h3 className="text-xl font-semibold mb-2">{plan.name}</h3>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl lg:text-5xl font-bold">₹{plan.price}</span>
                    <span className="text-muted-foreground">/ Student</span>
                  </div>
                  <p className="text-muted-foreground mt-3">{plan.description}</p>
                </div>

                <Link to="/signup">
                  <ButtonWithIcon
                    variant={plan.popular ? "hero" : "heroOutline"}
                    size="lg"
                    className="w-full justify-center mb-8"
                  >
                    {plan.cta}
                  </ButtonWithIcon>
                </Link>

                <ul className="space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3">
                      <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                      <span className="text-muted-foreground text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison Section */}
      <section className="section-padding section-2">
        <div className="container-main">
          <motion.div
            className="text-center max-w-3xl mx-auto mb-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4">
              OMR vs Univ.live CBT — Per Student Comparison
            </h2>
          </motion.div>

          <motion.div
            className="bg-card rounded-3xl border border-border shadow-card overflow-hidden max-w-4xl mx-auto mb-12"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-4 font-semibold">Feature / Cost Factor</th>
                    <th className="text-center p-4 font-semibold bg-red-50">Traditional OMR Tests</th>
                    <th className="text-center p-4 font-semibold bg-green-50">Univ.live CBT Platform</th>
                  </tr>
                </thead>
                <tbody>
                  {comparisonData.map((row, index) => (
                    <tr key={row.feature} className={index % 2 === 0 ? "bg-muted/30" : ""}>
                      <td className="p-4 font-medium">{row.feature}</td>
                      <td className="text-center p-4 bg-red-50/50">
                        <span className="inline-flex items-center gap-2 text-red-600">
                          <X className="h-4 w-4" />
                          {row.omr}
                        </span>
                      </td>
                      <td className="text-center p-4 bg-green-50/50">
                        <span className="inline-flex items-center gap-2 text-green-600">
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
              <ButtonWithIcon variant="hero" size="lg">
                Get Started For Free
              </ButtonWithIcon>
            </Link>
            <Link to="/contact">
              <ButtonWithIcon variant="heroOutline" size="lg">
                Book a Demo
              </ButtonWithIcon>
            </Link>
          </motion.div>
        </div>
      </section>
    </Layout>
  );
};

export default Pricing;