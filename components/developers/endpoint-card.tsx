import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { CodeBlock, type CodeLang } from '@/components/developers/code-block';

/**
 * One card per route in the A2A router: method chip, path, description, a
 * parameter table and the response the endpoint actually returns.
 */

export type HttpMethod = 'GET' | 'POST';

const METHOD_TONE: Record<HttpMethod, string> = {
  GET: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300',
  POST: 'border-bnb/30 bg-bnb/10 text-bnb',
};

export function MethodChip({ method, className }: { method: HttpMethod; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-md border px-2 py-0.5 font-mono text-[11px] font-semibold tracking-wide',
        METHOD_TONE[method],
        className,
      )}
    >
      {method}
    </span>
  );
}

export type ParamLocation = 'query' | 'path' | 'body';

export interface EndpointParam {
  name: string;
  type: string;
  in: ParamLocation;
  required?: boolean;
  description: string;
}

export interface EndpointStatus {
  code: number;
  label: string;
}

export interface EndpointCardProps {
  id: string;
  method: HttpMethod;
  path: string;
  summary: string;
  description: ReactNode;
  /** Statuses this handler can return, in the order the handler checks them. */
  statuses: EndpointStatus[];
  params?: EndpointParam[];
  paramsCaption?: string;
  /** Pretty-printed example response body. */
  response: string;
  responseTitle: string;
  responseLang?: CodeLang;
  /** Optional note rendered under the response block. */
  note?: ReactNode;
  className?: string;
}

const LOCATION_LABEL: Record<ParamLocation, string> = {
  query: 'query',
  path: 'path',
  body: 'body',
};

function statusTone(code: number) {
  if (code < 300) return 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300';
  if (code < 500) return 'border-amber-400/30 bg-amber-400/10 text-amber-300';
  return 'border-rose-400/30 bg-rose-400/10 text-rose-300';
}

export function StatusChip({ code, label }: EndpointStatus) {
  return (
    <span
      className={cn(
        'tabular inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 font-mono text-[11px]',
        statusTone(code),
      )}
    >
      {code}
      <span className="text-slate-400">{label}</span>
    </span>
  );
}

export function EndpointCard({
  id,
  method,
  path,
  summary,
  description,
  statuses,
  params,
  paramsCaption,
  response,
  responseTitle,
  responseLang = 'json',
  note,
  className,
}: EndpointCardProps) {
  return (
    <article id={id} className={cn('glass scroll-mt-24 rounded-2xl p-5 sm:p-6', className)}>
      <header>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <MethodChip method={method} />
          <h3 className="min-w-0 break-all font-mono text-sm font-semibold text-white sm:text-base">{path}</h3>
        </div>
        <p className="mt-2 text-sm font-medium text-slate-200">{summary}</p>
        <p className="mt-1.5 text-sm leading-relaxed text-slate-400">{description}</p>
        <ul className="mt-3 flex flex-wrap gap-2" aria-label={`Status codes for ${method} ${path}`}>
          {statuses.map((s) => (
            <li key={s.code}>
              <StatusChip {...s} />
            </li>
          ))}
        </ul>
      </header>

      {params && params.length > 0 && (
        <div className="mt-5">
          <h4 className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
            {paramsCaption ?? 'Parameters'}
          </h4>
          <div className="mt-2 overflow-x-auto rounded-xl border border-white/[0.08]">
            <table className="w-full min-w-[34rem] border-collapse text-left text-sm">
              <thead>
                <tr className="bg-white/[0.03] text-[11px] uppercase tracking-wider text-slate-500">
                  <th scope="col" className="px-3 py-2 font-medium">
                    Name
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    Type
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    In
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    Description
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {params.map((p) => (
                  <tr key={`${p.in}-${p.name}`} className="align-top">
                    <td className="px-3 py-2.5">
                      <span className="font-mono text-[12px] text-cyan-300">{p.name}</span>
                      {p.required ? (
                        <span className="ml-1.5 text-[10px] font-medium uppercase tracking-wide text-bnb">req</span>
                      ) : (
                        <span className="ml-1.5 text-[10px] uppercase tracking-wide text-slate-600">opt</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 font-mono text-[12px] text-violet-300">{p.type}</td>
                    <td className="px-3 py-2.5 font-mono text-[11px] text-slate-500">{LOCATION_LABEL[p.in]}</td>
                    <td className="px-3 py-2.5 text-[13px] leading-relaxed text-slate-400">{p.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="mt-5">
        <h4 className="text-[11px] font-medium uppercase tracking-wider text-slate-500">Example response</h4>
        <CodeBlock
          className="mt-2"
          code={response}
          lang={responseLang}
          title={responseTitle}
          copyLabel={`${method} ${path} response`}
          scroll="max-h-96"
        />
        {note && <p className="mt-3 text-xs leading-relaxed text-slate-500">{note}</p>}
      </div>
    </article>
  );
}
