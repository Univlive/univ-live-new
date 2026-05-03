import Layout from "@widgets/layout/Layout";
import { motion } from "framer-motion";

const Terms = () => {
  return (
    <Layout>
      <section className="section-padding section-1">
        <div className="container-main">
          <motion.div
            className="max-w-4xl mx-auto"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h1 className="text-4xl sm:text-5xl font-bold mb-4">Terms of Use</h1>
            <p className="text-muted-foreground mb-12">Last updated: 24/01/2026</p>

            <div className="prose prose-lg max-w-none">
              <p>
                Welcome to <strong>Univ.live</strong>. By accessing or using our website and platform, you agree to comply with and be bound by the following Terms of Use. Please read them carefully.
              </p>

              <h2>1. Acceptance of Terms</h2>
              <p>
                By using Univ.live, you agree to these Terms of Use and our Privacy Policy. If you do not agree, please do not use the platform.
              </p>

              <h2>2. About Univ.live</h2>
              <p>
                Univ.live is a technology platform that provides CBT-based test series infrastructure for coaching centers and educational institutions, primarily for CUET preparation.
              </p>

              <h2>3. Account Responsibility</h2>
              <ul>
                <li>You are responsible for maintaining the confidentiality of your account credentials.</li>
                <li>Any activity performed through your account is your responsibility.</li>
                <li>Univ.live is not liable for unauthorized access caused by user negligence.</li>
              </ul>

              <h2>4. Platform Usage</h2>
              <p>You agree not to:</p>
              <ul>
                <li>Misuse the platform or attempt to disrupt its operation</li>
                <li>Upload unlawful, harmful, or misleading content</li>
                <li>Copy, resell, or misuse platform content without permission</li>
              </ul>

              <h2>5. Pricing & Payments</h2>
              <ul>
                <li>Platform access may be free or paid based on the selected plan.</li>
                <li>Pricing is <strong>pay-per-student</strong> and subject to change with prior notice.</li>
                <li>Payments, once made, are non-refundable unless stated otherwise.</li>
              </ul>

              <h2>6. Intellectual Property</h2>
              <p>
                All content, software, branding, and technology on Univ.live are the intellectual property of Univ.live and may not be copied or reused without permission.
              </p>

              <h2>7. Service Availability</h2>
              <p>
                We strive to keep the platform available at all times, but we do not guarantee uninterrupted access due to maintenance, upgrades, or technical issues.
              </p>

              <h2>8. Limitation of Liability</h2>
              <p>Univ.live shall not be liable for:</p>
              <ul>
                <li>Exam results or academic outcomes</li>
                <li>Loss of data due to user error</li>
                <li>Indirect or consequential damages</li>
              </ul>

              <h2>9. Termination</h2>
              <p>
                We reserve the right to suspend or terminate accounts that violate these Terms without prior notice.
              </p>

              <h2>10. Changes to Terms</h2>
              <p>
                We may update these Terms from time to time. Continued use of the platform means you accept the updated terms.
              </p>

              <h2>11. Contact Us</h2>
              <p>
                For any questions regarding these Terms, contact us at: <strong>info.univlive@gmail.com</strong>
              </p>
            </div>
          </motion.div>
        </div>
      </section>
    </Layout>
  );
};

export default Terms;