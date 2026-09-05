import React from "react";
import { Link, useNavigate } from "react-router-dom";

const NotFound: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="d-flex flex-column align-items-center justify-content-center vh-100 bg-light">
      <h1 className="display-4 text-danger mb-3">404 - Page Not Found</h1>
      <p className="lead text-muted mb-4">
        Sorry, the page you are looking for doesn’t exist or has been moved.
      </p>

      <div className="d-flex gap-3">
        <Link to="/" className="btn btn-primary">
          Go to Home
        </Link>
        <button onClick={() => navigate(-1)} className="btn btn-secondary">
          Go Back
        </button>
          <button onClick={()=>{navigate('/logout')}} className="btn btn-danger">
          Logout
        </button>
      </div>
    </div>
  );
};

export default NotFound;
