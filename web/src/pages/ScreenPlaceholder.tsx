type Props = { title: string; path: string; note?: string }

export function ScreenPlaceholder({ title, path, note }: Props) {
  return (
    <article>
      <h1 style={{ fontSize: '1.25rem', margin: '0 0 0.5rem' }}>{title}</h1>
      <p style={{ margin: 0, color: '#475467', fontSize: '0.9rem' }}>
        <code>{path}</code>
      </p>
      {note ? (
        <p style={{ marginTop: '1rem', color: '#344054', fontSize: '0.875rem' }}>
          {note}
        </p>
      ) : null}
    </article>
  )
}
