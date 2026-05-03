import { forwardRef } from "react";
import { Link } from "react-router-dom";
import { Instagram, Linkedin, Facebook, Mail, Phone } from "lucide-react";
import univLogo from "@/assets/univ-logo-2.png";

const footerLinks = {
  product: [
    { name: "Home", path: "/" },
    { name: "Features", path: "/features" },
    { name: "Pricing", path: "/pricing" },
  ],
  resources: [
    { name: "Contact Us", path: "/contact" },
    { name: "About Us", path: "/about" },
    { name: "Terms of Use", path: "/terms" },
    { name: "Privacy Policy", path: "/privacy" },
  ],
};

const socialLinks = [
  { name: "Instagram", icon: Instagram, href: "#" },
  { name: "LinkedIn", icon: Linkedin, href: "#" },
  { name: "Facebook", icon: Facebook, href: "#" },
];

const Footer = forwardRef<HTMLElement>((_, ref) => {
  return (
    <footer ref={ref} className="bg-foreground text-background relative overflow-hidden">
      {/* Large watermark text */}
      <div className="absolute bottom-0 left-0 right-0 pointer-events-none select-none overflow-hidden">
        <div className="text-[15vw] font-bold text-background/5 whitespace-nowrap tracking-tight leading-none">
          UNIV
        </div>
      </div>

      <div className="container-main py-16 lg:py-20 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-8">
          {/* Brand */}
          <div className="lg:col-span-1">
            <Link to="/" className="flex items-center mb-5">
              <img src={univLogo} alt="Univ.live" className="h-10 w-auto invert" />
            </Link>
            <p className="text-background/90 text-lg font-medium mb-4">
              Tayaari Exam Jaisi
            </p>
            <p className="text-background/70 text-sm leading-relaxed mb-6">
              Launch your own CUET test platform in minutes. Built specifically for coaching centers.
            </p>
            
            {/* Contact info */}
            <div className="space-y-2 mb-6">
              <a href="tel:+919625394589" className="flex items-center gap-2 text-background/70 hover:text-primary transition-colors text-sm">
                <Phone className="h-4 w-4" />
                +91 96253 94589
              </a>
              <a href="mailto:info.univlive@gmail.com" className="flex items-center gap-2 text-background/70 hover:text-primary transition-colors text-sm">
                <Mail className="h-4 w-4" />
                info.univlive@gmail.com
              </a>
            </div>
            
            <p className="text-background/50 text-xs">
              © {new Date().getFullYear()} Univ.live. All rights reserved.
            </p>
          </div>

          {/* Useful Links */}
          <div>
            <h4 className="font-semibold mb-5 text-background">Useful Links</h4>
            <ul className="space-y-3">
              {footerLinks.product.map((link) => (
                <li key={link.name}>
                  <Link
                    to={link.path}
                    className="text-background/70 hover:text-primary transition-colors text-sm"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-semibold mb-5 text-background">Quick Links</h4>
            <ul className="space-y-3">
              {footerLinks.resources.map((link) => (
                <li key={link.name}>
                  <Link
                    to={link.path}
                    className="text-background/70 hover:text-primary transition-colors text-sm"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Social Links */}
          <div>
            <h4 className="font-semibold mb-5 text-background">Let's Connect</h4>
            <ul className="space-y-3">
              {socialLinks.map((link) => (
                <li key={link.name}>
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 text-background/70 hover:text-primary transition-colors text-sm group"
                  >
                    <span className="w-8 h-8 rounded-full bg-background/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                      <link.icon className="h-4 w-4" />
                    </span>
                    {link.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </footer>
  );
});

Footer.displayName = "Footer";

export default Footer;
