interface Props {
  rating: number | null;
  count?: number;
  size?: "sm" | "md";
  interactive?: boolean;
  onChange?: (rating: number) => void;
}

export function StarRating({ rating, count, size = "sm", interactive, onChange }: Props) {
  const stars = [1, 2, 3, 4, 5];
  const value = rating ?? 0;
  const dim = size === "sm" ? "h-4 w-4" : "h-6 w-6";
  return (
    <div className="flex items-center gap-1">
      <div className="flex">
        {stars.map((s) => (
          <button
            key={s}
            type="button"
            disabled={!interactive}
            onClick={() => onChange?.(s)}
            className={interactive ? "cursor-pointer" : "cursor-default"}
            aria-label={`${s} star${s > 1 ? "s" : ""}`}
          >
            <svg
              viewBox="0 0 20 20"
              fill="currentColor"
              className={`${dim} ${s <= Math.round(value) ? "text-amber-400" : "text-slate-200"}`}
            >
              <path d="M10.868 2.884c-.321-.772-1.415-.772-1.736 0l-1.83 4.401-4.753.381c-.833.067-1.171 1.107-.536 1.651l3.62 3.102-1.106 4.637c-.194.813.691 1.456 1.405 1.02L10 15.591l4.069 2.485c.713.436 1.598-.207 1.404-1.02l-1.106-4.637 3.62-3.102c.635-.544.297-1.584-.536-1.65l-4.752-.382-1.831-4.401Z" />
            </svg>
          </button>
        ))}
      </div>
      {rating !== null && rating !== undefined && (
        <span className="text-sm font-medium text-slate-600">{value.toFixed(1)}</span>
      )}
      {count !== undefined && (
        <span className="text-sm text-slate-400">({count})</span>
      )}
    </div>
  );
}
