import { Link, useLocation } from "react-router-dom";
import { useState } from "react";
import { useAuth } from './AuthContext';
import { Logo } from './components/Logo';
import './css/navbar.css';

export function Navbar() {
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const { user, isAuthenticated, logout, isAdmin } = useAuth();

  const toggleMobileMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen);
  const closeMobileMenu = () => setIsMobileMenuOpen(false);
  const isActive = (path) => location.pathname === path;

  const handleLogout = async () => {
    await logout();
    setShowUserMenu(false);
    closeMobileMenu();
  };





  return (
    <div className="navigation">
      <div className="nav-brand">
        <Link to="/" className="brand-link">
          <Logo size="medium" showText={true} />
        </Link>
      </div>

      <button 
        className="mobile-menu-toggle"
        onClick={toggleMobileMenu}
        aria-label="Toggle mobile menu"
      >
        <span className={`hamburger ${isMobileMenuOpen ? 'open' : ''}`}>
          <span></span>
          <span></span>
          <span></span>
        </span>
      </button>

      <div className={`nav-links ${isMobileMenuOpen ? 'open' : ''}`}>
        <Link 
          to="/" 
          className={isActive('/') ? 'active' : ''}
          onClick={closeMobileMenu}
        >
          Home
        </Link>
        <Link 
          to="/allfeedbacks" 
          className={isActive('/allfeedbacks') ? 'active' : ''}
          onClick={closeMobileMenu}
        >
          All Feedbacks
        </Link>
        <Link 
          to="/meetingzone" 
          className={isActive('/meetingzone') ? 'active' : ''}
          onClick={closeMobileMenu}
        >
          Meeting Zone
        </Link>
        <Link 
          to="/showsites" 
          className={isActive('/showsites') ? 'active' : ''}
          onClick={closeMobileMenu}
        >
          Sites
        </Link>
        <Link 
          to="/add-form" 
          className={isActive('/add-form') ? 'active' : ''}
          onClick={closeMobileMenu}
        >
          Manage Access Points
        </Link>
        <Link 
          to="/todos" 
          className={isActive('/todos') ? 'active' : ''}
          onClick={closeMobileMenu}
        >
          My Tasks
        </Link>

        {isAuthenticated() ? (
          <>
            {isAdmin() && (
              <>
                <Link 
                  to="/admin" 
                  className={isActive('/admin') ? 'active' : ''}
                  onClick={closeMobileMenu}
                >
                  Admin Panel
                </Link>

                      <Link 
                        to="/manage-employee" 
                        className={isActive('/manage-employee') ? 'active' : ''}
                        onClick={closeMobileMenu}
                      >
                        Manage Employee
                      </Link>

            
              </>
            )}

            <div className="user-menu">
              <button 
                className="user-menu-toggle"
                onClick={() => setShowUserMenu(!showUserMenu)}
              >
                <span className="user-avatar">
                  {user?.profile?.firstName ? user.profile.firstName[0] : user?.username[0]}
                </span>
                <span className="user-name">{user?.username}</span>
                <span className="user-role">{user?.role}</span>
              </button>
              
              {showUserMenu && (
                <div className="user-dropdown">
                  <div className="user-info">
                    <p className="user-email">{user?.email}</p>
                    <p className="user-role-badge">{user?.role}</p>
                  </div>
                  <div className="user-actions">
                    <Link to="/profile" onClick={() => setShowUserMenu(false)}>
                      Profile
                    </Link>
                    <button onClick={handleLogout}>
                      Logout
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <Link 
            to="/login" 
            className={isActive('/login') ? 'active' : ''}
            onClick={closeMobileMenu}
          >
            Login
          </Link>
        )}
      </div>
    </div>
  );
}
