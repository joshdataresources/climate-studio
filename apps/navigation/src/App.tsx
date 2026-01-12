import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { SidebarProvider } from './context/SidebarContext'
import { ThemeProvider } from './context/ThemeContext'
import Layout from './components/Layout'
import ClimateStudio from './pages/ClimateStudio'
import WaterAccess from './pages/WaterAccess'
import AquiferProjection from './pages/AquiferProjection'
import './App.css'

function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <SidebarProvider>
          <Layout>
            <Routes>
              <Route path="/" element={<ClimateStudio />} />
              <Route path="/climate-studio" element={<ClimateStudio />} />
              <Route path="/water-access" element={<WaterAccess />} />
              <Route path="/aquifer-projection" element={<AquiferProjection />} />
            </Routes>
          </Layout>
        </SidebarProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}

export default App
