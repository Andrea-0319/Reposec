import { BrowserRouter as Router, Routes, Route, useLocation } from "react-router-dom"
import { Layout } from "./components/layout/Layout"
import { ErrorBoundary } from "./components/ErrorBoundary"
import Dashboard from "./pages/Dashboard"
import ProjectDetail from "./pages/ProjectDetail"
import ScanReport from "./pages/ScanReport"
import CompareScans from "./pages/CompareScans"
import AllScans from "./pages/AllScans"
import Settings from "./pages/Settings"
import LaunchScan from "./pages/LaunchScan"

function AppRoutes() {
  const location = useLocation()

  return (
    <ErrorBoundary resetKey={location.pathname}>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="project/:id" element={<ProjectDetail />} />
          <Route path="scan/:id" element={<ScanReport />} />
          <Route path="compare" element={<CompareScans />} />
          <Route path="scans" element={<AllScans />} />
          <Route path="launch" element={<LaunchScan />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </ErrorBoundary>
  )
}

function App() {
  return (
    <Router>
      <AppRoutes />
    </Router>
  )
}

export default App
