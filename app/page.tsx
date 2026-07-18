import { eventsCollection, prospectsCollection } from "@/lib/firebaseAdmin";

export const dynamic = "force-dynamic";

type EventItem = {
  id: string;
  text: string;
  authorHandle: string;
  timestampLabel: string;
};

type ProspectItem = {
  id: string;
  name: string;
  source: string;
  status: string;
  createdAtLabel: string;
};

function formatDate(value: unknown): string {
  if (!value || typeof value !== "object" || !("toDate" in (value as Record<string, unknown>))) {
    return "Pending timestamp";
  }

  try {
    const date = (value as { toDate: () => Date }).toDate();
    return new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  } catch {
    return "Pending timestamp";
  }
}

async function getEvents(): Promise<EventItem[]> {
  const snapshot = await eventsCollection.orderBy("timestamp", "desc").limit(50).get();

  return snapshot.docs.map((doc) => {
    const data = doc.data() as Record<string, unknown>;

    return {
      id: doc.id,
      text: typeof data.text === "string" ? data.text : "Untitled event",
      authorHandle: typeof data.authorHandle === "string" ? data.authorHandle : "unknown",
      timestampLabel: formatDate(data.timestamp),
    };
  });
}

async function getProspects(): Promise<ProspectItem[]> {
  const snapshot = await prospectsCollection.orderBy("createdAt", "desc").limit(10).get();

  return snapshot.docs.map((doc) => {
    const data = doc.data() as Record<string, unknown>;

    return {
      id: doc.id,
      name: typeof data.name === "string" ? data.name : "Unnamed prospect",
      source: typeof data.source === "string" ? data.source : "manual",
      status: typeof data.status === "string" ? data.status : "new",
      createdAtLabel: formatDate(data.createdAt),
    };
  });
}

export default async function HomePage() {
  const [events, prospects] = await Promise.all([getEvents(), getProspects()]);

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <header className="mx-auto max-w-5xl border-b border-slate-300 px-6 py-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Slingwire</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Slingwire Promise Network</h1>
          </div>
          <p className="max-w-xl text-sm leading-relaxed text-slate-600">
            A decentralized, ad-free town square for real-world events, built to connect people without
            surveillance and without algorithmic manipulation.
          </p>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-6 py-10" aria-labelledby="event-feed-heading">
        <h2 id="event-feed-heading" className="text-xl font-semibold">
          Public Event Feed
        </h2>
        <ol className="mt-6 space-y-4">
          {events.length === 0 ? (
            <li className="rounded-lg border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-500">
              No events published yet. The worker will populate this feed when matching posts arrive.
            </li>
          ) : (
            events.map((event) => (
              <li key={event.id} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <article>
                  <p className="text-base leading-relaxed text-slate-800">{event.text}</p>
                  <footer className="mt-3 text-sm text-slate-500">
                    <span className="font-medium text-slate-700">@{event.authorHandle}</span>
                    <span className="mx-2">•</span>
                    <time>{event.timestampLabel}</time>
                  </footer>
                </article>
              </li>
            ))
          )}
        </ol>
      </section>

      <section
        className="mx-auto mb-12 max-w-5xl rounded-xl border border-amber-300 bg-amber-50 px-6 py-8"
        aria-labelledby="developer-dashboard-heading"
      >
        <h2 id="developer-dashboard-heading" className="text-lg font-semibold text-amber-900">
          Developer Dashboard (Testing)
        </h2>
        <p className="mt-2 text-sm text-amber-800">
          Temporary visibility into prospect intake while backend ingestion and workflows are being validated.
        </p>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-amber-200">
                <th className="px-3 py-2 font-semibold text-amber-900">Name</th>
                <th className="px-3 py-2 font-semibold text-amber-900">Source</th>
                <th className="px-3 py-2 font-semibold text-amber-900">Status</th>
                <th className="px-3 py-2 font-semibold text-amber-900">Created</th>
              </tr>
            </thead>
            <tbody>
              {prospects.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-4 text-amber-700">
                    No prospects yet.
                  </td>
                </tr>
              ) : (
                prospects.map((prospect) => (
                  <tr key={prospect.id} className="border-b border-amber-100 last:border-none">
                    <td className="px-3 py-3 text-slate-800">{prospect.name}</td>
                    <td className="px-3 py-3 text-slate-700">{prospect.source}</td>
                    <td className="px-3 py-3 text-slate-700">{prospect.status}</td>
                    <td className="px-3 py-3 text-slate-700">{prospect.createdAtLabel}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
