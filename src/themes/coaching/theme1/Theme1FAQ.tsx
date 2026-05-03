import { motion } from "framer-motion";
import { Badge } from "@shared/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@shared/ui/accordion";
import { useTenant } from "@app/providers/TenantProvider";

interface FAQItem {
  question: string;
  answer: string;
}

export default function Theme1FAQ() {
  const { tenant } = useTenant();

  if (!tenant) return null;

  const faqs: FAQItem[] =
    tenant.websiteConfig?.faqs && tenant.websiteConfig.faqs.length > 0
      ? tenant.websiteConfig.faqs
      : [
          {
            question: "What is CUET and why is it important?",
            answer:
              "CUET (Common University Entrance Test) is a national-level entrance exam conducted by NTA for admission to undergraduate programs in central and participating universities across India.",
          },
          {
            question: "How is the course delivered?",
            answer:
              "Our courses include live interactive classes, recorded video lectures, comprehensive study materials, practice tests, and AI-powered performance analytics.",
          },
          {
            question: "What is the validity of the courses?",
            answer:
              "All courses are valid till the CUET exam date plus one additional month for counseling and revision support.",
          },
          {
            question: "Can I access the courses on mobile?",
            answer:
              "Yes, our platform is fully mobile-responsive and also available via Android and iOS apps.",
          },
        ];

  return (
    <section className="py-20">
      <div className="container mx-auto px-4 max-w-4xl">
        <div className="text-center mb-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <Badge variant="outline" className="mb-4 px-4 py-1 rounded-full">
              FAQ
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Frequently Asked Questions
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Find answers to common questions about our courses and admissions
            </p>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
        >
          <Accordion type="single" collapsible className="space-y-4">
            {faqs.map((faq, index) => (
              <AccordionItem
                key={index}
                value={`faq-${index}`}
                className="card-soft border-0 px-6 overflow-hidden"
              >
                <AccordionTrigger className="text-left font-medium py-4 hover:no-underline">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground pb-4">
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

