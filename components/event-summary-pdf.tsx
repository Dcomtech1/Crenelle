import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

interface EventSummaryReportProps {
  event: {
    name: string
    date: string
    time: string | null
    venue: string
  } | null
  stats: {
    totalSeats: number
    totalInvited: number
    arrived: number
    arrivedSeats: number
    pendingSeats: number
    arrivalRate: number
    peakCheckInTime: string
    entranceStats: Array<{ label: string; count: number }>
    recentEntries: Array<{
      guestName: string
      seatInfo: string | null
      scannedAt: string
      partySize: number
    }>
  }
}

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    backgroundColor: '#FFFFFF',
    color: '#000000',
    position: 'relative',
  },
  header: {
    marginBottom: 15,
  },
  brand: {
    fontFamily: 'Courier',
    fontSize: 10,
    color: '#B8860B', // Crenelle Copper Accent
    letterSpacing: 2,
    marginBottom: 6,
  },
  title: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 24,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  metaContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 2,
    borderBottomColor: '#000000',
    paddingBottom: 12,
    marginBottom: 20,
  },
  metaItem: {
    fontSize: 9,
    fontFamily: 'Courier',
    color: '#555555',
  },
  sectionTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
    paddingBottom: 3,
    marginBottom: 10,
    marginTop: 10,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 20,
    width: '100%',
  },
  kpiBox: {
    width: '48%',
    borderWidth: 1,
    borderColor: '#000000',
    padding: 10,
    marginRight: '2%',
    marginBottom: 8,
    backgroundColor: '#FAF9F6', // Crenelle paper background representation
  },
  kpiLabel: {
    fontFamily: 'Courier',
    fontSize: 8,
    textTransform: 'uppercase',
    color: '#666666',
    marginBottom: 4,
  },
  kpiValue: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 16,
    color: '#000000',
  },
  kpiSubtext: {
    fontFamily: 'Helvetica',
    fontSize: 8,
    color: '#666666',
    marginTop: 2,
  },
  twoColumnContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  column: {
    width: '48%',
  },
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
    paddingBottom: 4,
    marginBottom: 6,
  },
  tableHeaderCell: {
    fontFamily: 'Courier',
    fontSize: 8,
    color: '#666666',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
    paddingVertical: 4,
    alignItems: 'center',
  },
  tableCell: {
    fontSize: 8,
    fontFamily: 'Courier',
    color: '#111111',
  },
  gateRow: {
    marginBottom: 8,
  },
  gateLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  gateLabel: {
    fontFamily: 'Courier',
    fontSize: 8,
    color: '#333333',
  },
  gateCount: {
    fontFamily: 'Courier',
    fontSize: 8,
    color: '#B8860B',
  },
  progressContainer: {
    width: '100%',
    height: 6,
    backgroundColor: '#EEEEEE',
    borderWidth: 1,
    borderColor: '#000000',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#B8860B',
  },
  footer: {
    position: 'absolute',
    bottom: 25,
    left: 40,
    right: 40,
    borderTopWidth: 1,
    borderTopColor: '#EEEEEE',
    paddingTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 7,
    fontFamily: 'Courier',
    color: '#999999',
  }
})

