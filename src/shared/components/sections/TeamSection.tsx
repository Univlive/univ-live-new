import { motion } from "framer-motion";
import { Linkedin, Twitter, Mail } from "lucide-react";

const teamCategories = [
  {
    category: "Commerce Domain",
    description: "Expert guidance for Accountancy, Economics, and Business Studies.",
    members: [
      {
        name: "Anurag Patidar",
        role: "Economics Expert",
        image: "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=400&h=400&fit=crop",
        highlight: "200/200 in Economics",
        about: "Passionate about simplifying complex economic theories and helping students ace their macro and micro concepts.",
        socials: { linkedin: "#", twitter: "#", email: "mailto:#" },
      },
      {
        name: "Kushagra Sharma",
        role: "Accountancy Head",
        image: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=400&h=400&fit=crop",
        highlight: "SRCC Alumni",
        about: "Specializes in financial statement analysis and core accounting principles for CUET dominance.",
        socials: { linkedin: "#", twitter: "#" },
      },
      {
        name: "Priya Singh",
        role: "Business Studies",
        image: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&h=400&fit=crop",
        highlight: "Top Educator '23",
        about: "Brings business case studies to life, ensuring students score perfectly in theoretical frameworks.",
        socials: { linkedin: "#", email: "mailto:#" },
      },
      {
        name: "Rahul Verma",
        role: "Commerce Strategist",
        image: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&h=400&fit=crop",
        highlight: "CA Finalist",
        about: "Crafts the ultimate test-taking strategies and time-management skills for commerce students.",
        socials: { linkedin: "#", twitter: "#" },
      },
    ],
  },
  {
    category: "Humanities Domain",
    description: "Your mentors for History, Geography, and Political Science.",
    members: [
      {
        name: "Mishty Jain",
        role: "Political Science",
        image: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=400&h=400&fit=crop",
        highlight: "Lady Shri Ram",
        about: "Expert in Indian and World Politics, making extensive syllabi engaging and easy to retain.",
        socials: { linkedin: "#", twitter: "#" },
      },
      {
        name: "Aditi Sharma",
        role: "History Expert",
        image: "https://images.unsplash.com/photo-1598550874175-4d0ef436c909?w=400&h=400&fit=crop",
        highlight: "DU Top Ranker",
        about: "Transforms historical timelines into captivating stories, ensuring max retention for CUET.",
        socials: { linkedin: "#", email: "mailto:#" },
      },
      {
        name: "Kabir Das",
        role: "Geography Specialist",
        image: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&h=400&fit=crop",
        highlight: "JNU Alumni",
        about: "Master of human and physical geography with a knack for map-based question strategies.",
        socials: { linkedin: "#", twitter: "#" },
      },
    ],
  },
  {
    category: "English & General Test",
    description: "Securing your foundation in language and quantitative aptitude.",
    members: [
      {
        name: "Kushal Sharma",
        role: "English Expert",
        image: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=400&fit=crop",
        highlight: "200/200 in English",
        about: "Decodes reading comprehension and vocabulary with proven tricks to secure full marks.",
        socials: { linkedin: "#", twitter: "#", email: "mailto:#" },
      },
      {
        name: "Krishna Gupta",
        role: "Quant & LRDI",
        image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop",
        highlight: "SBSC",
        about: "Makes logical reasoning and quantitative aptitude the highest-scoring section for students.",
        socials: { linkedin: "#", twitter: "#" },
      },
      {
        name: "Neha Kapoor",
        role: "Verbal Ability",
        image: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=400&fit=crop",
        highlight: "10+ Years Exp.",
        about: "Grammar enthusiast and vocabulary builder, preparing students for any language curveballs.",
        socials: { linkedin: "#" },
      },
      {
        name: "Aman Singh",
        role: "General Awareness",
        image: "https://images.unsplash.com/photo-1530268729831-4b0b9e170218?w=400&h=400&fit=crop",
        highlight: "UPSC Interviewee",
        about: "Keeps students updated with dynamic current affairs and static GK without the overwhelm.",
        socials: { linkedin: "#", twitter: "#" },
      },
    ],
  },
  {
    category: "Science & Math Domain",
    description: "Top-tier faculty for Physics, Chemistry, Biology, and Core Math.",
    members: [
      {
        name: "Dr. Rajesh Kumar",
        role: "Physics Expert",
        image: "https://images.unsplash.com/photo-1556157382-97eda2d62296?w=400&h=400&fit=crop",
        highlight: "PhD IIT Delhi",
        about: "Specializes in modern physics and electromagnetism, focusing on application-based MCQs.",
        socials: { linkedin: "#", email: "mailto:#" },
      },
      {
        name: "Sneha Reddy",
        role: "Chemistry Specialist",
        image: "https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=400&h=400&fit=crop",
        highlight: "Organic Chem Pro",
        about: "Turns organic reactions and inorganic exceptions into simple, memorable patterns.",
        socials: { linkedin: "#", twitter: "#" },
      },
      {
        name: "Vikram Aditya",
        role: "Core Mathematics",
        image: "https://images.unsplash.com/photo-1519345182560-3f2917c472ef?w=400&h=400&fit=crop",
        highlight: "100 Percentiler",
        about: "Calculus and Algebra mastermind helping students navigate lengthy calculations with shortcuts.",
        socials: { linkedin: "#", twitter: "#" },
      },
    ],
  },
];

