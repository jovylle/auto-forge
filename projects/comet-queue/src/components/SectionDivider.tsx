interface Props {
  label: string
}

export default function SectionDivider({ label }: Props) {
  return (
    <div className="relative flex items-center justify-center py-2" style={{ zIndex: 2 }}>
      <div style={{ position: 'absolute', left: 0, right: 0, top: '50%', borderTop: '2px solid var(--concrete)' }} />
      <span className="section-chip">{label}</span>
    </div>
  )
}