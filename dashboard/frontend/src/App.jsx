import ManageEmployee from './ManageEmployee';
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import './css/App.css';
import{Navbar} from'./Navbar'
import {Footer} from './Footer'
import {Home} from './home';
import{MeetingZone}from './meetingzone';
import {Sitewisefb} from'./sites';
import{AllFeedbacks} from './showfb';
import {Addform} from './add-form'
import{Login} from './login'
import { Logout } from "./logout";
import { AdminPanel } from "./AdminPanel";
import { Todo } from "./todo";
import { ProtectedRoute } from "./ProtectedRoute";
import { ToastContainer } from "./Toast";
import { AuthProvider } from './AuthContext';

function App() {
  return (
    <AuthProvider>
      <div className="App">
        <div className="navbar">
          <Navbar/>
        </div>
        
        <main className="page-content">
          <Routes>
            <Route path="/" element={
              <ProtectedRoute requireAuth={true}>
                <Home />
              </ProtectedRoute>
            } />
            <Route path="/allfeedbacks" element={
              <ProtectedRoute requireAuth={true}>
                <AllFeedbacks />
              </ProtectedRoute>
            } />
            <Route path="/meetingzone" element={
              <ProtectedRoute requireAuth={true}>
                <MeetingZone />
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
          </Routes>
        </main>
        
        <Footer />
        <ToastContainer />
      </div>
    </AuthProvider>
  );
}

export default App;
