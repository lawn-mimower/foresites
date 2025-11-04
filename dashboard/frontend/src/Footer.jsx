import React from "react";
import { Logo } from "./components/Logo";
import "./css/footer.css";

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="footer">
      <div className="footer-content">
        <div className="footer-section">
          <div className="footer-brand">
            <Logo size="medium" showText={true} className="footer-logo" />
            <p>Professional construction management and feedback tracking solutions.</p>
          </div>
        </div>

        <div className="footer-section">
          <h4>Quick Links</h4>
          <ul className="footer-links">
            <li><a href="/">Dashboard</a></li>
            <li><a href="/allfeedbacks">All Feedbacks</a></li>
            <li><a href="/meetingzone">Meeting Zone</a></li>
            <li><a href="/showsites">Sites</a></li>
          </ul>
        </div>

        <div className="footer-section">
          <h4>Management</h4>
          <ul className="footer-links">
            <li><a href="/add-form">Access Points</a></li>
            <li><a href="/login">Login</a></li>
            <li><a href="/logout">Logout</a></li>
          </ul>
        </div>

        <div className="footer-section">
          <h4>Contact</h4>
          <div className="contact-info">
            <p>Email: omnifeed.manager@gmail.com</p>
            <p>Website : </p>
            <p>Location: Pune Maharashtran</p>
          </div>
        </div>
      </div>

      <div className="footer-bottom">
        <div className="footer-bottom-content">
          <p>&copy; {currentYear}Foresites: a product of OMNIFEED for managing construction sites</p>
          <div className="footer-social">
            <span>Powered by OMNIFEED</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
