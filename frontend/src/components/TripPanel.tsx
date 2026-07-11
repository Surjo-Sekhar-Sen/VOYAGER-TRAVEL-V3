export default function TripPanel() {
  return (
    <div style={{ padding: 16 }}>
      <div className="insights-box">
        <h3 style={{ marginBottom: 8 }}>🗺️ Trip Planner</h3>
        <p style={{ fontSize: 13, lineHeight: 1.6 }}>
          The Trip Planner feature is coming soon! This will allow you to:
        </p>
        <ul style={{ marginTop: 10, paddingLeft: 20, fontSize: 13, lineHeight: 1.8 }}>
          <li>Plan multi-destination trips across Bengaluru</li>
          <li>Save and manage your frequent routes</li>
          <li>Get personalized recommendations based on your travel history</li>
          <li>Schedule trips with time-based alerts</li>
          <li>Combine multiple Search and A-to-B routes into one journey</li>
        </ul>
      </div>

      <div style={{
        background: 'var(--bg)',
        borderRadius: 8,
        padding: 20,
        marginTop: 16,
        textAlign: 'center',
        border: '1px dashed var(--border)',
      }}>
        <span style={{ fontSize: 40 }}>🚧</span>
        <p style={{ marginTop: 8, color: 'var(--text-muted)', fontSize: 13 }}>
          Trip Planner under development
        </p>
        <p style={{ marginTop: 4, color: 'var(--text-muted)', fontSize: 12 }}>
          Complete the Search and A-to-B features first
        </p>
      </div>
    </div>
  )
}
