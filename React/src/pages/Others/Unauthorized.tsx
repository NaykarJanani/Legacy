import React from "react";
import { useNavigate } from "react-router-dom";

const Unauthorized: React.FC = () => {
  const navigate = useNavigate();
  return (
    <div className="d-flex flex-column align-items-center justify-content-center vh-100 bg-light">
      <h1 className="display-4 text-danger mb-3">403 - Unauthorized</h1>
      <p className="lead text-muted mb-4">
        Sorry, you don’t have permission to access this page.
      </p>



      <div className="d-flex gap-3">
        <button onClick={() => navigate(-3)} className="btn btn-primary">
          Go Back
        </button>
        <button onClick={() => { navigate('/logout') }} className="btn btn-danger">
          Logout
        </button>
      </div>
    </div>
  );
};

export default Unauthorized;
