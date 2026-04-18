import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Workers from './pages/Workers';
import Roles from './pages/Roles';
import Logs from './pages/Logs';
import Analytics from './pages/Analytics';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="workers" element={<Workers />} />
        <Route path="roles" element={<Roles />} />
        <Route path="logs" element={<Logs />} />
        <Route path="analytics" element={<Analytics />} />
      </Route>
    </Routes>
  );
}
