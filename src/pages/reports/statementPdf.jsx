/** Load only on PDF request. Uses the redesigned document's Sora/Inter font assets. */
import { Document, Font, Page, StyleSheet, Text, View, pdf } from '@react-pdf/renderer'
import soraRegular from '../../assets/fonts/pdf/Sora-Regular.ttf'
import soraSemiBold from '../../assets/fonts/pdf/Sora-SemiBold.ttf'
import interRegular from '../../assets/fonts/pdf/Inter-Regular.ttf'
import interSemiBold from '../../assets/fonts/pdf/Inter-SemiBold.ttf'

Font.register({ family: 'StatementSora', fonts: [{ src: soraRegular, fontWeight: 400 }, { src: soraSemiBold, fontWeight: 600 }] })
Font.register({ family: 'StatementInter', fonts: [{ src: interRegular, fontWeight: 400 }, { src: interSemiBold, fontWeight: 600 }] })
Font.registerHyphenationCallback((word) => [word])
const family = ['StatementSora', 'StatementInter']
const clean = (input) => String(input ?? '').normalize('NFC').replace(/[\u0300-\u036f]/g, '')
const money = (input, currency) => `${currency} ${Number(input || 0).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const s = StyleSheet.create({
  page: { backgroundColor: '#ffffff', color: '#0a1e45', fontFamily: family, fontSize: 8.5, paddingTop: 38, paddingHorizontal: 36, paddingBottom: 40 },
  top: { borderBottomWidth: 1, borderBottomColor: '#dce3ee', paddingBottom: 13, marginBottom: 17 },
  title: { fontSize: 19, fontWeight: 600, marginBottom: 5 },
  label: { color: '#46557a', fontSize: 8, marginTop: 3 },
  band: { position: 'absolute', top: 0, left: 0, right: 0, height: 6, backgroundColor: '#0a1e45' },
  grid: { flexDirection: 'row', gap: 12, marginBottom: 15 },
  card: { flex: 1, borderWidth: 1, borderColor: '#dce3ee', borderRadius: 6, padding: 10 },
  name: { fontSize: 11, fontWeight: 600, marginTop: 4 },
  summary: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginBottom: 16 },
  metric: { flexGrow: 1, flexBasis: '30%', backgroundColor: '#eef2f8', borderRadius: 5, padding: 8 },
  amount: { marginTop: 5, fontSize: 10, fontWeight: 600 },
  header: { flexDirection: 'row', backgroundColor: '#eef2f8', paddingVertical: 8, paddingHorizontal: 7, marginBottom: 2 },
  row: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#dce3ee', paddingHorizontal: 7, paddingVertical: 7 },
  colDate: { width: '14%' }, colRef: { width: '22%' }, colType: { width: '22%' }, colValue: { width: '14%', textAlign: 'right' },
  muted: { color: '#46557a' },
  footer: { marginTop: 16, borderTopWidth: 1, borderTopColor: '#dce3ee', paddingTop: 10, color: '#46557a', fontSize: 8 },
  pageNum: { position: 'absolute', bottom: 19, right: 36, color: '#46557a', fontSize: 8 },
})
function StatementPdf({ statement }) {
  const summary = statement.summary
  const period = statement.period
  const org = statement.organization
  const customer = statement.customer
  const currency = statement.currency
  const metrics = [
    ['Opening balance', summary.opening_balance], ['Invoices', summary.period_invoice_amount],
    ['Credit notes', summary.period_credit_note_amount], ['Payments', summary.period_payment_amount],
    ['Closing balance', summary.closing_balance], ['Current outstanding', summary.outstanding_balance],
  ]
  return <Document title={`Customer statement - ${clean(customer.name)}`} author="DigitalInvoice">
    <Page size="A4" style={s.page}>
      <View style={s.band} fixed />
      <View style={s.top}>
        <Text style={s.title}>Customer statement</Text>
        <Text>{clean(org.display_name || org.name || 'Organisation')}</Text>
        <Text style={s.label}>Period: {period.from} to {period.to} · {currency}</Text>
      </View>
      <View style={s.grid}>
        <View style={s.card}><Text style={s.label}>CUSTOMER</Text><Text style={s.name}>{clean(customer.name)}</Text>
          <Text style={s.label}>{clean(customer.email || customer.phone || '')}</Text></View>
        <View style={s.card}><Text style={s.label}>ISSUED BY</Text><Text style={s.name}>{clean(org.display_name || org.name)}</Text>
          <Text style={s.label}>{clean(org.address || org.business_email || '')}</Text></View>
      </View>
      <View style={s.summary}>{metrics.map(([label, value]) => <View key={label} style={s.metric}><Text style={s.label}>{label}</Text><Text style={s.amount}>{money(value, currency)}</Text></View>)}</View>
      <View style={s.header} fixed><Text style={s.colDate}>Date</Text><Text style={s.colRef}>Reference</Text><Text style={s.colType}>Description</Text><Text style={s.colValue}>Debit</Text><Text style={s.colValue}>Credit</Text><Text style={s.colValue}>Balance</Text></View>
      {statement.transactions.map((entry, i) => <View key={`${entry.type}-${entry.id}-${i}`} style={s.row} wrap={false}>
        <Text style={s.colDate}>{clean(entry.transaction_date)}</Text>
        <Text style={s.colRef}>{clean(entry.reference)}</Text>
        <Text style={s.colType}>{clean(entry.description)}</Text>
        <Text style={s.colValue}>{money(entry.debit, currency)}</Text>
        <Text style={s.colValue}>{money(entry.credit, currency)}</Text>
        <Text style={s.colValue}>{money(entry.running_balance, currency)}</Text>
      </View>)}
      {!statement.transactions.length && <Text style={[s.label, { marginTop: 18 }]}>No transactions in the selected period.</Text>}
      <Text style={s.footer}>Generated from approved DigitalInvoice invoices, credit notes and non-void customer payments. This is an internal account statement, not NRS clearance or a bank statement.</Text>
      <Text style={s.pageNum} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} fixed />
    </Page>
  </Document>
}
export const statementPdfBlob = (statement) => pdf(<StatementPdf statement={statement} />).toBlob()
