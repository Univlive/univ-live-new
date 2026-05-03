import { motion } from "framer-motion";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@shared/ui/accordion";

const faqs = [
  {
    question: "What is LearnFlow?",
    answer:
      "LearnFlow is an AI-powered Learning Management System (LMS) that offers interactive courses, video lessons, quizzes, and certifications to help students and professionals learn anytime, anywhere.",
  },
  {
    question: "Who can use LearnFlow?",
    answer:
      "LearnFlow is designed for everyone — students, professionals, educators, and businesses. Whether you want to learn new skills, upskill your team, or create courses, LearnFlow has you covered.",
  },
  {
    question: "Can I cancel my subscription anytime?",
    answer:
      "Yes! You can cancel your subscription at any time. Your access will continue until the end of your billing period, and you won't be charged again.",
  },
  {
    question: "What payment methods do you accept?",
    answer:
      "We accept all major credit cards (Visa, MasterCard, American Express), PayPal, and bank transfers for annual plans. Enterprise customers can also pay via invoice.",
  },
  {
    question: "Is there a free trial available?",
    answer:
      "Yes! We offer a 14-day free trial on all paid plans. You can explore all features without any commitment. No credit card required to start.",
  },
];

export function FAQSection() {
  return (
    <section className="section-padding">
      <div className="container-main">
        <motion.div
          className="text-center max-w-2xl mx-auto mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4">
            Everything You Need to Know About LearnFlow
          </h2>
          <p className="text-muted-foreground text-lg">
            Got questions? Visit our comprehensive FAQs for detailed info on LearnFlow's
            competitive pricing, diverse courses, and dedicated support!
          </p>
        </motion.div>

        <motion.div
          className="max-w-3xl mx-auto"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <Accordion type="single" collapsible className="space-y-4">
            {faqs.map((faq, index) => (
              <AccordionItem
                key={index}
                value={`item-${index}`}
                className="bg-card rounded-2xl border border-border shadow-soft px-6 data-[state=open]:shadow-card transition-shadow"
              >
                <AccordionTrigger className="text-left font-semibold hover:no-underline py-5 [&[data-state=open]]:text-primary">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground pb-5 leading-relaxed">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </motion.div>
      </div>
    </section>
  );
}
