import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { 
  Mail, 
  PhoneCall, 
  MessageCircle, 
  LifeBuoy, 
  ArrowRight,
  Clock
} from "lucide-react";
import { Button } from "@shared/ui/button";
import { Card, CardContent } from "@shared/ui/card";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@shared/lib/firebase";

export default function Messages() {
  const [uid, setUid] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  // Fetch educator details from Auth to include in the WhatsApp/Email message
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUid(u?.uid ?? null);
      setEmail(u?.email ?? null);
    });
    return () => unsub();
  }, []);

  const handleWhatsApp = () => {
    const educatorDetails = `Educator ID: ${uid || "Unknown"} ${email ? `\nEmail: ${email}` : ""}`;
    const text = encodeURIComponent(
      `Hello Univ.live Support,\n\nI am an educator on your platform.\n${educatorDetails}\n\nI need assistance with an issue. Please get back in touch with me for a resolution.\n\nThank you.`
    );
    // Assuming Indian country code (+91) for the provided 10-digit number
    window.open(`https://wa.me/919630896410?text=${text}`, "_blank");
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-10">
      {/* Header Section */}
      <motion.div 
        className="flex flex-col items-center text-center space-y-4 pt-8 pb-4"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-2">
          <LifeBuoy className="h-8 w-8 text-primary" />
        </div>
        <h1 className="text-3xl sm:text-4xl font-display font-bold">
          How can we <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">help you?</span>
        </h1>
        <p className="text-muted-foreground text-lg max-w-2xl">
          Our dedicated support team is here to assist you. Choose your preferred method of communication below and we'll get back to you as soon as possible.
        </p>
      </motion.div>

      {/* Contact Options Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
        
        {/* WhatsApp Card (Primary Action) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <Card className="relative overflow-hidden border-2 border-primary/50 shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300 h-full">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#25D366] to-[#128C7E]" />
            <CardContent className="p-8 flex flex-col h-full items-center text-center">
              <div className="w-14 h-14 bg-[#25D366]/10 text-[#25D366] rounded-2xl flex items-center justify-center mb-6">
                <MessageCircle className="h-7 w-7" />
              </div>
              <h3 className="text-xl font-bold mb-2">WhatsApp Support</h3>
              <p className="text-sm text-muted-foreground mb-6 flex-grow">
                Get the fastest response from our team directly on WhatsApp. Best for quick queries and real-time resolution.
              </p>
              <Button 
                onClick={handleWhatsApp}
                className="w-full bg-[#25D366] hover:bg-[#128C7E] text-white rounded-xl group"
                size="lg"
              >
                Chat on WhatsApp
                <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        {/* Phone Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          <Card className="border border-border shadow-sm hover:shadow-md hover:border-primary/30 transition-all duration-300 h-full">
            <CardContent className="p-8 flex flex-col h-full items-center text-center">
              <div className="w-14 h-14 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mb-6">
                <PhoneCall className="h-7 w-7" />
              </div>
              <h3 className="text-xl font-bold mb-2">Call Us</h3>
              <p className="text-sm text-muted-foreground mb-6 flex-grow">
                Prefer speaking to someone directly? Give us a call. We are available during standard business hours.
              </p>
              <div className="w-full p-4 rounded-xl bg-muted/50 border border-border mt-auto">
                <a 
                  href="tel:+919630896410" 
                  className="text-lg font-bold text-foreground hover:text-primary transition-colors block"
                >
                  +91 96308 96410
                </a>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Email Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
        >
          <Card className="border border-border shadow-sm hover:shadow-md hover:border-primary/30 transition-all duration-300 h-full">
            <CardContent className="p-8 flex flex-col h-full items-center text-center">
              <div className="w-14 h-14 bg-accent/10 text-accent rounded-2xl flex items-center justify-center mb-6">
                <Mail className="h-7 w-7" />
              </div>
              <h3 className="text-xl font-bold mb-2">Email Support</h3>
              <p className="text-sm text-muted-foreground mb-6 flex-grow">
                For detailed inquiries, technical issues, or attachment-heavy requests, drop us an email.
              </p>
              <div className="w-full p-4 rounded-xl bg-muted/50 border border-border mt-auto">
                <a 
                  href="mailto:univ.live@gmail.com" 
                  className="text-sm font-bold text-foreground hover:text-accent transition-colors block break-all"
                >
                  univ.live@gmail.com
                </a>
              </div>
            </CardContent>
          </Card>
        </motion.div>

      </div>

      {/* Support Info Footer */}
      <motion.div 
        className="mt-12 p-6 bg-muted/30 border border-border rounded-2xl flex flex-col sm:flex-row items-center justify-center gap-6 text-center sm:text-left"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.5 }}
      >
        <div className="w-12 h-12 rounded-full bg-background flex items-center justify-center shadow-sm shrink-0">
          <Clock className="h-5 w-5 text-muted-foreground" />
        </div>
        <div>
          <h4 className="font-semibold text-foreground">Standard Response Times</h4>
          <p className="text-sm text-muted-foreground mt-1">
            WhatsApp messages are typically answered within 1-2 hours. Emails and general inquiries may take up to 24 hours.
          </p>
        </div>
      </motion.div>
    </div>
  );
}