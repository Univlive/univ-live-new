import { motion } from "framer-motion";
import { useInView } from "framer-motion";
import { useRef } from "react";
import { Check, ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@shared/ui/button";
import { Link } from "react-router-dom";

const plans = [
  {
    name: "Starter",
    description: "Perfect for small coaching centers",
    price: "₹2,999",
    period: "/month",
    features: [
      "Branded subdomain",
      "Up to 100 students",
      "10 test imports/month",
      "Basic analytics",
      "Email support",
    ],
    highlighted: false,
    bgColor: "bg-card",
  },
  {
    name: "Growth",
    description: "Best for growing institutes",
    price: "₹7,999",
    period: "/month",
    features: [
      "Everything in Starter",
      "Up to 500 students",
      "Unlimited test imports",
      "AI-powered analytics",
      "Custom domain support",
      "Priority support",
      "Student app access",
    ],
    highlighted: true,
    bgColor: "bg-pastel-mint",
  },
  {
    name: "Enterprise",
    description: "For large institutions",
    price: "Custom",
    period: "",
    features: [
      "Everything in Growth",
      "Unlimited students",
      "White-label solution",
      "API access",
      "Dedicated account manager",
      "Custom integrations",
      "SLA guarantee",
    ],
    highlighted: false,
    bgColor: "bg-card",
  },
];

export default function PricingPreview() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section className="py-20 lg:py-32 relative bg-pastel-lavender dark:bg-surface" ref={ref}>
      <div className="container mx-auto px-4 lg:px-8">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center max-w-3xl mx-auto mb-16"
        >
          <span className="inline-block px-5 py-2 rounded-full bg-card text-sm font-medium text-foreground mb-4">
            Our Pricing
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-display font-bold mb-6">
            We Prepare A Very Reasonable{" "}
            <span className="gradient-text">Pricing Pack</span> For You
          </h2>
          <p className="text-lg text-muted-foreground">
            Choose the perfect plan for your coaching institute. No hidden fees.
          </p>
        </motion.div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-6 lg:gap-8 max-w-6xl mx-auto mb-12">
          {plans.map((plan, index) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 40 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              className={`relative rounded-3xl p-8 ${plan.bgColor} dark:bg-card border border-border/20 dark:border-border/50 ${
                plan.highlighted ? "shadow-card-hover ring-2 ring-primary/20" : ""
              }`}
            >
              {/* Popular Badge */}
              {plan.highlighted && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full gradient-bg">
                  <div className="flex items-center gap-1">
                    <Sparkles className="w-4 h-4 text-white" />
                    <span className="text-sm font-semibold text-white">Most Popular</span>
                  </div>
                </div>
              )}

              {/* Plan Info */}
              <div className="mb-6">
                <h3 className="text-xl font-display font-bold mb-2">{plan.name}</h3>
                <p className="text-sm text-muted-foreground">{plan.description}</p>
              </div>

              {/* Price */}
              <div className="mb-6">
                <span className="text-4xl font-display font-bold">{plan.price}</span>
                <span className="text-muted-foreground">{plan.period}</span>
              </div>

              {/* Features */}
              <ul className="space-y-3 mb-8">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <Check className="w-3 h-3 text-primary" />
                    </div>
                    <span className="text-sm text-foreground">{feature}</span>
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <Button
                variant={plan.highlighted ? "gradient" : "outline"}
                className="w-full rounded-full"
                asChild
              >
                <Link to="/pricing">
                  {plan.price === "Custom" ? "Contact Sales" : "Purchase"}
                </Link>
              </Button>
            </motion.div>
          ))}
        </div>

        {/* View All CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="text-center"
        >
          <Button variant="link" asChild className="group">
            <Link to="/pricing">
              View full pricing comparison
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </Button>
        </motion.div>
      </div>
    </section>
  );
}
