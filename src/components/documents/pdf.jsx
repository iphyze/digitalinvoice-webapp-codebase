/*
  PDF version of the modern document template, rendered from the same model as
  DocumentSheet. Loaded on demand (dynamic import) so react-pdf and the fonts
  are only downloaded when someone generates a PDF.
  Fonts are embedded: Inter (has ₦; the old template used built-in Helvetica,
  which has no ₦) and Sora Bold for the document number.
*/
import { Document, Font, Image, Page, StyleSheet, Text, View, pdf } from '@react-pdf/renderer'
import soraRegular from '../../assets/fonts/pdf/Sora-Regular.ttf'
import soraSemiBold from '../../assets/fonts/pdf/Sora-SemiBold.ttf'
import soraBold from '../../assets/fonts/pdf/Sora-Bold.ttf'
import interRegular from '../../assets/fonts/pdf/Inter-Regular.ttf'
import interSemiBold from '../../assets/fonts/pdf/Inter-SemiBold.ttf'
import interBold from '../../assets/fonts/pdf/Inter-Bold.ttf'
import NrsPdfEvidence, { prepareNrsPdfQr } from '../nrs/NrsPdfEvidence'

// Sora for all text (matches the app); Inter only supplies ₦ and the dot-below
// letters Sora lacks, via react-pdf's font fallback list. Each weight has its own
// internal font name, so regular/semibold/bold really differ.
Font.register({ family: 'Sora', fonts: [{ src: soraRegular, fontWeight: 400 }, { src: soraSemiBold, fontWeight: 600 }, { src: soraBold, fontWeight: 700 }] })
Font.register({ family: 'Inter', fonts: [{ src: interRegular, fontWeight: 400 }, { src: interSemiBold, fontWeight: 600 }, { src: interBold, fontWeight: 700 }] })
const FONT = ['Sora', 'Inter']
Font.registerHyphenationCallback((word) => [word]) // never hyphenate names, references or amounts

/*
  react-pdf ignores the offsets its shaper gives combining marks, so a tone mark
  with no precomposed character (Yoruba ọ̀, ẹ́) lands after the letter. For PDFs:
  compose everything that has a precomposed form (é, á, ọ stay intact), then drop
  only the leftover combining marks. NRS evidence (especially the signed, opaque
  QR payload) must remain byte-for-byte unchanged. On screen and in browser
  print, the full spelling is kept.
*/
const pdfText = (value) => String(value ?? '').normalize('NFC').replace(/[\u0300-\u036f]/g, '')
const forPdf = (value) => {
  if (typeof value === 'string') return pdfText(value)
  if (Array.isArray(value)) return value.map(forPdf)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, k === 'logo' || k === 'nrsEvidence' ? v : forPdf(v)]))
  }
  return value
}

const C = { ink: '#0a1e45', muted: '#46557a', subtle: '#5a6987', line: '#dce3ee', soft: '#eef2f8', blue: '#1766c8', white: '#ffffff' }
const TONES = { success: ['#e2f6ee', '#0b7f57'], warning: ['#fdf1df', '#a65f00'], danger: ['#fdecee', '#c8323c'], neutral: ['#eef2f8', '#46557a'] }

