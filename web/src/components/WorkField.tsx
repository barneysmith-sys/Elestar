import type { Candidate } from "../data"

export default function WorkField({
  person,
}: {
  person: Candidate
}) {
  const src = person.portfolioImages[0]
  const label = `${person.name}, work`

  return (
    <div className="work-field">
      {src ? (
        <img className="work-field-img" src={src} alt={label} />
      ) : (
        <div className="work-field-grain" aria-hidden="true" />
      )}
    </div>
  )
}
