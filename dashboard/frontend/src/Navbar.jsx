import { Link, useLocation } from "react-router-dom";
import { useState, useRef, useEffect } from "react";
import { useAuth } from './AuthContext';
import './css/navbar.css';

export function Navbar() {
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showAdminDropdown, setShowAdminDropdown] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const { user, isAuthenticated, logout, isAdmin } = useAuth();
  const adminRef = useRef(null);
  const userRef = useRef(null);

  const closeMobileMenu = () => setIsMobileMenuOpen(false);
  const isActive = (path) => location.pathname === path;

  const handleLogout = async () => {
    await logout();
    setShowUserMenu(false);
    closeMobileMenu();
  };

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e) => {
      if (adminRef.current && !adminRef.current.contains(e.target)) setShowAdminDropdown(false);
      if (userRef.current && !userRef.current.contains(e.target)) setShowUserMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const mainLinks = [
    { to: '/', label: 'Dashboard' },
    { to: '/meetingzone', label: 'Job Zone' },
    { to: '/allfeedbacks', label: 'All Snags' },
    { to: '/showsites', label: 'Sites' },
    { to: '/todos', label: 'My Tasks' },
    { to: '/chat', label: 'AI Chat' },
  ];

  const adminLinks = [
    { to: '/admin', label: 'Admin Panel' },
    { to: '/assign-snags', label: 'Assign Snags' },
    { to: '/manage-employee', label: 'Manage Employee' },
    { to: '/add-form', label: 'Access Points' },
  ];

  return (
    <nav className="fs-topbar">
      <div className="fs-topbar-inner">
        {/* Brand */}
        <Link to="/" className="fs-topbar-brand" onClick={closeMobileMenu}>
          <span className="fs-brand-text">FORESITES</span>
          <span className="fs-brand-live"></span>
        </Link>

        {/* Hamburger */}
        <button
          className="fs-hamburger"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          aria-label="Toggle menu"
        >
          <span className={`fs-hamburger-icon ${isMobileMenuOpen ? 'open' : ''}`}>
            <span></span><span></span><span></span>
          </span>
        </button>

        {/* Nav links */}
        <div className={`fs-topbar-nav ${isMobileMenuOpen ? 'open' : ''}`}>
          {isAuthenticated() && (
            <>
              {mainLinks.map(link => (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`fs-nav-link ${isActive(link.to) ? 'active' : ''}`}
                  onClick={closeMobileMenu}
                >
                  {link.label}
                </Link>
              ))}

              {/* Admin dropdown */}
              {isAdmin() && (
                <div className="fs-admin-dropdown" ref={adminRef}>
                  <button
                    className={`fs-nav-link fs-admin-trigger ${adminLinks.some(l => isActive(l.to)) ? 'active' : ''}`}
                    onClick={() => setShowAdminDropdown(!showAdminDropdown)}
                  >
                    Admin &#9662;
                  </button>
                  {showAdminDropdown && (
                    <div className="fs-dropdown-menu">
                      {adminLinks.map(link => (
                        <Link
                          key={link.to}
                          to={link.to}
                          className={`fs-dropdown-item ${isActive(link.to) ? 'active' : ''}`}
                          onClick={() => { setShowAdminDropdown(false); closeMobileMenu(); }}
                        >
                          {link.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* User menu / Login */}
          {isAuthenticated() ? (
            <div className="fs-user-section" ref={userRef}>
              <button className="fs-user-trigger" onClick={() => setShowUserMenu(!showUserMenu)}>
                <span className="fs-user-avatar">
                  {user?.profile?.firstName ? user.profile.firstName[0] : user?.username?.[0] || 'U'}
                </span>
                <span className="fs-user-name">{user?.username}</span>
                <span className="fs-user-role-tag">{user?.role}</span>
              </button>
              {showUserMenu && (
                <div className="fs-user-dropdown">
                  <div className="fs-user-dropdown-info">
                    <div className="fs-user-dropdown-email">{user?.email}</div>
                    <div className="fs-user-dropdown-role">{user?.role}</div>
                  </div>
                  <div className="fs-user-dropdown-actions">
                    <button onClick={handleLogout} className="fs-user-dropdown-btn">Logout</button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <Link to="/login" className="fs-nav-link" onClick={closeMobileMenu}>Login</Link>
          )}
        </div>
      </div>
    </nav>
  );
}
