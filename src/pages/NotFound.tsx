import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { ButtonWithIcon } from "@shared/ui/button";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="min-h-screen gradient-hero flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <div className="text-8xl font-bold text-primary mb-4">404</div>
        <h1 className="text-3xl font-bold mb-4">Page Not Found</h1>
        <p className="text-muted-foreground mb-8">
          Oops! The page you're looking for doesn't exist or has been moved.
        </p>
        <Link to="/">
          <ButtonWithIcon variant="hero" size="lg">
            Back to Home
          </ButtonWithIcon>
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
