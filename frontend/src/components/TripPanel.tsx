export default function TripPanel() {
  return (
    <div>
      <div className="insights-box" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <span className="material-symbols-outlined" style={{ color: 'var(--primary)', fontSize: 28 }}>auto_awesome</span>
          <span style={{ fontWeight: 600 }}>Plan Your Journey</span>
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
          Build multi-destination trips, save frequent routes, and get personalized recommendations.
        </p>
      </div>

      <div style={{
        border: '2px dashed var(--outline-variant)',
        borderRadius: 'var(--radius-xl)',
        padding: 32,
        textAlign: 'center',
        marginTop: 16,
      }}>
        <span className="material-symbols-outlined" style={{ fontSize: 48, color: 'var(--outline-variant)', marginBottom: 12 }}>
          construction
        </span>
        <p style={{ fontWeight: 600, marginBottom: 8, fontSize: 15 }}>Coming Soon</p>
        <ul style={{ listStyle: 'none', fontSize: 13, color: 'var(--text-muted)', lineHeight: 2 }}>
          <li>• Multi-destination trip planning</li>
          <li>• Save & manage frequent routes</li>
          <li>• Personalized recommendations from travel history</li>
          <li>• Scheduled trips with time-based alerts</li>
          <li>• Combine Search and A-to-B routes into one journey</li>
        </ul>
      </div>
    </div>
  )
}
