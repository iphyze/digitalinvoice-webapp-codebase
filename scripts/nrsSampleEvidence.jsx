/**
 * DEVELOPMENT-ONLY substitute for the PDF evidence view. Used exclusively by
 * the sample generator's esbuild alias. It is NEVER imported by the application.
 * This deliberately does not mark any record as verified/production.
 */
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { QRCodeSVG } from 'qrcode.react'
import { Path, Rect, StyleSheet, Svg, Text, View } from '@react-pdf/renderer'

const styles = StyleSheet.create({
  panel: { marginTop: 13, padding: 10, borderWidth: 1, borderColor: '#b4c4d8', borderRadius: 8, flexDirection: 'row', gap: 10, alignItems: 'center' },
  title: { fontWeight: 700, fontSize: 9, color: '#0a1e45', marginBottom: 3 },
  warning: { fontSize: 7.7, color: '#a3410d', fontWeight: 700, marginBottom: 4 },
  text: { fontSize: 7.8, color: '#46557a', marginTop: 3 },
  code: { fontSize: 7.8, color: '#0a1e45', marginTop: 2 },
  qrCaption: { fontSize: 7.3, textAlign: 'center', color: '#a3410d', marginTop: 3 },
})

const isMock = (e) => e?.sample_mode === 'mock-post-validation' && e?.fixture_only === true

/** Reproduce qrcode.react's vector QR geometry without a browser DOMParser. */
export function prepareNrsPdfQr(evidence) {
  if (!isMock(evidence) || !evidence.qr_payload) return null
  const svg = renderToStaticMarkup(createElement(QRCodeSVG, { value: evidence.qr_payload, size: 96, level: 'M', marginSize: 4 }))
  const viewBox = /\bviewBox="([^"]+)"/.exec(svg)?.[1] || '0 0 96 96'
  const dimensions = viewBox.trim().split(/\s+/).map(Number)
  if (dimensions.length !== 4 || dimensions.some((x) => !Number.isFinite(x) || x < 0)) throw new Error('Invalid generated mock QR dimensions')
  const paths = [...svg.matchAll(/<path\b([^>]*?)\/?\s*>/g)].map((match) => ({
    d: /\bd="([^"]+)"/.exec(match[1])?.[1],
    fill: /\bfill="([^"]+)"/.exec(match[1])?.[1] || '#0a1e45',
  })).filter((path) => path.d)
  if (!paths.length) throw new Error('Mock QR has no paths')
  return { viewBox, dimensions, paths }
}

function MockQr({ geometry }) {
  if (!geometry) throw new Error('Mock QR geometry is required for illustrative samples')
  return <View style={{ width: 102 }}>
    <Svg width={96} height={96} viewBox={geometry.viewBox}>
      <Rect x={geometry.dimensions[0]} y={geometry.dimensions[1]} width={geometry.dimensions[2]} height={geometry.dimensions[3]} fill="#fff" />
      {geometry.paths.map((p, index) => <Path key={index} d={p.d} fill={p.fill} />)}
    </Svg>
    <Text style={styles.qrCaption}>DEMO QR · MOCK DATA</Text>
  </View>
}

export default function SampleNrsPdfEvidence({ evidence, qrGeometry }) {
  if (!isMock(evidence)) {
    return <View style={styles.panel} wrap={false}>
      <Text style={styles.text}>Fictional document preview · demonstration data.</Text>
    </View>
  }
  return <View style={styles.panel} wrap={false}>
    <View style={{ flex: 1 }}>
      <Text style={styles.title}>Illustrative verification-field placement</Text>
      <Text style={styles.warning}>DEMONSTRATION ONLY — MOCK IDENTIFIERS</Text>
      <Text style={styles.code}>Mock IRN: {evidence.irn}</Text>
      <Text style={styles.code}>Mock CSID: {evidence.csid}</Text>
      <Text style={styles.text}>{evidence.source_document_type === 'payment_receipt'
        ? 'Illustrative verification-field placement for the linked example invoice.'
        : 'This section illustrates where verified reference details may appear.'}</Text>
    </View>
    <MockQr geometry={qrGeometry} />
  </View>
}
