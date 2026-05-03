import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Phone } from "lucide-react";
import { Button } from "@shared/ui/button";
import { useTenant } from "@app/providers/TenantProvider";

export default function Theme1CTA() {
  const { tenant, tenantSlug } = useTenant();

  if (!tenant) return null;

  const stats: { value: string; label: string }[] = tenant.websiteConfig?.stats || [];
  const phone = tenant.contact?.phone || "";

  return (
    <section className="py-20">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-primary via-primary/90 to-accent p-8 md:p-12 text-white"
        >
          {/* Background Decorations */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
          </div>

          <div className="relative grid md:grid-cols-2 gap-8 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Ready to Crack CUET 2025?
              </h2>
              <p className="text-white/80 text-lg mb-6">
                Join {stats[0]?.value || "50,000+"} students who are already preparing with {tenant.coachingName}.
                Start your journey to your dream college today!
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Button size="lg" variant="secondary" className="rounded-full" asChild>
                  <Link to={`/courses`}>
                    Browse Courses
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" className="rounded-full bg-white/10 border-white/30 text-white hover:bg-white/20" asChild>
                  <a href={`tel:${phone}`}>
                    <Phone className="mr-2 h-5 w-5" />
                    Call Now
                  </a>
                </Button>
              </div>
            </div>

            {stats.length > 0 && (
              <div className="grid grid-cols-2 gap-4">
                {stats.slice(0, 4).map((stat, i) => (
                  <div key={i} className="bg-white/10 backdrop-blur rounded-2xl p-6 text-center">
                    <div className="text-3xl font-bold mb-1">{stat.value}</div>
                    <p className="text-sm text-white/70">{stat.label}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </section>
  );
}

