import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { SidebarProvider } from './context/SidebarContext'
import Layout from './components/Layout'
import ClimateStudio from './pages/ClimateStudio'
import WaterAccess from './pages/WaterAccess'
import './App.css'

function App() {
  return (
    <BrowserRouter>
      <SidebarProvider>
        <Layout>
          <Routes>
            <Route path="/" element={<ClimateStudio />} />
            <Route path="/climate-studio" element={<ClimateStudio />} />
            <Route path="/water-access" element={<WaterAccess />} />
          </Routes>
        </Layout>
      </SidebarProvider>
    </BrowserRouter>
  )
}

export default App
