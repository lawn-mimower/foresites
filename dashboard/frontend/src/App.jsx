import { useEffect } from 'react';
import ManageEmployee from './ManageEmployee';
import { Routes, Route } from "react-router-dom";
import './css/App.css';
import './css/design-system.css';
import{Navbar} from'./Navbar'
import {Footer} from './Footer'
import ForesitesDashboard from './ForesitesDashboard';
import{AssignedJobs}from './AssignedJobs';
import{AssignSnags}from './AssignSnags';
import {Sitewisefb} from'./sites';
import{AllFeedbacks} from './showfb';
import {Addform} from './add-form'
import{Login} from './login'
import { Logout } from "./logout";
import { AdminPanel } from "./AdminPanel";
import { Todo } from "./todo";
import { ChatPanel } from "./ChatPanel";
import { ProtectedRoute } from "./ProtectedRoute";
import { ToastContainer } from "./Toast";
import { AuthProvider } from './AuthContext';
import { setImpactMap } from './utils/snagHelpers';
import { API_BASE } from './config/api';

function App() {
  useEffect(() => {
    fetch(`${API_BASE}/impact-mapping`)
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        if (Array.isArray(data)) {
          const map = {};
          data.forEach(r => { map[r.category] = r.impact_level; });
          setImpactMap(map);
        }
      })
      .catch(() => {}); // fallback to hardcoded mapping
  }, []);

  return (
    <AuthProvider>
      <div className="App">
        <Navbar/>

        <main className="page-content">
          <Routes>
            <Route path="/" element={
              <ProtectedRoute requireAuth={true}>
                <ForesitesDashboard />
              </ProtectedRoute>
            } />
            <Route path="/allfeedbacks" element={
              <ProtectedRoute requireAuth={true}>
                <AllFeedbacks />
              </ProtectedRoute>
            } />
            <Route path="/meetingzone" element={
              <ProtectedRoute requireAuth={true}>
                <AssignedJobs />
              </ProtectedRoute>
            } />
            <Route path="/assignedjobs" element={
              <ProtectedRoute requireAuth={true}>
                <AssignedJobs />
              </ProtectedRoute>
            } />
            <Route path="/showsites" element={
              <ProtectedRoute requireAuth={true}>
                <Sitewisefb />
              </ProtectedRoute>
            } />
            <Route path="/add-form" element={
              <ProtectedRoute requireAuth={true} requireAdmin={true}>
                <Addform/>
              </ProtectedRoute>
            }/>
            <Route path="/assign-snags" element={
              <ProtectedRoute requireAuth={true} requireAdmin={true}>
                <AssignSnags/>
              </ProtectedRoute>
            }/>
            <Route path='/login' element={<Login/>}></Route>
            <Route path="/logout" element={<Logout/>}></Route>
            <Route path="/admin" element={
              <ProtectedRoute requireAuth={true} requireSuperAdmin={true}>
                <AdminPanel/>
              </ProtectedRoute>
            }></Route>
              <Route path="/manage-employee" element={<ProtectedRoute><ManageEmployee /></ProtectedRoute>} />
            <Route path="/todos" element={
              <ProtectedRoute requireAuth={true}>
                <Todo />
              </ProtectedRoute>
            } />
            <Route path="/chat" element={
              <ProtectedRoute requireAuth={true}>
                <ChatPanel />
              </ProtectedRoute>
            } />
          </Routes>
        </main>

        <Footer />
        <ToastContainer />
      </div>
    </AuthProvider>
  );
}

export default App;