export function EventSummaryReport({ event, stats }: EventSummaryReportProps) {
  const formattedDate = event?.date
    ? new Date(event.date).toLocaleDateString('en-GB', {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      })
    : 'N/A'

  const totalCapacity = event ? (event as any).capacity : null
  const capacityPctStr = totalCapacity ? ` / ${totalCapacity} capacity` : ''

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.brand}>CRENELLE // POST_EVENT_SUMMARY</Text>
          <Text style={styles.title}>{event?.name || 'Untitled Event'}</Text>
        </View>

        {/* Metadata bar */}
        <View style={styles.metaContainer}>
          <Text style={styles.metaItem}>DATE: {formattedDate}</Text>
          <Text style={styles.metaItem}>VENUE: {event?.venue || 'N/A'}</Text>
          <Text style={styles.metaItem}>TIME: {event?.time || 'N/A'}</Text>
        </View>

        {/* Section: Key Performance Indicators */}
        <Text style={styles.sectionTitle}>Key Performance Indicators</Text>
        <View style={styles.kpiGrid}>
          {/* KPI 1 */}
          <View style={styles.kpiBox}>
            <Text style={styles.kpiLabel}>ATTENDANCE RATE</Text>
            <Text style={styles.kpiValue}>{stats.arrivalRate}%</Text>
            <Text style={styles.kpiSubtext}>Percentage of total seats checked in</Text>
          </View>
          {/* KPI 2 */}
          <View style={styles.kpiBox}>
            <Text style={styles.kpiLabel}>TOTAL ADMITTED</Text>
            <Text style={styles.kpiValue}>
              {stats.arrived} {stats.arrived === 1 ? 'person' : 'people'}
            </Text>
            <Text style={styles.kpiSubtext}>
              {stats.arrivedSeats} of {stats.totalInvited} invitations checked in{capacityPctStr}
            </Text>
          </View>
          {/* KPI 3 */}
          <View style={styles.kpiBox}>
            <Text style={styles.kpiLabel}>NO-SHOWS</Text>
            <Text style={styles.kpiValue}>{stats.pendingSeats}</Text>
            <Text style={styles.kpiSubtext}>Remaining seats that did not check in</Text>
          </View>
          {/* KPI 4 */}
          <View style={styles.kpiBox}>
            <Text style={styles.kpiLabel}>PEAK CHECK-IN TIME</Text>
            <Text style={styles.kpiValue}>{stats.peakCheckInTime.split(' (')[0]}</Text>
            <Text style={styles.kpiSubtext}>
              {stats.peakCheckInTime.includes('(')
                ? stats.peakCheckInTime.substring(stats.peakCheckInTime.indexOf('('))
                : 'Highest 30-min window activity'}
            </Text>
          </View>
        </View>

        {/* Section: Traffic Breakdown */}
        <View style={styles.twoColumnContainer}>
          {/* Column 1: Entrance Gate Traffic */}
          <View style={styles.column}>
            <Text style={styles.sectionTitle}>Entrance Gate Traffic</Text>
            {stats.entranceStats.length === 0 ? (
              <Text style={{ fontFamily: 'Courier', fontSize: 8, color: '#666666', marginTop: 5 }}>
                NO_ENTRANCE_DATA_AVAILABLE
              </Text>
            ) : (
              stats.entranceStats.map((gate) => {
                const gatePct = stats.arrived > 0 ? Math.round((gate.count / stats.arrived) * 100) : 0
                return (
                  <View key={gate.label} style={styles.gateRow}>
                    <View style={styles.gateLabelRow}>
                      <Text style={styles.gateLabel}>{gate.label.toUpperCase()}</Text>
                      <Text style={styles.gateCount}>
                        {gate.count} ({gatePct}%)
                      </Text>
                    </View>
                    <View style={styles.progressContainer}>
                      <View style={[styles.progressBar, { width: `${gatePct}%` }]} />
                    </View>
                  </View>
                )
              })
            )}
          </View>

          {/* Column 2: Attendance Overview */}
          <View style={styles.column}>
            <Text style={styles.sectionTitle}>Report Summary</Text>
            <Text style={{ fontFamily: 'Courier', fontSize: 8, color: '#333333', lineHeight: 1.4 }}>
              This document contains check-in metrics recorded by scanners at gate entrances. All check-in entries are logged securely using encrypted scan tokens.
            </Text>
            <Text style={{ fontFamily: 'Courier', fontSize: 8, color: '#333333', lineHeight: 1.4, marginTop: 6 }}>
              Total Invitations Issued: {stats.totalInvited}{'\n'}
              Total Invited Seats: {stats.totalSeats}{'\n'}
              Admitted Invitations: {stats.arrivedSeats}{'\n'}
              Admitted Seats: {stats.arrived}{'\n'}
              No-show Seats: {stats.pendingSeats} ({Math.round(100 - stats.arrivalRate)}%)
            </Text>
          </View>
        </View>

        {/* Section: Recent Arrivals */}
        <Text style={styles.sectionTitle}>Recent Arrivals (Top 10)</Text>
        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderCell, { width: '40%' }]}>NAME</Text>
          <Text style={[styles.tableHeaderCell, { width: '20%' }]}>SEAT INFO</Text>
          <Text style={[styles.tableHeaderCell, { width: '25%' }]}>TIME</Text>
          <Text style={[styles.tableHeaderCell, { width: '15%', textAlign: 'right' }]}>PARTY</Text>
        </View>

        {stats.recentEntries.length === 0 ? (
          <Text style={{ fontFamily: 'Courier', fontSize: 8, color: '#666666', marginTop: 5 }}>
            NO_ARRIVALS_RECORDED
          </Text>
        ) : (
          stats.recentEntries.map((entry, index) => (
            <View key={index} style={styles.tableRow}>
              <Text style={[styles.tableCell, { width: '40%' }]}>
                {entry.guestName}
              </Text>
              <Text style={[styles.tableCell, { width: '20%' }]}>
                {entry.seatInfo || '-'}
              </Text>
              <Text style={[styles.tableCell, { width: '25%' }]}>
                {new Date(entry.scannedAt).toLocaleTimeString('en-GB', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit'
                })}
              </Text>
              <Text style={[styles.tableCell, { width: '15%', textAlign: 'right' }]}>
                {entry.partySize > 1 ? `+${entry.partySize}` : 'SOLO'}
              </Text>
            </View>
          ))
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>CRENELLE EVENT MANAGEMENT SYSTEM</Text>
          <Text style={styles.footerText}>
            GENERATED: {new Date().toLocaleDateString('en-GB')} {new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      </Page>
    </Document>
  )
}
