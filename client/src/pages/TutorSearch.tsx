import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import { TutorCard } from "../components/TutorCard";
import { Pagination } from "../components/Pagination";
import { REGIONS, REGION_LABELS } from "@sgtutors/shared";
import type { PublicTutor, Subject, Level, Paginated } from "@sgtutors/shared";

export function TutorSearchPage() {
  const [params, setParams] = useSearchParams();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [levels, setLevels] = useState<Level[]>([]);
  const [result, setResult] = useState<Paginated<PublicTutor> | null>(null);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState(params.get("q") ?? "");

  const subject = params.get("subject") ?? "";
  const level = params.get("level") ?? "";
  const gender = params.get("gender") ?? "";
  const region = params.get("region") ?? "";
  const q = params.get("q") ?? "";
  const page = Math.max(1, Number(params.get("page")) || 1);

  useEffect(() => {
    void api.get<Subject[]>("/api/subjects").then(setSubjects).catch(() => {});
    void api.get<Level[]>("/api/levels").then(setLevels).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const query = new URLSearchParams();
    if (subject) query.set("subject", subject);
    if (level) query.set("level", level);
    if (gender) query.set("gender", gender);
    if (region) query.set("region", region);
    if (q) query.set("q", q);
    query.set("page", String(page));
    void api
      .get<Paginated<PublicTutor>>(`/api/tutors?${query}`)
      .then(setResult)
      .catch(() => setResult(null))
      .finally(() => setLoading(false));
  }, [subject, level, gender, region, q, page]);

  const update = (patch: Record<string, string>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    if (!("page" in patch)) next.delete("page");
    setParams(next);
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-3xl font-bold text-slate-900">Find a Tutor</h1>
      <p className="mt-1 text-slate-500">
        Featured and verified tutors appear first.
      </p>

      {/* Filters */}
      <form
        className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-6"
        onSubmit={(e) => {
          e.preventDefault();
          update({ q: keyword });
        }}
      >
        <select
          className="input"
          value={subject}
          onChange={(e) => update({ subject: e.target.value })}
        >
          <option value="">All Subjects</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.slug}>
              {s.name}
            </option>
          ))}
        </select>
        <select
          className="input"
          value={level}
          onChange={(e) => update({ level: e.target.value })}
        >
          <option value="">All Levels</option>
          {levels.map((l) => (
            <option key={l.id} value={l.slug}>
              {l.name}
            </option>
          ))}
        </select>
        <select
          className="input"
          value={gender}
          onChange={(e) => update({ gender: e.target.value })}
        >
          <option value="">Any Gender</option>
          <option value="female">Female</option>
          <option value="male">Male</option>
        </select>
        <select
          className="input"
          value={region}
          onChange={(e) => update({ region: e.target.value })}
        >
          <option value="">Any Location</option>
          {REGIONS.map((r) => (
            <option key={r} value={r}>
              {REGION_LABELS[r]}
            </option>
          ))}
        </select>
        <input
          className="input"
          placeholder="Keyword…"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
        />
        <button className="btn-primary">Search</button>
      </form>

      {/* Results */}
      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
        </div>
      ) : !result || result.items.length === 0 ? (
        <div className="py-16 text-center text-slate-500">
          No tutors match your search. Try broadening the filters.
        </div>
      ) : (
        <>
          <p className="mt-6 text-sm text-slate-500">{result.total} tutor(s) found</p>
          <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {result.items.map((t) => (
              <TutorCard key={t.id} tutor={t} />
            ))}
          </div>
          <Pagination
            page={result.page}
            pageSize={result.pageSize}
            total={result.total}
            onPage={(p) => update({ page: String(p) })}
          />
        </>
      )}
    </div>
  );
}
