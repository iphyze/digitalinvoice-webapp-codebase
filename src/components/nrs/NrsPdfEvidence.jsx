import { QRCodeSVG } from 'qrcode.react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Path, Rect, StyleSheet, Svg, Text, View } from '@react-pdf/renderer'
import { hasProductionNrsEvidence } from './nrsEvidence'

const styles = StyleSheet.create({
  panel: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 16,
    padding: 10,
    minHeight: 36,
    borderWidth: 1,
    borderColor: '#dce3ee',
    borderRadius: 8,
  },
  heading: { fontWeight: 700, fontSize: 9, color: '#0a1e45', marginBottom: 5 },
  text: { fontSize: 8, color: '#46557a', marginTop: 3 },
  identifier: { fontSize: 8, color: '#0a1e45', marginTop: 3 },
})

/**
 * Convert qrcode.react's own SVG geometry into react-pdf vector paths.
 * This uses the same QR encoder as the on-screen document without introducing
 * another dependency or rasterising an official code. Only geometry is copied;
 * no SVG markup or QR payload is inserted as HTML.
 */
export function prepareNrsPdfQr(evidence) {
  if (!hasProductionNrsEvidence(evidence)) return null
  try {
    const markup = renderToStaticMarkup(<QRCodeSVG value={evidence.qr_payload} size={96} level="M" marginSize={4} />)
    const doc = new DOMParser().parseFromString(markup, 'image/svg+xml')
    const svg = doc.documentElement
    if (svg.localName !== 'svg' || doc.querySelector('parsererror')) throw new Error('Invalid QR SVG')

    const viewBox = svg.getAttribute('viewBox') || '0 0 96 96'
    const dimensions = viewBox.trim().split(/\s+/).map(Number)
    if (dimensions.length !== 4 || dimensions.some((v) => !Number.isFinite(v) || v < 0)) throw new Error('Invalid QR dimensions')
    const paths = Array.from(svg.querySelectorAll('path')).map((path) => ({
      d: path.getAttribute('d'),
      fill: path.getAttribute('fill') || '#111827',
    })).filter((path) => path.d)
    if (!paths.length) throw new Error('QR paths missing')
    return { viewBox, dimensions, paths }
  } catch {
    return null
  }
}

function QrVector({ geometry }) {
  if (!geometry) return <Text style={styles.text}>QR code unavailable in this PDF.</Text>
  const { viewBox, dimensions, paths } = geometry
  return (
    <Svg width={96} height={96} viewBox={viewBox}>
      <Rect x={dimensions[0]} y={dimensions[1]} width={dimensions[2]} height={dimensions[3]} fill="#ffffff" />
      {paths.map((path, index) => <Path key={index} d={path.d} fill={path.fill} />)}
    </Svg>
  )
}

export default function NrsPdfEvidence({ evidence, qrGeometry }) {
  const confirmed = hasProductionNrsEvidence(evidence)
  return (
    <View style={styles.panel} wrap={false}>
      {confirmed ? (
        <>
          <View style={{ flex: 1 }}>
            <Text style={styles.heading}>NRS e-invoice evidence</Text>
            <Text style={styles.identifier}>IRN: {evidence.irn}</Text>
            <Text style={styles.identifier}>CSID: {evidence.csid}</Text>
            <Text style={styles.text}>Status: Confirmed by NRS</Text>
          </View>
          <QrVector geometry={qrGeometry} />
        </>
      ) : (
        <Text style={styles.text}>Not yet submitted to NRS</Text>
      )}
    </View>
  )
}
