import { ReactNode } from "react";
import  Navbar  from "./Navbar";
import  Footer  from "./Footer";
import { AnnouncementBar, SHOW_ANNOUNCEMENT } from "./AnnouncementBar";

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen flex flex-col">
      <AnnouncementBar />
      <Navbar />
      <main className={`flex-1 ${SHOW_ANNOUNCEMENT ? "pt-24" : "pt-16"}`}>{children}</main>
      <Footer />
    </div>
  );
}