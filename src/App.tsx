import React, { useState, useEffect } from 'react';
import { Header } from './components/common/Header';
import { PublicHome } from './components/public/PublicHome';
import { AdminLogin } from './components/auth/AdminLogin';
import { ClientLogin } from './components/auth/ClientLogin';
import { ClientPortal } from './components/client/ClientPortal';
import { CounsellorPortal } from './components/counsellor/CounsellorPortal';
import { TokenAssessmentRunner } from './components/public/TokenAssessmentRunner';
import { ClientRegistration } from './components/client/ClientRegistration';
import { ClientAssessment } from './components/client/ClientAssessment';
import { AssessmentSuccess } from './components/client/AssessmentSuccess';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { ClientList } from './components/admin/ClientList';
import { ClientProfile } from './components/admin/ClientProfile';
import { FormManagement } from './components/admin/FormManagement';
import { WorkflowConfig } from './components/admin/WorkflowConfig';
import { NotificationCenter } from './components/admin/NotificationCenter';
import { StaffAndRoles } from './components/admin/StaffAndRoles';
import { CounsellorManagement } from './components/admin/CounsellorManagement';
import { AnalyticsExport } from './components/admin/AnalyticsExport';
import { dataService } from './services/dataService';
import { authService, AuthUser } from './services/authService';
import { Client, StaffUser, FormDefinition } from './types';
import { OfflineIndicator } from './components/pwa/OfflineIndicator';
import {
  Users,
  UserCheck,
  LayoutDashboard,
  FileSpreadsheet,
  GitBranch,
  Bell,
  ShieldCheck,
  Download,
  X,
  AlertCircle,
  ShieldAlert,
  ArrowLeft,
  Lock,
} from 'lucide-react';

type AppRoute =
  | 'home'
  | 'intake'
  | 'client-login'
  | 'client-portal'
  | 'token-assessment'
  | 'admin-login'
  | 'admin-portal'
  | 'counsellor-portal';