const s = StyleSheet.create({
  page: { paddingTop: 40, paddingBottom: 46, paddingHorizontal: 40, fontFamily: FONT, fontSize: 9, color: C.ink, lineHeight: 1.45 },
  band: { position: 'absolute', top: 0, left: 0, right: 0, height: 6, flexDirection: 'row' },
  header: { flexDirection: 'row', justifyContent: 'space-between', paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: C.line },
  seller: { flexDirection: 'row', gap: 10, maxWidth: 300 },
  logo: { width: 38, height: 38, borderRadius: 9, backgroundColor: '#2487da', alignItems: 'center', justifyContent: 'center' },
  logoImg: { width: 38, height: 38, borderRadius: 9, objectFit: 'contain' },
  initial: { color: C.white, fontFamily: FONT, fontSize: 15 },
  eyebrow: { color: C.blue, fontSize: 7.5, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase' },
  sellerName: { fontFamily: FONT, fontSize: 13, marginTop: 2, marginBottom: 3 },
  muted: { color: C.muted, fontSize: 8.5 },
  label: { color: C.subtle, fontSize: 7.5, fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase' },
  number: { alignItems: 'flex-end' },
  numberText: { fontFamily: FONT, fontSize: 17, marginTop: 2, marginBottom: 5 },
  statuses: { flexDirection: 'row', gap: 4 },
  pill: { paddingVertical: 2, paddingHorizontal: 7, borderRadius: 8, fontSize: 7.5, fontWeight: 700 },
  parties: { flexDirection: 'row', gap: 18, paddingVertical: 14 },
  party: { flex: 1 },
  partyName: { fontSize: 10.5, fontWeight: 700, marginTop: 3, marginBottom: 2 },
  meta: { flex: 1.25, flexDirection: 'row', flexWrap: 'wrap', borderWidth: 1, borderColor: C.line, borderRadius: 7, padding: 10, rowGap: 7 },
  metaItem: { width: '33.33%', paddingRight: 6 },
  metaValue: { fontSize: 9, fontWeight: 600, marginTop: 1 },
  highlight: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: C.ink, borderRadius: 8, paddingVertical: 10, paddingHorizontal: 14, marginBottom: 12 },
  tableTitle: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  th: { flexDirection: 'row', backgroundColor: C.soft, borderRadius: 4, paddingVertical: 6, paddingHorizontal: 7 },
  thText: { color: C.muted, fontSize: 7.5, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase' },
  tr: { flexDirection: 'row', paddingVertical: 7, paddingHorizontal: 7, borderBottomWidth: 1, borderBottomColor: C.line },
  first: { flex: 2.6, paddingRight: 6 },
  cell: { flex: 1, textAlign: 'right' },
  cellLeft: { flex: 1.2 },
  rowTitle: { fontSize: 9, fontWeight: 600 },
  rowSub: { color: C.subtle, fontSize: 7.5 },
  foot: { flexDirection: 'row', gap: 20, marginTop: 14 },
  blocks: { flex: 1, gap: 9 },
  card: { borderWidth: 1, borderStyle: 'dashed', borderColor: '#b9c6da', borderRadius: 7, padding: 9 },
  totals: { width: 210, gap: 4 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between' },
  grand: { borderTopWidth: 1, borderTopColor: C.line, paddingTop: 6, marginTop: 3 },
  due: { backgroundColor: C.ink, borderRadius: 7, paddingVertical: 8, paddingHorizontal: 10, marginTop: 4 },
  footer: { marginTop: 18, paddingTop: 10, borderTopWidth: 1, borderTopColor: C.line, alignItems: 'center' },
  pageNo: { position: 'absolute', bottom: 20, right: 40, fontSize: 7.5, color: C.subtle },
})

function DocumentPdf({ model, nrsQrGeometry }) {
  const { seller, party, table } = model
  return (
    <Document title={`${model.title} ${model.number}`} author={seller.name} creator="DigitalInvoice">
      <Page size="A4" style={s.page}>
        <View style={s.band} fixed>
          <View style={{ flex: 1, backgroundColor: '#19d8a4' }} />
          <View style={{ flex: 1.2, backgroundColor: '#2487da' }} />
          <View style={{ flex: 1, backgroundColor: C.ink }} />
        </View>

        <View style={s.header}>
          <View style={s.seller}>
            {seller.logo ? <Image src={seller.logo} style={s.logoImg} /> : <View style={s.logo}><Text style={s.initial}>{seller.initial}</Text></View>}
            <View>
              <Text style={s.eyebrow}>{model.eyebrow}</Text>
              <Text style={s.sellerName}>{seller.name}</Text>
              {seller.lines.map((line) => <Text key={line} style={s.muted}>{line}</Text>)}
            </View>
          </View>
          <View style={s.number}>
            <Text style={s.label}>{model.title}</Text>
            <Text style={s.numberText}>{model.number}</Text>
            <View style={s.statuses}>
              {model.statuses.map((st) => {
                const [bg, fg] = TONES[st.tone] || TONES.neutral
                return <Text key={st.text} style={[s.pill, { backgroundColor: bg, color: fg }]}>{st.text}</Text>
              })}
            </View>
          </View>
        </View>

        <View style={s.parties}>
          <View style={s.party}>
            <Text style={s.label}>{party.label}</Text>
            <Text style={s.partyName}>{party.name}</Text>
            {party.lines.map((line, i) => <Text key={`${line}-${i}`} style={s.muted}>{line}</Text>)}
          </View>
          <View style={s.meta}>
            {model.meta.map((m) => (
              <View key={m.label} style={s.metaItem}><Text style={s.label}>{m.label}</Text><Text style={s.metaValue}>{m.value}</Text></View>
            ))}
          </View>
        </View>

        {model.highlight ? (
          <View style={s.highlight}>
            <Text style={{ color: '#bdcee5', fontWeight: 600 }}>{model.highlight.label}</Text>
            <Text style={{ color: C.white, fontSize: 15, fontWeight: 700 }}>{model.highlight.value}</Text>
          </View>
        ) : null}

        {table.title ? (
          <View style={s.tableTitle}><Text style={{ fontWeight: 700, fontSize: 9.5 }}>{table.title}</Text><Text style={s.muted}>{table.subtitle}</Text></View>
        ) : null}
        <View style={s.th} fixed>
          <Text style={[s.thText, s.first]}>{table.firstLabel || 'Description'}</Text>
          {table.columns.map((c) => <Text key={c.key} style={[s.thText, c.align === 'right' ? s.cell : s.cellLeft]}>{c.label}</Text>)}
        </View>
        {table.rows.length ? table.rows.map((row, i) => (
          <View key={`${row.title}-${i}`} style={s.tr} wrap={false}>
            <View style={s.first}>
              <Text style={s.rowTitle}>{row.title}</Text>
              {row.subtitle ? <Text style={s.rowSub}>{row.subtitle}</Text> : null}
            </View>
            {table.columns.map((c) => (
              <Text key={c.key} style={[c.align === 'right' ? s.cell : s.cellLeft, c.strong ? { fontWeight: 700 } : null]}>{row.cells[c.key]}</Text>
            ))}
          </View>
        )) : (
          <View style={s.tr}><Text style={[s.muted, { flex: 1, textAlign: 'center' }]}>{table.empty || 'No lines on this document.'}</Text></View>
        )}

        <View style={s.foot} wrap={false}>
          <View style={s.blocks}>
            {model.blocks.map((b) => (
              <View key={b.label} style={b.card ? s.card : null}>
                <Text style={s.label}>{b.label}</Text>
                {b.title ? <Text style={{ fontWeight: 700, marginTop: 1 }}>{b.title}</Text> : null}
                <Text style={s.muted}>{b.text}</Text>
              </View>
            ))}
          </View>
          {model.totals.length ? (
            <View style={s.totals}>
              {model.totals.map((t) => (
                <View key={t.label} style={[s.totalRow, t.emphasis === 'grand' ? s.grand : null, t.emphasis === 'due' ? s.due : null]}>
                  <Text style={t.emphasis === 'due' ? { color: '#bdcee5', fontWeight: 600 } : { color: C.muted }}>{t.label}</Text>
                  <Text style={t.emphasis === 'due' ? { color: C.white, fontWeight: 700, fontSize: 11 } : { fontWeight: t.emphasis ? 700 : 600 }}>{t.value}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>

        {Object.hasOwn(model, 'nrsEvidence') ? <NrsPdfEvidence evidence={model.nrsEvidence} qrGeometry={nrsQrGeometry} /> : null}

        <View style={s.footer} wrap={false}>
          <Text style={{ fontWeight: 600 }}>{model.footer.message}</Text>
          {model.footer.note ? <Text style={[s.muted, { fontSize: 7.5, marginTop: 4, textAlign: 'center' }]}>{model.footer.note}</Text> : null}
        </View>

        <Text style={s.pageNo} fixed render={({ pageNumber, totalPages }) => (totalPages > 1 ? `Page ${pageNumber} of ${totalPages}` : '')} />
      </Page>
    </Document>
  )
}

export async function renderDocumentPdf(model) {
  const pdfModel = forPdf(model)
  // Build SVG QR geometry before react-pdf starts rendering. Never normalize
  // or modify the opaque evidence payload, including accents/combining marks.
  const nrsQrGeometry = Object.hasOwn(pdfModel, 'nrsEvidence') ? prepareNrsPdfQr(pdfModel.nrsEvidence) : null
  return pdf(<DocumentPdf model={pdfModel} nrsQrGeometry={nrsQrGeometry} />).toBlob()
}
