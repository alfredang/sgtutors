import { createBrowserRouter, Outlet, Navigate } from "react-router-dom";
import { Navbar } from "./components/Navbar";
import { Footer } from "./components/Footer";
import { useAuth } from "./lib/auth";
import { HomePage } from "./pages/Home";
import { TutorSearchPage } from "./pages/TutorSearch";
import { TutorDetailPage } from "./pages/TutorDetail";
import { SignupPage } from "./pages/Signup";
import { LoginPage } from "./pages/Login";
import { DashboardPage } from "./pages/Dashboard";
import { InterviewPage } from "./pages/Interview";
import { AdminLoginPage } from "./pages/AdminLogin";
import { AdminPage } from "./pages/Admin";

function Layout() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}

function ProtectedRoute() {
  const { tutorLoggedIn, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
      </div>
    );
  }
  return tutorLoggedIn ? <Outlet /> : <Navigate to="/login" replace />;
}

export const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: "/", element: <HomePage /> },
      { path: "/tutors", element: <TutorSearchPage /> },
      { path: "/tutors/:id", element: <TutorDetailPage /> },
      { path: "/signup", element: <SignupPage /> },
      { path: "/login", element: <LoginPage /> },
      {
        element: <ProtectedRoute />,
        children: [
          { path: "/dashboard", element: <DashboardPage /> },
          { path: "/dashboard/interview", element: <InterviewPage /> },
        ],
      },
    ],
  },
  { path: "/admin/login", element: <AdminLoginPage /> },
  { path: "/admin", element: <AdminPage /> },
]);
