import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { api } from "../api/client";
import type { Subject } from "@sgtutors/shared";

export function Navbar() {
  const [open, setOpen] = useState(false);
  const [subjectsOpen, setSubjectsOpen] = useState(false);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const { tutorLoggedIn } = useAuth();
  const navigate = useNavigate();
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void api.get<Subject[]>("/api/subjects").then(setSubjects).catch(() => {});
  }, []);

  // Close the subjects dropdown on outside click
  useEffect(() => {
    if (!subjectsOpen) return;
    const onClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setSubjectsOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [subjectsOpen]);

  const categories = [...new Set(subjects.map((s) => s.category))];

  const linkCls = ({ isActive }: { isActive: boolean }) =>
    `block rounded-lg px-3 py-2 text-sm font-medium ${isActive ? "text-brand-700 bg-brand-50" : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"}`;

  const goSubject = (slug: string) => {
    setSubjectsOpen(false);
    setOpen(false);
    navigate(`/tutors?subject=${slug}`);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link to="/" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-lg font-bold text-white">
            S
          </span>
          <span className="text-lg font-bold text-slate-900">
            SG<span className="text-brand-600">Tutors</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          <NavLink to="/tutors" className={linkCls}>
            Find a Tutor
          </NavLink>

          {/* Browse by Subject dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              className={`flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium ${subjectsOpen ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"}`}
              onClick={() => setSubjectsOpen((v) => !v)}
            >
              Browse by Subject
              <svg
                className={`h-4 w-4 transition-transform ${subjectsOpen ? "rotate-180" : ""}`}
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {subjectsOpen && (
              <div className="absolute left-1/2 top-full z-50 mt-2 w-[820px] max-w-[95vw] -translate-x-1/2 rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
                <div className="grid grid-cols-3 gap-x-8 gap-y-4">
                  {categories.map((cat) => (
                    <div key={cat}>
                      <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                        {cat}
                      </div>
                      <ul className="space-y-0.5">
                        {subjects
                          .filter((s) => s.category === cat)
                          .map((s) => (
                            <li key={s.id}>
                              <button
                                type="button"
                                className="w-full whitespace-nowrap rounded px-1.5 py-1 text-left text-sm text-slate-600 hover:bg-brand-50 hover:text-brand-700"
                                onClick={() => goSubject(s.slug)}
                              >
                                {s.name}
                              </button>
                            </li>
                          ))}
                      </ul>
                    </div>
                  ))}
                </div>
                <div className="mt-4 border-t border-slate-100 pt-3 text-right">
                  <Link
                    to="/tutors"
                    className="text-sm font-semibold text-brand-600 hover:underline"
                    onClick={() => setSubjectsOpen(false)}
                  >
                    View all tutors →
                  </Link>
                </div>
              </div>
            )}
          </div>

          <NavLink to="/#how-verification-works" className={linkCls}>
            How Verification Works
          </NavLink>
          {tutorLoggedIn ? (
            <NavLink to="/dashboard" className={linkCls}>
              My Dashboard
            </NavLink>
          ) : (
            <>
              <NavLink to="/login" className={linkCls}>
                Tutor Login
              </NavLink>
              <Link to="/signup" className="btn-primary ml-2">
                List Yourself Free
              </Link>
            </>
          )}
        </nav>

        <button
          className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 md:hidden"
          onClick={() => setOpen(!open)}
          aria-label="Toggle menu"
        >
          <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            {open ? (
              <path strokeLinecap="round" d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      {open && (
        <nav className="space-y-1 border-t border-slate-100 px-4 py-3 md:hidden">
          <NavLink to="/tutors" className={linkCls} onClick={() => setOpen(false)}>
            Find a Tutor
          </NavLink>

          {/* Mobile: collapsible subject list */}
          <button
            type="button"
            className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            onClick={() => setSubjectsOpen((v) => !v)}
          >
            Browse by Subject
            <svg
              className={`h-4 w-4 transition-transform ${subjectsOpen ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {subjectsOpen && (
            <div className="max-h-64 overflow-y-auto rounded-lg bg-slate-50 px-3 py-2">
              {categories.map((cat) => (
                <div key={cat} className="py-1">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    {cat}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1.5 pb-1">
                    {subjects
                      .filter((s) => s.category === cat)
                      .map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600"
                          onClick={() => goSubject(s.slug)}
                        >
                          {s.name}
                        </button>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          <NavLink to="/#how-verification-works" className={linkCls} onClick={() => setOpen(false)}>
            How Verification Works
          </NavLink>
          {tutorLoggedIn ? (
            <NavLink to="/dashboard" className={linkCls} onClick={() => setOpen(false)}>
              My Dashboard
            </NavLink>
          ) : (
            <>
              <NavLink to="/login" className={linkCls} onClick={() => setOpen(false)}>
                Tutor Login
              </NavLink>
              <NavLink to="/signup" className={linkCls} onClick={() => setOpen(false)}>
                List Yourself Free
              </NavLink>
            </>
          )}
        </nav>
      )}
    </header>
  );
}
