import { Link, Route, Routes } from 'react-router-dom'
import { LoginPage, NewTaskPage, ProductReviewPage, CopyReviewPage, TaskListPage, NotFoundPage } from './pages'

export function App() {
  return <main><header><h1>商品资料工作台</h1><nav><Link to="/tasks">任务</Link><Link to="/tasks/new">新建任务</Link></nav></header><Routes><Route path="/" element={<TaskListPage />} /><Route path="/login" element={<LoginPage />} /><Route path="/tasks" element={<TaskListPage />} /><Route path="/tasks/new" element={<NewTaskPage />} /><Route path="/tasks/:taskId/products" element={<ProductReviewPage />} /><Route path="/tasks/:taskId/copy" element={<CopyReviewPage />} /><Route path="*" element={<NotFoundPage />} /></Routes></main>
}
