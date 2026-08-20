"use client"

import { publicInterview, wallPeople } from "../data"
import { publicRoundLabel, roundKind } from "../lib/rounds"
import DepthGlyph from "./DepthGlyph"
import WorkField from "./WorkField"

export default function ProfileWall() {
  const people = wallPeople()

  return (
    <div className="wall-scroll">
      <ul className="wall-grid">
        {people.map(person => {
          const proof = publicInterview(person)
          const kind = roundKind(proof?.round ?? "Screen")
          return (
            <li key={person.id} className="wall-card">
              <WorkField person={person} />
              <div className="wall-meta">
                <p className="type-value">{person.name}</p>
                <p className="type-label">{person.title}</p>
              </div>
              <dl className="record record-tight">
                <div className="record-row">
                  <dt className="type-label">Company</dt>
                  <dd className="type-value">{proof?.company ?? "Unlisted"}</dd>
                </div>
                <div className="record-row">
                  <dt className="type-label">Round</dt>
                  <dd className="type-value wall-round">
                    <DepthGlyph kind={kind} />
                    <span>{publicRoundLabel(proof?.round ?? "Screen")}</span>
                  </dd>
                </div>
              </dl>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
