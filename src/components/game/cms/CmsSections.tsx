import { Loader2 } from "lucide-react";
import {
  usePublishedStoreItems,
  usePublishedStoryNodes,
  usePublishedTrainingStats,
} from "@/hooks/useCms";

/**
 * Player-facing CMS sections. Each one renders ONLY rows with
 * is_published = true (enforced both by the query filter and by RLS), and
 * renders nothing at all when the admin has not published anything yet — so
 * existing hardcoded gameplay UI stays untouched.
 */

function Spinner() {
  return (
    <p className="flex items-center gap-2 py-2 text-[11px] text-slate-500">
      <Loader2 className="h-3.5 w-3.5 animate-spin" /> 불러오는 중…
    </p>
  );
}

export function CmsStoreItems() {
  const { data, isLoading } = usePublishedStoreItems();
  if (isLoading) return <Spinner />;
  if (!data || data.length === 0) return null;

  return (
    <section className="space-y-2">
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Featured</p>
      {data.map((item) => (
        <div
          key={item.id}
          className="flex items-center gap-3 rounded-2xl border border-slate-700/60 bg-slate-900/60 p-3"
        >
          {item.image_url ? (
            <img
              src={item.image_url}
              alt={item.name}
              loading="lazy"
              className="h-12 w-12 rounded-xl border border-slate-700 object-cover"
            />
          ) : (
            <div className="h-12 w-12 rounded-xl border border-dashed border-slate-700" />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-slate-100">{item.name}</p>
            <p className="text-[11px] text-slate-400">
              {item.gold_reward > 0 ? `${item.gold_reward.toLocaleString()} G` : item.item_type}
            </p>
          </div>
          <span className="shrink-0 rounded-xl bg-amber-500/15 px-3 py-2 text-xs font-bold text-amber-300">
            ${Number(item.price_usd).toFixed(2)}
          </span>
        </div>
      ))}
    </section>
  );
}

export function CmsTrainingStats() {
  const { data, isLoading } = usePublishedTrainingStats();
  if (isLoading) return <Spinner />;
  if (!data || data.length === 0) return null;

  return (
    <section className="space-y-2">
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
        훈련 능력
      </p>
      <div className="grid grid-cols-2 gap-2">
        {data.map((s) => (
          <div
            key={s.id}
            className="flex items-center gap-2 rounded-xl border border-slate-700/60 bg-slate-900/60 p-2.5"
          >
            {s.icon_url ? (
              <img
                src={s.icon_url}
                alt={s.stat_name}
                loading="lazy"
                className="h-8 w-8 rounded-lg object-cover"
              />
            ) : (
              <div className="h-8 w-8 rounded-lg border border-dashed border-slate-700" />
            )}
            <div className="min-w-0">
              <p className="truncate text-xs font-bold text-slate-100">{s.stat_name}</p>
              <p className="text-[10px] text-slate-400">
                +{s.stat_increase} · {s.base_cost.toLocaleString()} G
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function CmsStoryNodes() {
  const { data, isLoading } = usePublishedStoryNodes();
  if (isLoading) return <Spinner />;
  if (!data || data.length === 0) return null;

  return (
    <section className="space-y-2">
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">스토리 맵</p>
      <div className="flex gap-2 overflow-x-auto pb-2">
        {data.map((n) => (
          <div
            key={n.id}
            className="relative h-24 w-40 shrink-0 overflow-hidden rounded-xl border border-slate-700/60 bg-slate-900"
          >
            {n.background_image_url && (
              <img
                src={n.background_image_url}
                alt={n.title}
                loading="lazy"
                className="absolute inset-0 h-full w-full object-cover opacity-60"
              />
            )}
            <div className="relative flex h-full flex-col justify-end p-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-amber-300">
                Stage {n.stage_number}
              </p>
              <p className="truncate text-xs font-bold text-slate-100">{n.title}</p>
              <p className="truncate text-[10px] text-slate-300">{n.node_type}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}