// src/components/PublicRoute.tsx
import React, { useEffect, useState, ReactNode } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { useAuth  } from '../services/auth';


const PublicRoute: React.FC = () => {
  const { isAuthenticated, userType, loading } = useAuth();

  if (loading) {
    return <div></div>; // Show a loading state while authentication is being resolved
  }

  if (isAuthenticated) {
    // Redirect based on the user type

    if (userType === 'superadmin') {
      return <Navigate to="/SuperAdmin/dashboard" replace />;
    }
    if (userType === 'student') {
      return <Navigate to="/dashboard" replace />;
    }
    if (userType === 'faculty') {
      return <Navigate to="/dashboard" replace />;
    }
    if (userType === 'admin') {
      return <Navigate to="/Admin/dashboard" replace />; // Adjust based on your admin dashboard path
    }
  }

  // If not authenticated, render the public route (e.g., login page)
  return <Outlet />;
};

export default PublicRoute;