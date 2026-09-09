/**
 * Brand marks for the social row.
 *
 * These are inline SVGs rather than icons from the app's Heroicons set:
 * Heroicons carries no brand marks at all. A brand logo has to be the real
 * thing, so X, Telegram and GitHub live here as paths.
 */

import { cn } from '@/lib/utils';

type IconProps = { className?: string };

export function XIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden focusable="false">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z" />
    </svg>
  );
}

export function TelegramIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden focusable="false">
      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0Zm5.562 8.161c-.18 1.897-.962 6.502-1.359 8.627-.168.9-.5 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212-.07-.062-.174-.041-.249-.024-.106.024-1.793 1.139-5.062 3.345-.479.329-.913.489-1.302.481-.428-.009-1.252-.242-1.865-.442-.751-.244-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.015 3.333-1.386 4.025-1.627 4.477-1.635.099-.002.321.023.465.14.121.098.155.23.171.324.016.094.036.308.02.475Z" />
    </svg>
  );
}

/** Bazar's own mark for the public index every listing is read from. */
export function IndexIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden focusable="false">
      <ellipse cx="12" cy="6" rx="8" ry="3.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 6v6c0 1.77 3.58 3.2 8 3.2s8-1.43 8-3.2V6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 12v6c0 1.77 3.58 3.2 8 3.2s8-1.43 8-3.2v-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function GithubIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden focusable="false">
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23a11.5 11.5 0 0 1 3-.405c1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12Z" />
    </svg>
  );
}

interface SocialLink {
  label: string;
  href: string;
  Icon: (props: IconProps) => JSX.Element;
}

/**
 * Only accounts Bazar actually owns, and only after checking each one resolves.
 *
 * Checked 2026-08-28, when this list was empty: https://x.com/BazarHQ did not
 * resolve, and https://t.me/Bazar did - which was the trap. That handle is an
 * unrelated Persian-language news channel with 181 subscribers, so a row
 * labelled "Bazar on Telegram" sent every visitor to a stranger. On a project
 * judged partly on provenance, a confident link to someone else's channel is
 * worse than no link at all.
 *
 * Checked 2026-09-09: https://x.com/BazarHQ returns 200 - the handle that did
 * not resolve in August now exists and is Bazar's, so the August finding is
 * stale rather than wrong. The GitHub row points at the repository this file is in; it
 * answers 404 while the repository is private and resolves the moment it is
 * public, which is a state of the repository rather than a wrong address.
 *
 * `IndexIcon` stays exported and unrendered on purpose: 8004scan is
 * infrastructure Bazar reads from, not an account Bazar owns, so it belongs in
 * the footer's Provenance column rather than in a social row.
 */
const SOCIALS: SocialLink[] = [
  { label: 'Bazar on X', href: 'https://x.com/BazarHQ', Icon: XIcon },
  { label: 'Bazar on GitHub', href: 'https://github.com/mrnetwork0001/Bazar', Icon: GithubIcon },
];

export function SocialLinks({ className }: { className?: string }) {
  if (SOCIALS.length === 0) return null;

  return (
    <ul className={cn('flex items-center gap-2', className)}>
      {SOCIALS.map(({ label, href, Icon }) => (
        <li key={label}>
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            aria-label={label}
            title={label}
            className="ring-focus flex h-10 w-10 items-center justify-center rounded-full text-slate-400 transition-colors duration-200 hover:bg-white/[0.06] hover:text-white"
          >
            <Icon className="h-[18px] w-[18px]" />
          </a>
        </li>
      ))}
    </ul>
  );
}
