import { BrowserRouter as Router, Routes, Route } from "react-router-dom"
import { Layout } from "./components/layout/Layout"
import Dashboard from "./pages/Dashboard"
import ProjectDetail from "./pages/ProjectDetail"
import ScanReport from "./pages/ScanReport"
import CompareScans from "./pages/CompareScans"

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="project/:id" element={<ProjectDetail />} />
          <Route path="scan/:id" element={<ScanReport />} />
          <Route path="compare" element={<CompareScans />} />
        </Route>
      </Routes>
    </Router>
  )
}

export default App
