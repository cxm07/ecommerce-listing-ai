import { Route, Routes } from 'react-router-dom';
import { AuditPage, CopyReviewPage, ExportPage, LoginPage, NewTaskPage, NotFoundPage, ProcessingPage, ProductReviewPage, TaskListPage, UploadPage } from './pages';

export function App() {
  return <Routes><Route path="/" element={<TaskListPage />} /><Route path="/login" element={<LoginPage />} /><Route path="/tasks" element={<TaskListPage />} /><Route path="/tasks/new" element={<NewTaskPage />} /><Route path="/tasks/:taskId/upload" element={<UploadPage />} /><Route path="/tasks/:taskId/processing" element={<ProcessingPage />} /><Route path="/tasks/:taskId/products" element={<ProductReviewPage />} /><Route path="/tasks/:taskId/copy" element={<CopyReviewPage />} /><Route path="/tasks/:taskId/export" element={<ExportPage />} /><Route path="/tasks/:taskId/audit" element={<AuditPage />} /><Route path="*" element={<NotFoundPage />} /></Routes>;
}
