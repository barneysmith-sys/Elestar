import { type ReactNode } from "react"

export function Label({ children, light }: { children: ReactNode; light?: boolean }) {
  return <div className={light ? "label-light" : "label"}>{children}</div>
}

export function SectionHead({
  kicker,
  title,
  sub,
  right,
}: {
  kicker: string
  title: string
  sub?: string
  right?: ReactNode
}) {
  return (
    <div className="stack-4" style={{ marginBottom: 32 }}>
      <div className="row-between">
        <Label>{kicker}</Label>
        {right}
      </div>
      <h1 className="display-lg">{title}</h1>
      {sub ? <p className="lede" style={{ maxWidth: "62ch" }}>{sub}</p> : null}
    </div>
  )
}

export function StatBlock({
  value,
  label,
  hint,
}: {
  value: string | number
  label: string
  hint?: string
}) {
  return (
    <div className="stack-2">
      <div className="ticker" style={{ fontSize: 34, fontWeight: 300 }}>
        {value}
      </div>
      <Label>{label}</Label>
      {hint ? <div className="body-sm" style={{ fontSize: 12 }}>{hint}</div> : null}
    </div>
  )
}

export function Empty({
  title,
  body,
  action,
}: {
  title: string
  body: string
  action?: ReactNode
}) {
  return (
    <div className="card-flat stack-4" style={{ borderStyle: "dashed", padding: 40, alignItems: "flex-start" }}>
      <Label>Nothing here yet</Label>
      <div className="display-sm">{title}</div>
      <p className="body-sm" style={{ maxWidth: "56ch" }}>{body}</p>
      {action}
    </div>
  )
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <div
      className="card-flat stack-2"
      style={{ borderColor: "rgba(107,48,48,0.4)", background: "var(--stop-soft)" }}
    >
      <Label>Something went wrong</Label>
      <p className="body-sm" style={{ color: "var(--stop)" }}>{children}</p>
    </div>
  )
}

export default Label
