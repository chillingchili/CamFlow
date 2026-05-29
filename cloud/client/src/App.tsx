import { createBrowserRouter, RouterProvider, Navigate, Outlet } from 'react-router';
import { Login } from './pages/Login';
import { Dashboard } from './components/Dashboard';
import { CommandPanel } from './components/CommandPanel';

function ProtectedRoute() {
  const token = localStorage.getItem('camflow_token');
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
}

function MainDashboard() {
  return (
    <Dashboard>
      <CommandPanel />
    </Dashboard>
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
        element: <MainDashboard />,
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
