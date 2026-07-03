export function VerifiedBadge({ small = false }: { small?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-emerald-50 font-semibold text-emerald-700 ring-1 ring-emerald-200 ${small ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs"}`}
      title="Identity, qualifications and subject knowledge verified"
    >
      <svg viewBox="0 0 20 20" fill="currentColor" className={small ? "h-3 w-3" : "h-3.5 w-3.5"}>
        <path
          fillRule="evenodd"
          d="M16.403 12.652a3 3 0 0 0 0-5.304 3 3 0 0 0-3.75-3.751 3 3 0 0 0-5.305 0 3 3 0 0 0-3.751 3.75 3 3 0 0 0 0 5.305 3 3 0 0 0 3.75 3.751 3 3 0 0 0 5.305 0 3 3 0 0 0 3.751-3.75Zm-2.546-4.46a.75.75 0 0 0-1.214-.883l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z"
          clipRule="evenodd"
        />
      </svg>
      Verified
    </span>
  );
}

export function UnverifiedBadge({ small = false }: { small?: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-full bg-slate-100 font-medium text-slate-500 ring-1 ring-slate-200 ${small ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs"}`}
    >
      Unverified
    </span>
  );
}

export function FeaturedBadge({ small = false }: { small?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-amber-50 font-semibold text-amber-700 ring-1 ring-amber-200 ${small ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs"}`}
    >
      <svg viewBox="0 0 20 20" fill="currentColor" className={small ? "h-3 w-3" : "h-3.5 w-3.5"}>
        <path
          fillRule="evenodd"
          d="M10.868 2.884c-.321-.772-1.415-.772-1.736 0l-1.83 4.401-4.753.381c-.833.067-1.171 1.107-.536 1.651l3.62 3.102-1.106 4.637c-.194.813.691 1.456 1.405 1.02L10 15.591l4.069 2.485c.713.436 1.598-.207 1.404-1.02l-1.106-4.637 3.62-3.102c.635-.544.297-1.584-.536-1.65l-4.752-.382-1.831-4.401Z"
          clipRule="evenodd"
        />
      </svg>
      Featured
    </span>
  );
}
