import { BrowserRouter, Route, Routes } from "react-router"
import { ROUTES } from "./constants/routes"
import HomePage from "./pages/HomePage"
import KanbanPage from "./pages/KanbanPage"

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  )
}

function AppRoutes() {
  return (
    <Routes>
      <Route path={ROUTES.home} element={<HomePage />} />
      <Route path={ROUTES.kanban} element={<KanbanPage />} />
    </Routes>
  )
}
