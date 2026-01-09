import { lazy, Suspense } from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { NotesProvider } from './contexts/NotesContext';
import { ReviewsProvider } from './contexts/ReviewsContext';
import Layout from './layouts/MainLayout';
import ProtectedRoute from './components/auth/ProtectedRoute';
import AuthRoute from './components/auth/AuthRoute';
import { Loader } from './components/ui';

// Lazy load components
const Login = lazy(() => import('./pages/auth/Login'));
const Register = lazy(() => import('./pages/auth/Register'));
const ForgotPassword = lazy(() => import('./pages/auth/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/auth/ResetPassword'));
const Home = lazy(() => import('./pages/Home'));
const NotesList = lazy(() => import('./pages/notes/NotesList'));
const NoteDetail = lazy(() => import('./pages/notes/NoteDetail'));
const NoteCreate = lazy(() => import('./pages/notes/NoteCreate'));
const NoteEdit = lazy(() => import('./pages/notes/NoteEdit'));
const FoldersList = lazy(() => import('./pages/folders/FoldersList'));
const ReviewsList = lazy(() => import('./pages/reviews/ReviewsList'));
const ReviewDetail = lazy(() => import('./pages/reviews/ReviewDetail'));
const ReviewCreate = lazy(() => import('./pages/reviews/ReviewCreate'));
const ReviewEdit = lazy(() => import('./pages/reviews/ReviewEdit'));
const Settings = lazy(() => import('./pages/Settings'));
const Profile = lazy(() => import('./pages/Profile'));

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <NotesProvider>
          <ReviewsProvider>
            <Router>
              <Suspense
                fallback={
                  <div className="flex items-center justify-center min-h-screen">
                    <Loader size="lg" />
                  </div>
                }
              >
                <Routes>
                  {/* Auth routes */}
                  <Route
                    path="/auth/*"
                    element={
                      <AuthRoute>
                        <Routes>
                          <Route path="login" element={<Login />} />
                          <Route path="register" element={<Register />} />
                          <Route
                            path="forgot-password"
                            element={<ForgotPassword />}
                          />
                          <Route
                            path="reset-password"
                            element={<ResetPassword />}
                          />
                          <Route
                            path="*"
                            element={<Navigate to="/auth/login" replace />}
                          />
                        </Routes>
                      </AuthRoute>
                    }
                  />

                  {/* Protected routes */}
                  <Route
                    path="/*"
                    element={
                      <ProtectedRoute>
                        <Layout />
                      </ProtectedRoute>
                    }
                  >
                    <Route index element={<Home />} />
                    <Route path="notes">
                      <Route index element={<NotesList />} />
                      <Route path="new" element={<NoteCreate />} />
                      <Route path=":id" element={<NoteDetail />} />
                      <Route path="edit/:id" element={<NoteEdit />} />
                    </Route>
                    <Route path="folders" element={<FoldersList />} />
                    <Route path="reviews">
                      <Route index element={<ReviewsList />} />
                      <Route path="new" element={<ReviewCreate />} />
                      <Route path=":id" element={<ReviewDetail />} />
                      <Route path="edit/:id" element={<ReviewEdit />} />
                    </Route>
                    <Route path="settings" element={<Settings />} />
                    <Route path="profile" element={<Profile />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Route>
                </Routes>
              </Suspense>
            </Router>
          </ReviewsProvider>
        </NotesProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
