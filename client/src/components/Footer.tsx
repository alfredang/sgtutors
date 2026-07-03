import { Link } from "react-router-dom";

export function Footer() {
  return (
    <footer className="mt-16 border-t border-slate-200 bg-slate-50">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-lg font-bold text-white">
              S
            </span>
            <span className="text-lg font-bold text-slate-900">
              SG<span className="text-brand-600">Tutors</span>
            </span>
          </div>
          <p className="mt-3 text-sm text-slate-500">
            Singapore's trusted tutor marketplace. Every verified tutor has passed
            identity checks, qualification review and a subject-knowledge interview.
          </p>
        </div>
        <div>
          <h4 className="text-sm font-semibold text-slate-900">For Students & Parents</h4>
          <ul className="mt-3 space-y-2 text-sm text-slate-600">
            <li><Link to="/tutors" className="hover:text-brand-600">Find a Tutor</Link></li>
            <li><Link to="/#subjects" className="hover:text-brand-600">Browse by Subject</Link></li>
            <li><Link to="/#levels" className="hover:text-brand-600">Browse by Level</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="text-sm font-semibold text-slate-900">For Tutors</h4>
          <ul className="mt-3 space-y-2 text-sm text-slate-600">
            <li><Link to="/signup" className="hover:text-brand-600">List Yourself Free</Link></li>
            <li><Link to="/login" className="hover:text-brand-600">Tutor Login</Link></li>
            <li><Link to="/#how-verification-works" className="hover:text-brand-600">Get Verified</Link></li>
            <li><Link to="/dashboard" className="hover:text-brand-600">Become Featured</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="text-sm font-semibold text-slate-900">Contact</h4>
          <ul className="mt-3 space-y-2 text-sm text-slate-600">
            <li>admin@sgtutors.local</li>
            <li>Singapore</li>
            <li><Link to="/privacy" className="hover:text-brand-600">Privacy Policy</Link></li>
          </ul>
        </div>
      </div>
      <div className="space-y-1 border-t border-slate-200 py-4 text-center text-xs text-slate-400">
        <p>
          © {new Date().getFullYear()} SG Tutors. All rights reserved. Tutor personal
          data (NRIC, contact details) is never displayed publicly.
        </p>
        <p className="powered-by">
          Powered by{" "}
          <a
            href="https://www.tertiaryinfotech.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-slate-500 hover:text-brand-600"
          >
            Tertiary Infotech Academy Pte Ltd
          </a>
        </p>
      </div>
    </footer>
  );
}
