import  Layout  from "@widgets/layout/Layout";
import { HeroSection } from "@shared/components/sections/HeroSection";
import { StepsSection } from "@shared/components/sections/StepsSection";
import { BenefitsSection } from "@shared/components/sections/BenefitsSection";
import { PricingSection } from "@shared/components/sections/PricingSection";
import { TestimonialsSection } from "@shared/components/sections/TestimonialsSection";
import { TeamSection } from "@shared/components/sections/TeamSection";
import { CTASection } from "@shared/components/sections/CTASection";

const Index = () => {
  return (
    <Layout>
      <HeroSection />
      <StepsSection />
      <BenefitsSection />
      <PricingSection />
      <CTASection />
      <TestimonialsSection />
      {/* <TeamSection /> */}
    </Layout>
  );
};

export default Index;
