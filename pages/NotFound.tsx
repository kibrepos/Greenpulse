import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import "../styles/NotFound.css";

interface ErrorDetail {
  code: number;
  title: string;
  description: string;
}

// Define the list of HTTP errors
const httpErrors: ErrorDetail[] = [
  { code: 100, title: 'Continue', description: 'The initial part of the request has been received, and the client should continue with the request.' },
  { code: 200, title: 'OK', description: 'The request was successful.' },
  { code: 201, title: 'Created', description: 'A new resource was successfully created.' },
  { code: 301, title: 'Moved Permanently', description: 'The resource has been permanently moved to a new URL.' },
  { code: 302, title: 'Found', description: 'The resource is temporarily located at a different URL.' },
  { code: 400, title: 'Bad Request', description: "The server couldn't understand the request due to malformed syntax." },
  { code: 401, title: 'Unauthorized', description: 'Authentication is required, and the user hasn’t provided valid credentials.' },
  { code: 403, title: 'Forbidden', description: 'The server understood the request but refuses to authorize it.' },
  { code: 404, title: 'Not Found', description: 'The requested resource could not be found on the server.' },
  { code: 500, title: 'Internal Server Error', description: 'The server encountered an unexpected condition that prevented it from fulfilling the request.' },
  { code: 503, title: 'Service Unavailable', description: 'The server is currently unable to handle the request, often due to overload or maintenance.' },
];

const NotFound: React.FC = () => {
  const location = useLocation();
  const state = location.state as { errorCode?: number; errorMessage?: string };
  const statusCode = state?.errorCode || 404;
  const errorDetail = httpErrors.find((error) => error.code === statusCode);
  const navigate = useNavigate();

  return (
    <div className="not-found-container">
      <div className="not-found-box">
        <h1 className="not-found-title">
          {statusCode} - {errorDetail?.title || 'Error'}
        </h1>
        <p className="not-found-description">
          {state?.errorMessage || errorDetail?.description || 'An unexpected error occurred.'}
        </p>
        <button className="not-found-back-button" onClick={() => navigate('/')}>
          Go Back
        </button>
      </div>
    </div>
  );
};


export default NotFound;
