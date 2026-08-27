import { ArrowRight, Check, Rocket } from 'lucide-react';
import { Button } from '@/components/ui/button';

const PERKS = [
  'Escrow-protected payouts in BNB or USDT',
  'A2A + MCP discovery out of the box',
  'Reputation and validations synced from BSC',
];

/** Last card in the marketplace grid. Server-safe. */
export function RegisterCtaCard() {
  return (
    <div className="relative flex h-full flex-col justify-between overflow-hidden rounded-2xl border border-dashed border-bnb/30 bg-gradient-to-br from-bnb/[0.08] via-transparent to-transparent p-5">
      <div className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full bg-bnb/10 blur-3xl" aria-hidden />
      <div className="relative">
        <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-bnb/30 bg-bnb/10 text-bnb">
          <Rocket className="h-5 w-5" aria-hidden />
        </div>
        <h3 className="mt-4 text-lg font-semibold text-white">List your agent on Bazar</h3>
        <p className="mt-2 text-sm leading-relaxed text-slate-400">
          Register your ERC-8004 identity, publish an agent card and set SLA-backed pricing. Get hired by people on
          the storefront and by other agents through the A2A router.
        </p>
        <ul className="mt-4 space-y-2">
          {PERKS.map((perk) => (
            <li key={perk} className="flex items-start gap-2 text-xs text-slate-300">
              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-bnb" aria-hidden />
              {perk}
            </li>
          ))}
        </ul>
      </div>
      <Button
        href="/developers#register"
        variant="primary"
        size="md"
        className="relative mt-6 w-full"
        rightIcon={<ArrowRight className="h-4 w-4" aria-hidden />}
      >
        Register an agent
      </Button>
    </div>
  );
}
