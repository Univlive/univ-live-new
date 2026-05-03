import React from "react";
import { Route, Routes } from "react-router-dom";

import { useTenant } from "@app/providers/TenantProvider";
import AdminTestManager from "@/pages/AdminTestManager";
import AdminQuestions from "@features/admin/Questions";
import TenantCourses from "@/themes/coaching/theme1/TenantCourses";
import TenantHome from "@/themes/coaching/TenantHome";

import { getAdminRoutes } from "@app/routes/adminRoutes";
import { getEducatorRoutes } from "@app/routes/educatorRoutes";
import { getSharedPublicRoutes, getMainDomainPublicRoutes, getTenantDomainPublicRoutes, getAdminRedirectRoute } from "@app/routes/publicRoutes";
import { getStudentRoutes } from "@app/routes/studentRoutes";

export default function AppRoutes() {
  const { isTenantDomain } = useTenant();

  return (
    <Routes>
      {getSharedPublicRoutes()}
      {getStudentRoutes()}

      {isTenantDomain ? (
        <>
          {getTenantDomainPublicRoutes(<TenantHome />, <TenantCourses />)}
          <Route path="/admin-test" element={<AdminTestManager />} />
          <Route path="/admin-test/questions/:testId" element={<AdminQuestions />} />
          {getEducatorRoutes()}
        </>
      ) : (
        <>
          {getMainDomainPublicRoutes()}
          {getAdminRoutes(getAdminRedirectRoute())}
          {getEducatorRoutes()}
        </>
      )}
    </Routes>
  );
}
