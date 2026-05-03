import React from "react";
import { Navigate, Route } from "react-router-dom";

import CompleteProfile from "@/pages/CompleteProfile";
import Contact from "@/pages/Contact";
import Features from "@/pages/Features";
import HowItWorks from "@/pages/HowItWorks";
import Impersonate from "@/pages/Impersonate";
import Index from "@/pages/Index";
import Join from "@/pages/Join";
import Login from "@/pages/Login";
import NotFound from "@/pages/NotFound";
import Pricing from "@/pages/Pricing";
import Signup from "@/pages/Signup";

export function getSharedPublicRoutes() {
  return (
    <>
      <Route path="/impersonate" element={<Impersonate />} />
      <Route path="/join/:token" element={<Join />} />
    </>
  );
}

export function getMainDomainPublicRoutes() {
  return (
    <>
      <Route path="/" element={<Index />} />
      <Route path="/how-it-works" element={<HowItWorks />} />
      <Route path="/pricing" element={<Pricing />} />
      <Route path="/admin/login" element={<Login />} />
      <Route path="/contact" element={<Contact />} />
      <Route path="/features" element={<Features />} />
      <Route path="/complete-profile" element={<CompleteProfile />} />
      <Route path="*" element={<NotFound />} />
    </>
  );
}

export function getTenantDomainPublicRoutes(tenantHome: React.ReactElement, tenantCourses: React.ReactElement) {
  return (
    <>
      <Route path="/" element={tenantHome} />
      <Route path="/courses" element={tenantCourses} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/complete-profile" element={<CompleteProfile />} />
      <Route path="*" element={<NotFound />} />
    </>
  );
}

export function getAdminRedirectRoute() {
  return <Route index element={<Navigate to="dashboard" replace />} />;
}
