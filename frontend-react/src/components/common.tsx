import type { ReactNode } from "react";
import { safeMarkdown } from "../lib/format";

export function Brand() {
  return <span className="brand" aria-label="MedV2"><span>//</span> MedV2</span>;
}

export function Markdown({ children, className = "" }: { children?: string; className?: string }) {
  return <div className={`prose ${className}`} dangerouslySetInnerHTML={{ __html: safeMarkdown(children) }} />;
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return <div className="empty-state"><strong>{title}</strong>{children ? <p>{children}</p> : null}</div>;
}

export function Skeleton({ rows = 4 }: { rows?: number }) {
  return <div className="skeleton" aria-label="Carregando">{Array.from({ length: rows }, (_, index) => <span key={index} />)}</div>;
}

export function SectionHeader({ title, meta, children }: { title: string; meta?: string; children?: ReactNode }) {
  return <div className="section-header"><div><h2>{title}</h2>{meta ? <p>{meta}</p> : null}</div>{children}</div>;
}

export function StatusBadge({ status }: { status?: string }) {
  const normalized = status || "normal";
  const labels: Record<string, string> = { normal: "Normal", alto: "Alto", baixo: "Baixo", alterado: "Alterado" };
  return <span className={`status-badge ${normalized}`}>{labels[normalized] ?? normalized}</span>;
}

export function Dialog({ title, open, onClose, children, className = "", titleId = "dialog-title" }: { title: string; open: boolean; onClose: () => void; children: ReactNode; className?: string; titleId?: string }) {
  if (!open) return null;
  return <div className="dialog-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section className={`dialog ${className}`.trim()} role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <header><h2 id={titleId}>{title}</h2><button type="button" className="icon-button" onClick={onClose} aria-label="Fechar" autoFocus>×</button></header>
      {children}
    </section>
  </div>;
}

export function Notice({ tone = "info", children }: { tone?: "info" | "warning" | "danger" | "success"; children: ReactNode }) {
  return <div className={`notice ${tone}`} role={tone === "danger" ? "alert" : "status"}>{children}</div>;
}