export function TeamSection() {
  return (
    <section className="section-padding bg-muted/30" id="team">
      <div className="container-main">
        {/* Header */}
        <motion.div
          className="text-center max-w-2xl mx-auto mb-20"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <span className="inline-block px-4 py-1.5 bg-primary/10 text-primary text-sm font-semibold rounded-full mb-4">
            Meet Our Team
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4">
            The Experts Behind{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">
              Univ.live
            </span>
          </h2>
          <p className="text-muted-foreground text-lg">
            A dedicated team of top-tier educators and alumni committed to transforming your CUET preparation journey.
          </p>
        </motion.div>

        {/* Team Categories */}
        <div className="space-y-24">
          {teamCategories.map((team, teamIndex) => (
            <div key={team.category}>
              {/* Category Header */}
              <motion.div
                className="mb-10 text-center sm:text-left border-b border-border pb-4"
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5 }}
              >
                <h3 className="text-2xl sm:text-3xl font-bold mb-2 text-foreground">
                  {team.category}
                </h3>
                <p className="text-muted-foreground">{team.description}</p>
              </motion.div>

              {/* Members Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                {team.members.map((member, memberIndex) => (
                  <motion.div
                    key={member.name}
                    className="flex flex-col bg-card rounded-2xl border border-border shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden group"
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: memberIndex * 0.1 }}
                  >
                    {/* Image Container */}
                    <div className="relative aspect-square overflow-hidden bg-muted">
                      <img
                        src={member.image}
                        alt={member.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        loading="lazy"
                      />
                      {/* Highlight Badge Overlay */}
                      {member.highlight && (
                        <div className="absolute top-4 right-4 bg-background/90 backdrop-blur-sm px-3 py-1.5 rounded-full shadow-lg border border-border">
                          <span className="text-xs font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                            {member.highlight}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex flex-col flex-grow p-6">
                      <h4 className="font-bold text-xl mb-1 text-foreground">
                        {member.name}
                      </h4>
                      <p className="text-primary font-medium text-sm mb-4">
                        {member.role}
                      </p>
                      <p className="text-muted-foreground text-sm leading-relaxed mb-6 flex-grow">
                        {member.about}
                      </p>

                      {/* Socials */}
                      <div className="flex items-center gap-3 pt-4 border-t border-border/50 mt-auto">
                        {member.socials.linkedin && (
                          <a
                            href={member.socials.linkedin}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 rounded-full bg-muted text-muted-foreground hover:bg-[#0A66C2] hover:text-white transition-colors duration-300"
                            aria-label="LinkedIn Profile"
                          >
                            <Linkedin className="h-4 w-4" />
                          </a>
                        )}
                        {member.socials.twitter && (
                          <a
                            href={member.socials.twitter}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 rounded-full bg-muted text-muted-foreground hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-colors duration-300"
                            aria-label="Twitter Profile"
                          >
                            <Twitter className="h-4 w-4" />
                          </a>
                        )}
                        {member.socials.email && (
                          <a
                            href={member.socials.email}
                            className="p-2 rounded-full bg-muted text-muted-foreground hover:bg-primary hover:text-white transition-colors duration-300"
                            aria-label="Email Contact"
                          >
                            <Mail className="h-4 w-4" />
                          </a>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}