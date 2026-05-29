import { createBrowserRouter, RouterProvider, Navigate, Outlet } from 'react-router';
import { Login } from './pages/Login';

function ProtectedRoute() {
  const token = localStorage.getItem('camflow_token');
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
}

function Dashboard() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 pt-14">
      <p className="text-gray-700 dark:text-gray-300 p-4">Dashboard — ready for command panel.</p>
    </div>
  );
}

const router = createBrowserRouter([
  {
    path: '/login',
    element: <Login />,
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        path: '/',
        element: <Dashboard />,
      },
    ],
  },
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
