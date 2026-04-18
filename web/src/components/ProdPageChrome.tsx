import type { ReactNode } from 'react'

export function ProdPageChrome({
  title,
  lead,
  children,
}: {
  title: string
  lead?: string
  children: ReactNode
}) {
  return (
    <article className="prod-page">
      <header className="prod-page__head">
        <h1 className="prod-page__title">{title}</h1>
        {lead ? <p className="prod-page__lead">{lead}</p> : null}
      </header>
      <div className="prod-page__body">{children}</div>
    </article>
  )
}

export function ProdSection({
  title,
  children,
  className,
}: {
  title: string
  children: ReactNode
  className?: string
}) {
  return (
    <section className={['prod-section', className].filter(Boolean).join(' ')}>
      <h2 className="prod-section__title">{title}</h2>
      <div className="prod-section__content">{children}</div>
    </section>
  )
}

export function ProdField({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <label className="prod-field">
      <span className="prod-field__label">{label}</span>
      {children}
    </label>
  )
}
