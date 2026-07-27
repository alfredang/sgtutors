import { Link } from "react-router-dom";

/** Apple "Download on the App Store" badge, inlined so it needs no external asset. */
function AppStoreBadge() {
  return (
    <svg
      width="135"
      height="45"
      viewBox="0 0 135 45"
      role="img"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="0.5" y="0.5" width="134" height="44" rx="7.5" fill="#000" />
      <rect x="0.5" y="0.5" width="134" height="44" rx="7.5" fill="none" stroke="#A6A6A6" />
      <g fill="#fff">
        <path d="M28.05 22.84c-.03-3.17 2.6-4.71 2.72-4.78-1.49-2.17-3.79-2.47-4.61-2.5-1.94-.2-3.82 1.16-4.81 1.16-1.01 0-2.53-1.14-4.17-1.11-2.11.03-4.09 1.25-5.17 3.15-2.24 3.87-.57 9.56 1.57 12.69 1.07 1.53 2.32 3.25 3.96 3.19 1.6-.07 2.2-1.02 4.13-1.02 1.91 0 2.47 1.02 4.14.98 1.72-.03 2.8-1.55 3.83-3.09 1.23-1.76 1.73-3.49 1.75-3.58-.04-.01-3.33-1.27-3.36-5.06zM24.9 13.5c.87-1.09 1.47-2.57 1.3-4.07-1.26.06-2.83.87-3.74 1.94-.81.94-1.53 2.48-1.34 3.92 1.42.11 2.87-.71 3.78-1.79z" />
        <text
          x="45"
          y="17.5"
          fontFamily="-apple-system, BlinkMacSystemFont, 'Helvetica Neue', Helvetica, Arial, sans-serif"
          fontSize="9"
        >
          Download on the
        </text>
        <text
          x="45"
          y="34"
          fontFamily="-apple-system, BlinkMacSystemFont, 'Helvetica Neue', Helvetica, Arial, sans-serif"
          fontSize="19"
          fontWeight="500"
        >
          App Store
        </text>
      </g>
    </svg>
  );
}

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
          <a
            href="https://apps.apple.com/sg/app/tertiary-sgtutors/id6787160558"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Download Tertiary SGTutors on the App Store"
            className="mt-4 inline-block transition-opacity hover:opacity-80"
          >
            <AppStoreBadge />
          </a>
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
