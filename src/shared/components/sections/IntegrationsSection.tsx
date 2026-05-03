import { motion } from "framer-motion";
import { 
  Cloud, 
  Video, 
  FileText, 
  Calendar, 
  MessageSquare, 
  Shield, 
  CreditCard, 
  BarChart 
} from "lucide-react";

const integrations = [
  { icon: Cloud, name: "Cloud Storage" },
  { icon: Video, name: "Video Calls" },
  { icon: FileText, name: "Documents" },
  { icon: Calendar, name: "Calendar" },
  { icon: MessageSquare, name: "Messaging" },
  { icon: Shield, name: "Security" },
  { icon: CreditCard, name: "Payments" },
  { icon: BarChart, name: "Analytics" },
];

export function IntegrationsSection() {
  return (
    <section className="section-padding overflow-hidden">
      <div className="container-main">
        <motion.div
          className="text-center max-w-2xl mx-auto mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4">
            Powerful Integrations for Seamless Learning
          </h2>
          <p className="text-muted-foreground text-lg">
            Connect LearnFlow with your favorite tools and services for a unified experience.
          </p>
        </motion.div>

        {/* Integration Diagram */}
        <motion.div
          className="relative"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          {/* SVG Lines */}
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none"
            viewBox="0 0 1200 200"
            preserveAspectRatio="xMidYMid meet"
          >
            {integrations.map((_, index) => {
              const startX = 600;
              const startY = 100;
              const endX = 75 + index * 150;
              const endY = index % 2 === 0 ? 30 : 170;
              
              return (
                <motion.line
                  key={index}
                  x1={startX}
                  y1={startY}
                  x2={endX}
                  y2={endY}
                  stroke="hsl(var(--primary))"
                  strokeWidth="2"
                  strokeDasharray="4 4"
                  initial={{ pathLength: 0, opacity: 0 }}
                  whileInView={{ pathLength: 1, opacity: 0.5 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.8, delay: index * 0.1 }}
                />
              );
            })}
          </svg>

          {/* Center Logo */}
          <div className="flex justify-center mb-8 relative z-10">
            <motion.div
              className="w-20 h-20 bg-primary rounded-2xl flex items-center justify-center shadow-elevated"
              initial={{ scale: 0 }}
              whileInView={{ scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, type: "spring" }}
            >
              <svg
                viewBox="0 0 24 24"
                className="w-10 h-10 text-primary-foreground"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
            </motion.div>
          </div>

          {/* Integration Icons */}
          <div className="flex flex-wrap justify-center gap-4 lg:gap-8 relative z-10">
            {integrations.map((integration, index) => (
              <motion.div
                key={integration.name}
                className="flex flex-col items-center gap-2"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
              >
                <div className="w-14 h-14 lg:w-16 lg:h-16 bg-card rounded-2xl border border-border shadow-soft flex items-center justify-center hover:shadow-card hover:-translate-y-1 transition-all cursor-pointer">
                  <integration.icon className="h-6 w-6 lg:h-7 lg:w-7 text-muted-foreground" />
                </div>
                <span className="text-xs text-muted-foreground hidden sm:block">{integration.name}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