export default function App() {
  const [currentRoute, setCurrentRoute] = useState<AppRoute>('home');
  const [assessmentToken, setAssessmentToken] = useState<string | null>(null);

  // Authenticated user state
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => authService.getCurrentUser());

  // Admin section sub-tab
  const [adminTab, setAdminTab] = useState<string>('dashboard');
  const [selectedClientForProfile, setSelectedClientForProfile] = useState<Client | null>(null);
  const [previewForm, setPreviewForm] = useState<FormDefinition | null>(null);

  // Client assessment flow inside Client Portal
  const [activeClientAssessmentFormId, setActiveClientAssessmentFormId] = useState<string | null>(null);

  // Intake success result state
  const [intakeSuccessResult, setIntakeSuccessResult] = useState<{
    client: Client;
    startImmediate: boolean;
  } | null>(null);

  // Parse location and sync URL route
  const parseCurrentUrl = () => {
    const pathname = window.location.pathname;
    const search = window.location.search;
    const params = new URLSearchParams(search);

    const token = params.get('token') || params.get('clientKey');
    const routeParam = params.get('route') || params.get('view');

    // Token assessment link: /a/:token or ?token=... or ?clientKey=...
    if (pathname.startsWith('/a/')) {
      const extractedToken = pathname.replace('/a/', '').trim();
      if (extractedToken) {
        setAssessmentToken(extractedToken);
        setCurrentRoute('token-assessment');
        return;
      }
    }
    if (token) {
      setAssessmentToken(token);
      setCurrentRoute('token-assessment');
      return;
    }

    // Explicit path or query route matching
    if (pathname === '/intake' || routeParam === 'intake' || routeParam === 'client-register') {
      setCurrentRoute('intake');
      return;
    }
    if (pathname === '/client/login' || routeParam === 'client-login') {
      setCurrentRoute('client-login');
      return;
    }
    if (pathname === '/client' || routeParam === 'client') {
      // Require client authentication
      if (authService.isClient()) {
        setCurrentRoute('client-portal');
      } else {
        setCurrentRoute('client-login');
      }
      return;
    }
    if (pathname === '/admin/login' || routeParam === 'admin-login') {
      setCurrentRoute('admin-login');
      return;
    }
    if (pathname === '/counsellor' || routeParam === 'counsellor') {
      if (authService.isCounsellor() || authService.isSuperAdmin()) {
        setCurrentRoute('counsellor-portal');
      } else {
        setCurrentRoute('admin-login');
      }
      return;
    }
    if (pathname.startsWith('/admin') || routeParam === 'admin') {
      if (authService.isAuthenticated() && !authService.isClient()) {
        if (authService.isCounsellor()) {
          setCurrentRoute('counsellor-portal');
        } else {
          setCurrentRoute('admin-portal');
        }
      } else {
        setCurrentRoute('admin-login');
      }
      return;
    }

    // Default: Public Home
    setCurrentRoute('home');
  };

  useEffect(() => {
    parseCurrentUrl();

    // Listen for browser forward/backward
    const handlePopState = () => {
      parseCurrentUrl();
    };
    window.addEventListener('popstate', handlePopState);

    // Subscribe to auth state updates
    const unsubAuth = authService.subscribe((user) => {
      setCurrentUser(user);
    });

    return () => {
      window.removeEventListener('popstate', handlePopState);
      unsubAuth();
    };
  }, []);

  const navigateTo = (route: AppRoute, token?: string) => {
    let url = '/';
    if (route === 'home') url = '/';
    else if (route === 'intake') url = '/intake';
    else if (route === 'client-login') url = '/client/login';
    else if (route === 'client-portal') url = '/client';
    else if (route === 'admin-login') url = '/admin/login';
    else if (route === 'counsellor-portal') url = '/counsellor';
    else if (route === 'admin-portal') url = '/admin';
    else if (route === 'token-assessment' && token) url = `/a/${token}`;

    try {
      window.history.pushState({}, '', url);
    } catch {
      // In constrained iframes, ignore pushState errors
    }

    if (token) setAssessmentToken(token);
    setCurrentRoute(route);
  };

  const handleLogout = () => {
    authService.logout();
    setCurrentUser(null);
    setSelectedClientForProfile(null);
    setActiveClientAssessmentFormId(null);
    navigateTo('home');
  };

  const handleIntakeComplete = (newClient: Client, startImmediate: boolean) => {
    setIntakeSuccessResult({ client: newClient, startImmediate });
    if (startImmediate) {
      // Auto-sign in client so they can take the assessment seamlessly
      authService.registerClientCredentials(
        newClient.id,
        newClient.email,
        newClient.firstName,
        newClient.lastName,
        'Gamblepause'
      );
      navigateTo('client-portal');
      setActiveClientAssessmentFormId(newClient.nextAssessmentId || 'form-recovery-1');
    }
  };

  // Convert AuthUser to StaffUser for admin components that require StaffUser props
  const staffUser: StaffUser = {
    id: currentUser?.id || 'staff-superadmin',
    name: currentUser?.name || 'Abiodun Ayodeji',
    email: currentUser?.email || 'ayodejiharbiodun24@gmail.com',
    role: (currentUser?.role as any) || 'Super Admin',
    assignedClientsCount: 0,
    active: true,
  };

  // =========================================================================
  // RENDER ROUTE VIEWS
  // =========================================================================

  const renderCurrentView = () => {
    // 1. TOKEN ASSESSMENT RUNNER
    if (currentRoute === 'token-assessment' && assessmentToken) {
      return (
        <TokenAssessmentRunner
          token={assessmentToken}
          onExit={() => navigateTo('home')}
        />
      );
    }

  // 2. CLIENT LOGIN
  if (currentRoute === 'client-login') {
    return (
      <ClientLogin
        onLoginSuccess={(user) => {
          setCurrentUser(user);
          navigateTo('client-portal');
        }}
        onBackToHome={() => navigateTo('home')}
        onGoToIntake={() => navigateTo('intake')}
      />
    );
  }

  // 3. STAFF & ADMIN LOGIN
  if (currentRoute === 'admin-login') {
    return (
      <AdminLogin
        onLoginSuccess={(user) => {
          setCurrentUser(user);
          if (user.role === 'Counsellor') {
            navigateTo('counsellor-portal');
          } else {
            navigateTo('admin-portal');
          }
        }}
        onBackToHome={() => navigateTo('home')}
      />
    );
  }

  // 4. CLIENT PORTAL (Protected)
  if (currentRoute === 'client-portal') {
    // Route guard: Must be authenticated client
    if (!currentUser || currentUser.role !== 'Client') {
      return (
        <ClientLogin
          onLoginSuccess={(user) => {
            setCurrentUser(user);
            navigateTo('client-portal');
          }}
          onBackToHome={() => navigateTo('home')}
          onGoToIntake={() => navigateTo('intake')}
        />
      );
    }

    // If client clicked "Continue Assessment"
    if (activeClientAssessmentFormId && currentUser.clientId) {
      const activeClient = dataService.getClientById(currentUser.clientId);
      if (activeClient) {
        return (
          <div className="min-h-screen bg-gray-950 text-gray-100">
            <ClientAssessment
              client={activeClient}
              formId={activeClientAssessmentFormId}
              onCompleted={() => {
                setActiveClientAssessmentFormId(null);
              }}
              onExit={() => {
                setActiveClientAssessmentFormId(null);
              }}
            />
          </div>
        );
      }
    }

    return (
      <ClientPortal
        user={currentUser}
        onStartAssessment={(formId) => setActiveClientAssessmentFormId(formId)}
        onLogout={handleLogout}
      />
    );
  }

  // 5. COUNSELLOR PORTAL (Protected)
  if (currentRoute === 'counsellor-portal') {
    // Route guard: Must be counsellor or super admin
    if (!currentUser || (currentUser.role !== 'Counsellor' && currentUser.role !== 'Super Admin')) {
      return (
        <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-800 p-8 rounded-3xl max-w-md w-full text-center space-y-4 shadow-2xl">
            <div className="w-14 h-14 rounded-2xl bg-red-950 text-red-400 flex items-center justify-center mx-auto border border-red-500/30">
              <ShieldAlert className="w-7 h-7" />
            </div>
            <h1 className="text-xl font-bold text-white">ACCESS DENIED</h1>
            <p className="text-xs text-gray-400">
              Counsellor authentication required. You must sign in with an authorized GamblePause counsellor account.
            </p>
            <button
              onClick={() => navigateTo('admin-login')}
              className="w-full py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold transition-colors"
            >
              Go to Staff Login
            </button>
          </div>
        </div>
      );
    }

    return (
      <CounsellorPortal
        user={currentUser}
        onLogout={handleLogout}
      />
    );
  }

  // 6. ADMIN PORTAL (Protected: Super Admin & Staff)
  if (currentRoute === 'admin-portal') {
    // Route guard: Must be authenticated and not a client
    if (!currentUser || currentUser.role === 'Client') {
      return (
        <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-800 p-8 rounded-3xl max-w-md w-full text-center space-y-4 shadow-2xl">
            <div className="w-14 h-14 rounded-2xl bg-red-950 text-red-400 flex items-center justify-center mx-auto border border-red-500/30">
              <ShieldAlert className="w-7 h-7" />
            </div>
            <h1 className="text-xl font-bold text-white">ACCESS DENIED</h1>
            <p className="text-xs text-gray-400">
              Unauthenticated users are strictly forbidden from accessing the Admin Management Console.
            </p>
            <button
              onClick={() => navigateTo('admin-login')}
              className="w-full py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-semibold transition-colors"
            >
              Sign In to Admin Portal
            </button>
          </div>
        </div>
      );
    }

    // Counsellors who try to access /admin should be routed to their dedicated portal
    if (currentUser.role === 'Counsellor') {
      return <CounsellorPortal user={currentUser} onLogout={handleLogout} />;
    }

    // Render Authorized Admin Console
    return (
      <div className="min-h-screen bg-gray-50/80 text-gray-900 font-sans flex flex-col selection:bg-red-600 selection:text-white">
        <Header
          isAuthenticated={true}
          currentUser={currentUser}
          isAdminView={true}
          onLogout={handleLogout}
          onNavigateHome={() => navigateTo('home')}
        />

        {/* Admin Main Container */}
        <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
          {/* If Client Profile is selected, display it exclusively */}
          {selectedClientForProfile ? (
            <ClientProfile
              client={selectedClientForProfile}
              currentUser={staffUser}
              onBack={() => setSelectedClientForProfile(null)}
              onOpenAssessmentAsClient={(c) => {
                const token = dataService.getAssessmentToken(c.id, c.nextAssessmentId || 'form-recovery-1');
                if (token) {
                  navigateTo('token-assessment', token);
                }
              }}
            />
          ) : (
            <div className="space-y-6">
              {/* Admin Navigation Tabs */}
              <div className="bg-white rounded-2xl p-2 border border-gray-200 shadow-sm flex flex-wrap items-center gap-1.5 overflow-x-auto text-xs font-bold">
                {[
                  { id: 'dashboard', label: 'Dashboard & Metrics', icon: LayoutDashboard },
                  { id: 'clients', label: 'Client Registry', icon: Users },
                  { id: 'counsellors', label: 'Counsellors', icon: UserCheck },
                  { id: 'forms', label: 'Form Builder & Questions', icon: FileSpreadsheet },
                  { id: 'workflows', label: 'Assessment Sequences', icon: GitBranch },
                  { id: 'notifications', label: 'Reminder Engine', icon: Bell },
                  { id: 'roles', label: 'Staff & Security Roles', icon: ShieldCheck },
                  { id: 'reports', label: 'Reports & CSV Export', icon: Download },
                ].map((tab) => {
                  const Icon = tab.icon;
                  const isActive = adminTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setAdminTab(tab.id)}
                      className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl transition-all whitespace-nowrap cursor-pointer ${
                        isActive
                          ? 'bg-red-600 text-white shadow-sm'
                          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Sub-Views */}
              {adminTab === 'dashboard' && (
                <AdminDashboard
                  currentUser={staffUser}
                  onSelectClient={(c) => setSelectedClientForProfile(c)}
                  onNavigateTab={(tab) => setAdminTab(tab)}
                />
              )}

              {adminTab === 'clients' && (
                <ClientList
                  currentUser={staffUser}
                  onSelectClient={(c) => setSelectedClientForProfile(c)}
                  onNewClientClick={() => navigateTo('intake')}
                />
              )}

              {adminTab === 'counsellors' && (
                <CounsellorManagement
                  currentUser={staffUser}
                  onSelectClient={(c) => setSelectedClientForProfile(c)}
                  onNavigateTab={(tab) => setAdminTab(tab)}
                />
              )}

              {adminTab === 'forms' && (
                <FormManagement onPreviewForm={(form) => setPreviewForm(form)} />
              )}

              {adminTab === 'workflows' && <WorkflowConfig />}

              {adminTab === 'notifications' && <NotificationCenter />}

              {adminTab === 'roles' && (
                <StaffAndRoles
                  currentUser={staffUser}
                  onSwitchUser={() => {}}
                />
              )}

              {adminTab === 'reports' && (
                <AnalyticsExport currentUser={staffUser} />
              )}
            </div>
          )}
        </main>

        {/* Preview Modal */}
        {previewForm && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-gray-50 rounded-3xl max-w-xl w-full max-h-[90vh] overflow-y-auto border border-gray-200 shadow-2xl relative p-4 sm:p-6">
              <button
                onClick={() => setPreviewForm(null)}
                className="absolute top-4 right-4 p-2 rounded-full bg-gray-200 hover:bg-gray-300 text-gray-700 transition-all cursor-pointer z-10"
                title="Close Preview"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="mb-4 text-center">
                <span className="text-[10px] font-bold uppercase tracking-wider bg-purple-100 text-purple-700 px-2.5 py-0.5 rounded-full">
                  Form Question Preview
                </span>
              </div>
              <ClientAssessment
                client={dataService.getClients()[0]}
                formId={previewForm.id}
                onCompleted={() => setPreviewForm(null)}
                onExit={() => setPreviewForm(null)}
              />
            </div>
          </div>
        )}

        {/* Footer */}
        <footer className="bg-white border-t border-gray-200 py-4 px-4 mt-auto">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-500">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-red-600" />
              <span className="font-bold text-gray-900">GamblePause Client Management & Assessment System</span>
            </div>
            <div className="flex items-center gap-4 text-xs font-semibold">
              <span>Maintained by <strong className="text-red-600">GamblePause Digital Team</strong></span>
              <span>&bull;</span>
              <span>NDPR Protected</span>
            </div>
          </div>
        </footer>
      </div>
    );
  }

  // 7. INTAKE REGISTRATION VIEW
  if (currentRoute === 'intake') {
    return (
      <div className="min-h-screen bg-gray-50 text-gray-900 flex flex-col justify-between">
        <Header
          onNavigateHome={() => navigateTo('home')}
          onClientLogin={() => navigateTo('client-login')}
        />

        <main className="flex-1 max-w-3xl w-full mx-auto p-4 sm:p-6 lg:p-8">
          <div className="mb-4">
            <button
              onClick={() => navigateTo('home')}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-800 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to GamblePause Home</span>
            </button>
          </div>

          <ClientRegistration
            onRegistrationComplete={handleIntakeComplete}
          />
        </main>

        <footer className="border-t border-gray-200 bg-white py-4 px-4 text-center text-xs text-gray-500">
          GamblePause Initiative Africa &bull; Confidential Intake &bull; Developed by <strong className="text-red-600">GamblePause Digital Team</strong>
        </footer>
      </div>
    );
  }

  // 8. DEFAULT: PUBLIC HOME EXPERIENCE
  return (
    <PublicHome
      onStartIntake={() => navigateTo('intake')}
      onClientLogin={() => navigateTo('client-login')}
      onStaffLogin={() => navigateTo('admin-login')}
    />
  );
};

  return (
    <>
      {renderCurrentView()}
      <OfflineIndicator />
    </>
  );
}
