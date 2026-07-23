import { Route, Routes } from 'react-router-dom';
import type { ReactNode } from 'react';
import { AppErrorBoundary } from './components/AppErrorBoundary';
import { AuthLoginPage } from './auth/AuthLoginPage';
import { AuthProvider } from './auth/AuthProvider';
import { ProtectedRoute } from './auth/RouteGuards';
import type { AuthRepository } from './auth/contracts';
import { AuditPage, CopyReviewPage, ExportPage, NewTaskPage, NotFoundPage, ProcessingPage, ProductReviewPage, TaskListPage, UploadPage } from './pages';

function protectedPage(testId: string, element: ReactNode) {
  return <ProtectedRoute><div data-testid={testId}>{element}</div></ProtectedRoute>;
}

export function App({ authRepository }: { authRepository?: AuthRepository }) {
  return <AuthProvider repository={authRepository}><AppErrorBoundary><Routes>
    <Route path="/" element={protectedPage('task-list-page', <TaskListPage />)} />
    <Route path="/login" element={<AuthLoginPage />} />
    <Route path="/forbidden" element={<main className="login-layout" data-testid="forbidden-page"><section className="login-card"><p className="eyebrow">403</p><h1>无权访问</h1><p className="muted">当前身份不具备访问该功能的权限，请联系管理员。</p></section></main>} />
    <Route path="/tasks" element={protectedPage('task-list-page', <TaskListPage />)} />
    <Route path="/tasks/new" element={protectedPage('new-task-page', <NewTaskPage />)} />
    <Route path="/tasks/:taskId/upload" element={protectedPage('upload-page', <UploadPage />)} />
    <Route path="/tasks/:taskId/processing" element={protectedPage('processing-page', <ProcessingPage />)} />
    <Route path="/tasks/:taskId/products" element={protectedPage('product-review-page', <ProductReviewPage />)} />
    <Route path="/tasks/:taskId/copy" element={protectedPage('copy-review-page', <CopyReviewPage />)} />
    <Route path="/tasks/:taskId/export" element={protectedPage('export-page', <ExportPage />)} />
    <Route path="/tasks/:taskId/audit" element={protectedPage('audit-page', <AuditPage />)} />
    <Route path="*" element={protectedPage('not-found-page', <NotFoundPage />)} />
  </Routes></AppErrorBoundary></AuthProvider>;
}
