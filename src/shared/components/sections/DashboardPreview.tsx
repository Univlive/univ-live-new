import { motion } from "framer-motion";
import { Search, Bell, BarChart3, Clock, CheckCircle, BookOpen, Users, Calendar, Mic } from "lucide-react";

export function DashboardPreview() {
  return (
    <section className="section-padding">
      <div className="container-main">
        <motion.div
          className="bg-card rounded-3xl lg:rounded-[2.5rem] shadow-elevated border border-border overflow-hidden"
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
        >
          {/* Dashboard Container */}
          <div className="flex">
            {/* Sidebar */}
            <div className="hidden md:flex flex-col w-56 border-r border-border p-5 bg-card">
              <div className="flex items-center gap-2 mb-8">
                <div className="flex items-center justify-center w-8 h-8 bg-primary rounded-lg">
                  <svg
                    viewBox="0 0 24 24"
                    className="w-4 h-4 text-primary-foreground"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                  >
                    <path d="M12 2L2 7l10 5 10-5-10-5z" />
                    <path d="M2 17l10 5 10-5" />
                    <path d="M2 12l10 5 10-5" />
                  </svg>
                </div>
                <span className="font-bold">LearnFlow</span>
              </div>

              <nav className="space-y-1">
                {[
                  { icon: BarChart3, label: "Overview", active: true },
                  { icon: BookOpen, label: "Course" },
                  { icon: Users, label: "Resource" },
                  { icon: CheckCircle, label: "AI Powered" },
                  { icon: Mic, label: "Discussion" },
                  { icon: Users, label: "Communities" },
                  { icon: Calendar, label: "Schedule" },
                  { icon: Mic, label: "Recording" },
                ].map((item, i) => (
                  <button
                    key={i}
                    className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm transition-colors ${
                      item.active
                        ? "bg-foreground text-background font-medium"
                        : "text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </button>
                ))}
              </nav>
            </div>

            {/* Main Content */}
            <div className="flex-1 p-5 lg:p-8">
              {/* Header */}
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-xl font-bold">Overview</h2>
                <div className="flex items-center gap-4">
                  <div className="hidden sm:flex items-center gap-2 bg-muted rounded-full px-4 py-2">
                    <Search className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Find a course that interests you</span>
                  </div>
                  <button className="p-2 rounded-full bg-muted">
                    <Bell className="h-5 w-5 text-muted-foreground" />
                  </button>
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center">
                      <span className="text-sm font-medium text-primary">RR</span>
                    </div>
                    <span className="hidden sm:block text-sm font-medium">Ronal Richards</span>
                  </div>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                {/* Time Spent Card */}
                <div className="bg-orange-light rounded-2xl p-5 border border-primary/10">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm text-primary">Time Spent</span>
                    <button className="w-7 h-7 rounded-full bg-card flex items-center justify-center shadow-soft">
                      <BarChart3 className="h-3 w-3 text-primary" />
                    </button>
                  </div>
                  <div className="text-2xl font-bold mb-2">13.6 Hours</div>
                  <div className="flex gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-primary" /> Study
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-muted-foreground" /> Exams
                    </span>
                  </div>
                  <div className="flex items-end gap-1 mt-4 h-20">
                    {[40, 60, 30, 80, 45, 70, 55, 90, 50, 65, 75, 40].map((h, i) => (
                      <div
                        key={i}
                        className="flex-1 bg-primary rounded-t transition-all hover:bg-primary/80"
                        style={{ height: `${h}%` }}
                      />
                    ))}
                  </div>
                </div>

                {/* Performance Card */}
                <div className="bg-card rounded-2xl p-5 border border-border shadow-soft">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm text-muted-foreground">Performance</span>
                    <button className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                      <BarChart3 className="h-3 w-3 text-primary" />
                    </button>
                  </div>
                  <div className="flex items-center justify-center py-4">
                    <div className="relative">
                      <svg className="w-28 h-28" viewBox="0 0 100 100">
                        <circle
                          cx="50"
                          cy="50"
                          r="40"
                          fill="none"
                          stroke="hsl(var(--border))"
                          strokeWidth="8"
                          strokeDasharray="4 4"
                        />
                        <circle
                          cx="50"
                          cy="50"
                          r="40"
                          fill="none"
                          stroke="hsl(var(--primary))"
                          strokeWidth="8"
                          strokeDasharray="201"
                          strokeDashoffset="40"
                          strokeLinecap="round"
                          transform="rotate(-90 50 50)"
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-3xl font-bold">80%</span>
                        <span className="text-xs text-muted-foreground">Performance</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-center text-sm text-green-600 font-medium">
                    You did a great job!
                  </div>
                </div>

                {/* Upcoming Lessons Card */}
                <div className="bg-card rounded-2xl p-5 border border-border shadow-soft">
                  <h3 className="font-semibold mb-4">Upcoming Lesson</h3>
                  <div className="space-y-3">
                    {[
                      { title: "UX Design Fundamentals", time: "5:30hrs", joinable: true },
                      { title: "Motion Design", time: "5:30hrs", joinable: false },
                    ].map((lesson, i) => (
                      <div key={i} className="flex items-center justify-between p-3 bg-muted rounded-xl">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <BookOpen className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <div className="text-sm font-medium">{lesson.title}</div>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              {lesson.time}
                            </div>
                          </div>
                        </div>
                        <button
                          className={`px-4 py-1.5 rounded-full text-sm font-medium ${
                            lesson.joinable
                              ? "bg-foreground text-background"
                              : "text-primary border border-primary"
                          }`}
                        >
                          Join
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Bottom Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { value: "2h 37m Avg.", icon: Clock, color: "bg-green-500" },
                  { value: "21 Tasks", icon: CheckCircle, color: "bg-primary" },
                  { value: "06 Complete", icon: CheckCircle, color: "bg-green-500" },
                ].map((stat, i) => (
                  <div key={i} className="flex items-center gap-3 bg-card rounded-2xl p-4 border border-border shadow-soft">
                    <div className={`w-10 h-10 rounded-xl ${stat.color}/10 flex items-center justify-center`}>
                      <stat.icon className={`h-5 w-5 ${stat.color === "bg-primary" ? "text-primary" : "text-green-500"}`} />
                    </div>
                    <span className="font-semibold">{stat.value}</span>
                  </div>
                ))}
                <div className="flex items-center justify-center bg-foreground rounded-2xl p-4">
                  <span className="text-2xl">😊</span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
