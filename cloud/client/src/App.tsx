import { useState } from 'react';
import { createBrowserRouter, RouterProvider, Navigate, Outlet } from 'react-router';
import { Login } from './pages/Login';
import { Dashboard } from './components/Dashboard';
import { TabBar } from './components/TabBar';
import { SettingsPanel } from './components/SettingsPanel';
import { Setup } from './pages/Setup';
import { Live } from './pages/Live';

function ProtectedRoute() {
  const token = localStorage.getItem('camflow_token');
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
}

function MainDashboard() {
  const [activeTab, setActiveTab] = useState<'setup' | 'live'>('setup');
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <Dashboard>
      <TabBar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onSettingsOpen={() => setSettingsOpen(true)}
      />
      <SettingsPanel isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
      {activeTab === 'setup' ? <Setup /> : <Live />}
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
