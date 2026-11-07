import { AuthProvider } from './context/AuthContext';
import { AppRoutes } from './routes/appRoutes';

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}