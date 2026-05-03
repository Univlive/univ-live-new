import { motion } from "framer-motion";
import { BarChart3, Trophy, Sparkles, TrendingUp, Users, Search } from "lucide-react";

const features = [
  {
    title: "Smart Progress Tracking",
    description: "Monitor student performance with in-depth analytics and reports.",
    icon: BarChart3,
    mockContent: "chart",
  },
  {
    title: "Gamification & Rewards",
    description: "Excite users with badges, leaderboards, and achievements!",
    icon: Trophy,
    mockContent: "leaderboard",
  },
  {
    title: "AI-Powered Learning",
    description: "Get personalized course recommendations and automated progress tracking.",
    icon: Sparkles,
    mockContent: "ai",
  },
];

export function FeatureCards() {
  return (
    <section className="section-padding">
      <div className="container-main">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              className="group bg-card rounded-3xl p-6 lg:p-8 border border-border shadow-soft hover-lift cursor-pointer"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              <h3 className="text-xl lg:text-2xl font-bold mb-3">{feature.title}</h3>
              <p className="text-muted-foreground mb-6">{feature.description}</p>

              {/* Mock Content */}
              <div className="bg-muted rounded-2xl p-4 min-h-[180px]">
                {feature.mockContent === "chart" && (
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Time Spent</div>
                    <div className="text-2xl font-bold text-primary mb-4">13.6 Hours</div>
                    <div className="flex items-end gap-1 h-24">
                      {[40, 60, 30, 80, 45, 70, 55, 90, 50, 65, 75, 40].map((h, i) => (
                        <div
                          key={i}
                          className="flex-1 bg-primary/30 rounded-t group-hover:bg-primary transition-colors duration-300"
                          style={{ height: `${h}%` }}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {feature.mockContent === "leaderboard" && (
                  <div>
                    <div className="font-semibold mb-4">Leader Board</div>
                    <div className="grid grid-cols-3 text-xs text-muted-foreground mb-2">
                      <span>RANK</span>
                      <span>NAME</span>
                      <span className="text-right">POINT</span>
                    </div>
                    {[
                      { rank: 1, name: "Jacob Jones", points: "13,450", up: true },
                      { rank: 2, name: "Kristin Watson", points: "11,236", up: false },
                      { rank: 3, name: "Alan Walker", points: "08,164", up: false },
                    ].map((user) => (
                      <div key={user.rank} className="grid grid-cols-3 items-center py-2 text-sm">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{user.rank}</span>
                          <TrendingUp
                            className={`h-3 w-3 ${user.up ? "text-green-500" : "text-red-500 rotate-180"}`}
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-primary/20" />
                          <span className="truncate">{user.name}</span>
                        </div>
                        <span className="text-right text-primary font-medium">{user.points}</span>
                      </div>
                    ))}
                  </div>
                )}

                {feature.mockContent === "ai" && (
                  <div>
                    <div className="font-semibold mb-4">AI - Recommendation</div>
                    <div className="flex items-center gap-2 bg-card rounded-full px-3 py-2 border border-border mb-4">
                      <span className="text-sm text-muted-foreground truncate">Business Category</span>
                      <Search className="h-4 w-4 text-muted-foreground ml-auto" />
                    </div>
                    <div className="flex items-center justify-center py-4">
                      <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center animate-pulse">
                        <Sparkles className="h-5 w-5 text-primary" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="h-2 bg-border rounded-full w-3/4 mx-auto" />
                      <div className="h-2 bg-border rounded-full w-1/2 mx-auto" />
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
