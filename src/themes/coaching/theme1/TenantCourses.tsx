import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTenant } from "@app/providers/TenantProvider";
import { collection, query, orderBy, getDocs } from "firebase/firestore";
import { db } from "@shared/lib/firebase";
import { Card, CardContent } from "@shared/ui/card";
import { Badge } from "@shared/ui/badge";
import { Button } from "@shared/ui/button";
import { Loader2, FileText, ArrowRight, Search, BookOpen, Clock } from "lucide-react";
import { Input } from "@shared/ui/input";
import Theme1CTA from "./Theme1CTA";
import Theme1FAQ from "./Theme1FAQ";
import Theme1Layout from "./Theme1Layout";

type TestSeries = {
  id: string;
  title: string;
  description: string;
  price: string | number;
  coverImage?: string;
  subject?: string;
  difficulty?: string;
  testsCount?: number;
  durationMinutes?: number;
};

export default function TenantCourses() {
  const { tenant, loading: tenantLoading } = useTenant();
  const [courses, setCourses] = useState<TestSeries[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    if (!tenant?.educatorId) return;

    const fetchCourses = async () => {
      try {
        // Fetch ALL tests from the educator's sub-collection
        const q = query(
          collection(db, "educators", tenant.educatorId, "my_tests"),
          orderBy("createdAt", "desc")
        );

        const snap = await getDocs(q);
        const fetchedData = snap.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as TestSeries[];

        setCourses(fetchedData);
      } catch (error) {
        console.error("Error fetching courses:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchCourses();
  }, [tenant?.educatorId]);

  // Client-side search filtering
  const filteredCourses = courses.filter(c => 
    c.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (c.subject && c.subject.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (tenantLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!tenant) return null;

  return (
    <Theme1Layout>
      
      <div className="container py-20 min-h-screen">
      <div className="flex flex-col md:flex-row justify-between items-center mb-10 gap-4">
        <div>
           <h1 className="text-3xl font-bold mb-2">All Test Series</h1>
           <p className="text-muted-foreground">Browse all available exam packages and mock tests.</p>
        </div>
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search tests..." 
            className="pl-9"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {filteredCourses.length === 0 ? (
        <div className="text-center py-20 border-2 border-dashed rounded-xl bg-muted/30">
          <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-xl font-semibold">No test series found</h3>
          <p className="text-muted-foreground">Check back later for new content.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredCourses.map((course) => (
            <Link key={course.id} to={`/course/${course.id}`}>
              <Card className="h-full overflow-hidden hover:shadow-lg transition-all duration-300 group border bg-card">
                {/* Image / Placeholder */}
                <div className="aspect-video relative overflow-hidden bg-muted">
                    {course.coverImage ? (
                       <img
                         src={course.coverImage}
                         alt={course.title}
                         className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                       />
                    ) : (
                       <div className="w-full h-full flex flex-col items-center justify-center bg-primary/5 text-primary/40 gap-2">
                          <FileText className="h-10 w-10" />
                          <span className="text-xs font-medium uppercase tracking-wider">No Cover Image</span>
                       </div>
                    )}
                    {course.subject && (
                      <div className="absolute top-2 right-2">
                        <Badge className="bg-white/90 text-black hover:bg-white shadow-sm backdrop-blur-md">
                          {course.subject}
                        </Badge>
                      </div>
                    )}
                </div>

                <CardContent className="p-5 flex flex-col h-full">
                  <h3 className="font-bold text-lg mb-2 line-clamp-1 group-hover:text-primary transition-colors">
                    {course.title}
                  </h3>
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-4 h-10">
                    {course.description}
                  </p>
                  
                  <div className="flex items-center gap-4 text-xs text-muted-foreground mb-4">
                    {course.testsCount !== undefined && (
                        <span className="flex items-center gap-1"><FileText className="h-3 w-3" /> {course.testsCount} Tests</span>
                    )}
                    {course.durationMinutes && (
                        <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {course.durationMinutes}m</span>
                    )}
                  </div>

                  <div className="flex items-center justify-between mt-auto pt-4 border-t border-border/50">
                    <span className={`font-bold ${course.price === "Included" || course.price == 0 ? "text-green-600" : ""}`}>
                       {course.price === "Included" || course.price == 0 ? "Free" : `₹${course.price}`}
                    </span>
                    <Button variant="ghost" size="sm" className="gap-2 p-0 hover:bg-transparent hover:text-primary">
                      View Details <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>

      <Theme1FAQ />
      <Theme1CTA />
  </Theme1Layout>
    
  );
}
