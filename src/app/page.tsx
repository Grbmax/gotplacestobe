import Link from "next/link";

const steps = [
  {
    n: "01",
    title: "Drop a name — location locks in",
    copy: "No login for the demo. Live GPS places you anywhere; nearby spots spawn around you.",
  },
  {
    n: "02",
    title: "See favors near you",
    copy: "The live map drops pins on synthetic places around your real location — café, library, park, gym.",
  },
  {
    n: "03",
    title: "Swipe a crowd-posted task",
    copy: "Karma sits on the card. Skip it, or open it, or take it. Matching tells you why it showed up first.",
  },
  {
    n: "04",
    title: "Do the walk. Karma moves.",
    copy: "Only the requester confirms. That’s the whole anti-gaming rule.",
  },
];

export default function LandingPage() {
  return (
    <div className="bg-paper text-ink">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <p className="text-sm font-semibold tracking-[0.28em] uppercase">Quest</p>
        <Link
          href="/join"
          className="rounded-full bg-ink px-4 py-2 text-sm text-leaf"
        >
          Open the demo
        </Link>
      </header>

      <section className="mx-auto grid max-w-6xl items-center gap-12 px-6 pb-20 pt-6 lg:grid-cols-[1.15fr_0.85fr]">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-ink/50">
            near you · right now · not later
          </p>
          <h1 className="serif mt-4 max-w-[14ch] text-5xl leading-[0.95] sm:text-7xl">
            Get small things done for each other, right now.
          </h1>
          <p className="mt-6 max-w-md text-lg leading-relaxed text-ink/70">
            Small enough you wouldn’t pay someone. Annoying enough you wish
            someone nearby would just do it. Help now, spend later.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/join"
              className="rounded-full bg-leaf px-6 py-3 text-sm font-semibold text-ink"
            >
              Join nearby
            </Link>
            <Link
              href="/inspect"
              className="rounded-full border border-ink/20 px-6 py-3 text-sm"
            >
              Inspect a stay
            </Link>
          </div>
          <dl className="mt-12 grid max-w-lg grid-cols-3 gap-4 border-t border-ink/10 pt-6 text-sm">
            <div>
              <dt className="text-ink/45">Overnight joins</dt>
              <dd className="serif text-3xl">47</dd>
            </div>
            <div>
              <dt className="text-ink/45">Favours done</dt>
              <dd className="serif text-3xl">31</dd>
            </div>
            <div>
              <dt className="text-ink/45">Post → take</dt>
              <dd className="serif text-3xl">4m</dd>
            </div>
          </dl>
        </div>

        <div className="relative mx-auto w-full max-w-[340px]">
          <div className="absolute -left-10 top-16 hidden rotate-[-8deg] rounded-2xl bg-ink px-4 py-3 text-xs text-leaf sm:block">
            2 pings · near you
          </div>
          <div className="absolute -right-8 bottom-28 hidden rotate-[6deg] rounded-2xl bg-gold px-4 py-3 text-xs text-ink sm:block">
            +30 karma
          </div>
          <PhonePreview />
        </div>
      </section>

      <section id="flow" className="bg-ink text-paper">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <p className="text-xs uppercase tracking-[0.28em] text-leaf">The product is one screen</p>
          <h2 className="serif mt-3 max-w-[18ch] text-4xl sm:text-5xl">
            Map, nearby list, and a Tinder blade for the next task.
          </h2>
          <div className="mt-12 grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            {steps.map((s) => (
              <article key={s.n} className="border-t border-paper/15 pt-5">
                <p className="font-mono text-xs text-leaf">{s.n}</p>
                <h3 className="mt-3 text-lg font-medium">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-paper/65">{s.copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="grid gap-10 lg:grid-cols-2">
          <div>
            <h2 className="serif text-4xl">Why this isn’t a favour list.</h2>
            <ul className="mt-8 space-y-5 text-ink/75">
              <li>
                <strong className="text-ink">You don’t text the helper.</strong> They’re
                someone you wouldn’t have thought to ping. Friend graph becomes a community graph.
              </li>
              <li>
                <strong className="text-ink">Karma, not cash.</strong> Nobody Venmos two
                dollars for a walk upstairs. Asking is free. You start with 100.
              </li>
              <li>
                <strong className="text-ink">Matching is visible.</strong> Two people never
                see the same order. Each card has a why line: proximity, urgency, reward, reliability.
              </li>
              <li>
                <strong className="text-ink">It can’t work single-player.</strong> Requests
                only exist because someone else can take them.
              </li>
            </ul>
          </div>
          <div className="rounded-[2rem] bg-moss p-8 text-paper">
            <p className="text-xs uppercase tracking-[0.22em] text-leaf">Judge join in 10s</p>
            <p className="serif mt-4 text-3xl">Scan, name, zone. Live map.</p>
            <p className="mt-4 text-sm leading-relaxed text-paper/70">
              Mobile web on purpose. Indoor GPS is a lie, so the map is named floors with a
              minutes matrix. Your pin is live in the zone you picked. Crowd tasks ping on
              the buildings that actually need them.
            </p>
            <Link
              href="/join"
              className="mt-8 inline-flex rounded-full bg-leaf px-5 py-3 text-sm font-semibold text-ink"
            >
              Try the map
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

function PhonePreview() {
  return (
    <div className="float-card overflow-hidden rounded-[2.4rem] border-8 border-ink bg-moss shadow-2xl">
      <div className="flex items-center justify-between px-4 pt-3 text-[10px] uppercase tracking-[0.2em] text-paper/50">
        <span>Quest</span>
        <span className="text-live">live GPS</span>
        <span className="text-gold">100 k</span>
      </div>
      <div className="relative mx-3 mt-3 h-56 overflow-hidden rounded-2xl map-grid">
        <div className="absolute left-[18%] top-[42%] h-3 w-3 rounded-full bg-gold">
          <span className="absolute inset-0 rounded-full bg-gold ping-ring" />
        </div>
        <div className="absolute left-[46%] top-[28%] h-3 w-3 rounded-full bg-urgent">
          <span className="absolute inset-0 rounded-full bg-urgent ping-ring" />
        </div>
        <div className="absolute left-[78%] top-[46%] h-4 w-4 rounded-full border-2 border-ink bg-live" />
        <div className="absolute bottom-2 left-2 right-2 flex gap-1 overflow-hidden">
          {["Library · charger", "Café · hold table", "Park · dog walk"].map((label) => (
            <span
              key={label}
              className="shrink-0 rounded-full bg-ink/70 px-2 py-1 text-[9px] text-paper"
            >
              {label}
            </span>
          ))}
        </div>
      </div>
      <div className="m-3 rounded-2xl bg-paper p-3 text-ink">
        <p className="text-[9px] uppercase tracking-[0.18em] text-ink/45">Library · 5 min · urgent</p>
        <p className="serif mt-1 text-lg leading-tight">Grab my charger from the library desk</p>
        <p className="mt-2 inline-block rounded-full bg-ink px-2 py-0.5 text-[11px] text-gold">+30 karma</p>
        <div className="mt-3 flex gap-2">
          <span className="flex-1 rounded-full border border-ink/15 py-2 text-center text-[11px]">Skip</span>
          <span className="flex-1 rounded-full bg-ink py-2 text-center text-[11px] text-leaf">Take</span>
        </div>
      </div>
    </div>
  );
}
