import story from '../content/story.json'

/** Report NASA → identificativo NTRS, per il link al documento originale. */
const NTRS: Record<string, string> = {
  'CR-168219': '19900019242',
  'CR-165148': '19830008070',
  'CR-168070': '19850025828',
  'CR-165558': '19850002690',
  'CR-167955': '19850002687',
  LPT: '19850002686',
  'CR-169301': '19900019238',
  'CR-168069': '19900019243',
  'CR-159584': '19810013521',
}

const docLabel = (doc: string) => (doc === 'LPT' ? 'NASA LPT Detailed Design Report' : `NASA ${doc}`)

interface Cite {
  doc: string
  page?: number
  pdfPage?: number
  quote: string
  visual?: string
}

/** Elenco di citazioni con la frase originale e il link al report su NTRS. */
export function Citations({ keys, refs = [] }: { keys: string[]; refs?: string[] }) {
  const all = story.citations as Record<string, Cite>
  const books = story.refs as Record<string, string>
  if (!keys.length && !refs.length) return null
  return (
    <details className="cites">
      <summary>
        Fonti ({keys.length + refs.length})
      </summary>
      <ul>
        {keys.map((k) => {
          const c = all[k]
          const where = c.page !== undefined ? `p. ${c.page}` : `pag. PDF ${c.pdfPage}`
          return (
            <li key={k}>
              <a href={`https://ntrs.nasa.gov/citations/${NTRS[c.doc]}`} target="_blank" rel="noreferrer">
                {docLabel(c.doc)}, {where}
              </a>
              <q lang="en">{c.quote}</q>
              {c.visual && <small> Valore di tabella letto sull'immagine della pagina.</small>}
            </li>
          )
        })}
        {refs.map((r) => (
          <li key={r}>{books[r]}</li>
        ))}
      </ul>
    </details>
  )
}
