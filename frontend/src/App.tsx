import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { Suspense, lazy } from 'react';

import { Layout } from '@/components/layout/Layout';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { LoadingSkeleton } from '@/components/common/LoadingSkeleton';

// Lazy-load pages for code splitting
const DashboardPage = lazy(() => import('@/pages/DashboardPage'));
const DatasetPage = lazy(() => import('@/pages/DatasetPage'));
const TrainingPage = lazy(() => import('@/pages/TrainingPage'));
const EvaluationPage = lazy(() => import('@/pages/EvaluationPage'));
const ExplainabilityPage = lazy(() => import('@/pages/ExplainabilityPage'));
const PredictionPage = lazy(() => import('@/pages/PredictionPage'));
const ExperimentsPage = lazy(() => import('@/pages/ExperimentsPage'));

function PageFallback() {
  return (
    <div className="p-6">
      <LoadingSkeleton lines={6} />
    </div>
  );
}

function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
      <p className="text-5xl font-bold text-gray-700">404</p>
      <p className="text-gray-400">Page not found</p>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: '#1f2937',
              color: '#f3f4f6',
              border: '1px solid #374151',
              fontSize: '13px',
            },
            success: { iconTheme: { primary: '#34d399', secondary: '#1f2937' } },
            error: { iconTheme: { primary: '#f87171', secondary: '#1f2937' } },
          }}
        />

        <Routes>
          <Route element={<Layout />}>
            <Route
              index
              element={
                <Suspense fallback={<PageFallback />}>
                  <DashboardPage />
                </Suspense>
              }
            />
            <Route
              path="dataset"
              element={
                <Suspense fallback={<PageFallback />}>
                  <DatasetPage />
                </Suspense>
              }
            />
            <Route
              path="training"
              element={
                <Suspense fallback={<PageFallback />}>
                  <TrainingPage />
                </Suspense>
              }
            />
            <Route
              path="evaluation"
              element={
                <Suspense fallback={<PageFallback />}>
                  <EvaluationPage />
                </Suspense>
              }
            />
            <Route
              path="explainability"
              element={
                <Suspense fallback={<PageFallback />}>
                  <ExplainabilityPage />
                </Suspense>
              }
            />
            <Route
              path="prediction"
              element={
                <Suspense fallback={<PageFallback />}>
                  <PredictionPage />
                </Suspense>
              }
            />
            <Route
              path="experiments"
              element={
                <Suspense fallback={<PageFallback />}>
                  <ExperimentsPage />
                </Suspense>
              }
            />
            {/* Legacy routes from old app */}
            <Route path="models" element={<Navigate to="/evaluation" replace />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </ErrorBoundary>
    </BrowserRouter>
  );
}
