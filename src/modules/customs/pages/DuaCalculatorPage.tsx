import { useState } from 'react';
import { DuaDashboardView } from '../components/DuaDashboardView';
import { DuaRegistrationView } from '../components/DuaRegistrationView';
import { Page } from '@/components/ui';

export default function DuaCalculatorPage() {
  const [currentView, setCurrentView] = useState<'dashboard' | 'register'>('dashboard');

  return (
    <Page>
      {currentView === 'dashboard' ? (
        <DuaDashboardView onOpenRegistration={() => setCurrentView('register')} />
      ) : (
        <DuaRegistrationView
          onBack={() => setCurrentView('dashboard')}
          onSuccess={() => setCurrentView('dashboard')}
        />
      )}
    </Page>
  );
}
