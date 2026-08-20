export type InterviewRound = {
  company: string
  logo: string
  role: string
  type: "Full-time" | "Contract" | "Freelance" | "Internship"
  round: string
  result?: "Offer" | "Rejected" | "Withdrew" | "In Progress"
  date: string
  verified: boolean
}

export type Stage = "Sourced" | "Semifinalist" | "Finalist" | "Contacted"
export type Tier = "FINALIST" | "SEMIFINALIST"

export type Vetter = {
  id: string
  name: string
  initials: string
  color: string
  role: string
}

export type Candidate = {
  id: number
  name: string
  title: string
  disc: string
  location: string
  available: boolean
  avatar: string
  portfolioImages: string[]
  aestheticTags: string[]
  tags: string[]
  skills: string[]
  matchScore: number
  cred: number
  tier: Tier
  stage: Stage
  vch: string
  chain: [string, number][]
  vround?: string
  seed: number
  specimenH: number
  bio: string
  interviews: InterviewRound[]
  sites?: { url: string; label: string; sort: number }[]
  availability?: "open" | "conversation" | "not_looking"
  openTo?: string
}

export const VETTERS: Record<string, Vetter> = {
  maya: { id: "maya", name: "Maya Okonkwo", initials: "MO", color: "#9c2f4d", role: "Brand lead, ex-Pentagram" },
  devin: { id: "devin", name: "Devin Park", initials: "DP", color: "#2f3a44", role: "Design director" },
  rosa: { id: "rosa", name: "Rosa Iglesias", initials: "RI", color: "#3f5148", role: "Creative director" },
  theo: { id: "theo", name: "Theo Lund", initials: "TL", color: "#4a3f52", role: "Film and motion lead" },
}

export const STAGES: Stage[] = ["Sourced", "Semifinalist", "Finalist", "Contacted"]

export const AESTHETIC_FILTERS = [
  "All", "editorial", "warm", "minimal", "brutalist", "playful", "cinematic", "systems", "bold",
]

export const TAGSET = ["editorial", "warm", "minimal", "brutalist", "playful", "cinematic", "systems", "bold"]

export const candidates: Candidate[] = [
  {
    id: 1,
    name: "Maya Okonkwo",
    title: "Senior Brand Designer",
    disc: "Brand Design",
    location: "Berlin, DE",
    available: true,
    avatar: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=120&h=120&fit=crop&auto=format",
    portfolioImages: [
      "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&auto=format",
      "https://images.unsplash.com/photo-1634926878768-2a5b3c42f139?w=600&auto=format",
      "https://images.unsplash.com/photo-1561070791-2526d30994b5?w=600&auto=format",
    ],
    aestheticTags: ["Swiss Grid", "Editorial", "Dark Minimalist"],
    tags: ["editorial", "warm", "serif", "identity", "systems"],
    skills: ["Brand Identity", "Motion Design", "Figma", "After Effects", "Typography"],
    matchScore: 97,
    cred: 0.92,
    tier: "FINALIST",
    stage: "Contacted",
    vch: "devin",
    chain: [["devin", 1.0], ["rosa", 0.7]],
    vround: "Final round, Figma",
    seed: 1 * 97 + 7,
    specimenH: 300,
    bio: "Identity systems with an editorial backbone. Type-led, warm palettes, print thinking carried into screen. I reduce things to their most essential form.",
    interviews: [
      { company: "Figma", logo: "F", role: "Staff Brand Designer", type: "Full-time", round: "Final Round (4/4)", result: "Offer", date: "Mar 2024", verified: true },
      { company: "Linear", logo: "L", role: "Lead Designer", type: "Full-time", round: "Take-home (2/4)", result: "Withdrew", date: "Jan 2024", verified: true },
      { company: "Vercel", logo: "▲", role: "Design Engineer", type: "Full-time", round: "Portfolio Review (1/4)", result: "Rejected", date: "Nov 2023", verified: false },
    ],
  },
  {
    id: 2,
    name: "Sol Reyes",
    title: "Product Designer",
    disc: "Product Design",
    location: "Mexico City, MX",
    available: true,
    avatar: "https://images.unsplash.com/photo-1607746882042-944635dfe10e?w=120&h=120&fit=crop&auto=format",
    portfolioImages: [
      "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format",
      "https://images.unsplash.com/photo-1541701494587-cb58502866ab?w=600&auto=format",
    ],
    aestheticTags: ["Memphis", "Kinetic Type"],
    tags: ["playful", "color", "bold", "systems"],
    skills: ["Product Design", "User Research", "Prototyping", "React", "Design Systems"],
    matchScore: 91,
    cred: 0.86,
    tier: "FINALIST",
    stage: "Finalist",
    vch: "rosa",
    chain: [["rosa", 1.0], ["maya", 0.55]],
    seed: 2 * 97 + 7,
    specimenH: 360,
    bio: "Colour and motion as communication. I design systems that feel alive, drawing from 80s European print culture.",
    interviews: [
      { company: "Notion", logo: "N", role: "Product Designer", type: "Full-time", round: "Final Round (4/4)", result: "Offer", date: "Feb 2024", verified: true },
      { company: "Loom", logo: "◉", role: "Senior Designer", type: "Full-time", round: "Final Round (4/4)", result: "Offer", date: "Dec 2023", verified: true },
    ],
  },
  {
    id: 3,
    name: "Kenji Mori",
    title: "UX Engineer",
    disc: "Product Design",
    location: "Tokyo, JP",
    available: false,
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&h=120&fit=crop&auto=format",
    portfolioImages: [
      "https://images.unsplash.com/photo-1487017159836-4e23ece2e4cf?w=600&auto=format",
      "https://images.unsplash.com/photo-1555099962-4199c345e5dd?w=600&auto=format",
      "https://images.unsplash.com/photo-1523726491678-bf852e717f6a?w=600&auto=format",
    ],
    aestheticTags: ["Dark Minimalist", "Glassmorphism"],
    tags: ["minimal", "systems", "fintech", "clean"],
    skills: ["TypeScript", "Framer Motion", "Three.js", "WebGL", "CSS Architecture"],
    matchScore: 88,
    cred: 0.71,
    tier: "SEMIFINALIST",
    stage: "Sourced",
    vch: "theo",
    chain: [["theo", 1.0]],
    seed: 3 * 97 + 7,
    specimenH: 250,
    bio: "The boundary between design and engineering is where the most interesting work lives. I prototype in code, not static frames.",
    interviews: [
      { company: "Apple", logo: "", role: "UI Engineer", type: "Full-time", round: "Panel Interview (3/5)", result: "Rejected", date: "Apr 2024", verified: true },
      { company: "Arc", logo: "A", role: "Design Engineer", type: "Full-time", round: "Final Round (4/4)", result: "In Progress", date: "May 2024", verified: false },
    ],
  },
  {
    id: 4,
    name: "Zara Patel",
    title: "Visual Designer",
    disc: "Graphic Design",
    location: "London, UK",
    available: true,
    avatar: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=120&h=120&fit=crop&auto=format",
    portfolioImages: [
      "https://images.unsplash.com/photo-1541701494587-cb58502866ab?w=600&auto=format",
      "https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=600&auto=format",
    ],
    aestheticTags: ["Neubrutalism", "Editorial"],
    tags: ["brutalist", "bold", "poster", "playful"],
    skills: ["Visual Design", "Illustration", "Webflow", "Branding", "Print Design"],
    matchScore: 84,
    cred: 0.64,
    tier: "SEMIFINALIST",
    stage: "Semifinalist",
    vch: "rosa",
    chain: [["rosa", 1.0]],
    seed: 4 * 97 + 7,
    specimenH: 330,
    bio: "Poster brain graphic design. Loud grids, confident type, a brutalist streak that still sells. Digital design is ready to get loud again.",
    interviews: [
      { company: "Pitch", logo: "P", role: "Visual Designer", type: "Full-time", round: "Final Round (4/4)", result: "Offer", date: "Jan 2024", verified: true },
      { company: "Readymag", logo: "R", role: "Product Designer", type: "Full-time", round: "Portfolio Review (1/3)", result: "Rejected", date: "Oct 2023", verified: true },
    ],
  },
  {
    id: 5,
    name: "Tobias Holm",
    title: "Motion Designer",
    disc: "Cinematography",
    location: "Copenhagen, DK",
    available: true,
    avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=120&h=120&fit=crop&auto=format",
    portfolioImages: [
      "https://images.unsplash.com/photo-1557672172-298e090bd0f1?w=600&auto=format",
      "https://images.unsplash.com/photo-1504868584819-f8e8b4b6d7e3?w=600&auto=format",
      "https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?w=600&auto=format",
    ],
    aestheticTags: ["Kinetic Type", "Retro Futurist"],
    tags: ["cinematic", "warm", "motion", "film"],
    skills: ["After Effects", "Cinema 4D", "Rive", "Lottie", "Brand Motion"],
    matchScore: 79,
    cred: 0.80,
    tier: "FINALIST",
    stage: "Finalist",
    vch: "theo",
    chain: [["theo", 1.0], ["maya", 0.5]],
    seed: 5 * 97 + 7,
    specimenH: 270,
    bio: "Time is the medium. Documentary-leaning commercial work. Warm, human, unhurried framing — rhythm, tempo, and surprise as design elements.",
    interviews: [
      { company: "Spotify", logo: "S", role: "Motion Designer", type: "Full-time", round: "Creative Challenge (2/4)", result: "Rejected", date: "Mar 2024", verified: true },
      { company: "Adobe", logo: "Ad", role: "Senior Motion", type: "Full-time", round: "Final Round (4/4)", result: "Offer", date: "Feb 2024", verified: true },
    ],
  },
  {
    id: 6,
    name: "Amara Diallo",
    title: "Design Systems Lead",
    disc: "Product Design",
    location: "Amsterdam, NL",
    available: true,
    avatar: "https://images.unsplash.com/photo-1489424731084-a5d8b219a5bb?w=120&h=120&fit=crop&auto=format",
    portfolioImages: [
      "https://images.unsplash.com/photo-1509395062183-a6ef63fd2f51?w=600&auto=format",
      "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&auto=format",
      "https://images.unsplash.com/photo-1515378960530-7c0da6231fb1?w=600&auto=format",
    ],
    aestheticTags: ["Swiss Grid", "Dark Minimalist"],
    tags: ["systems", "clean", "b2b", "minimal"],
    skills: ["Design Systems", "Tokens Studio", "Storybook", "React", "Documentation"],
    matchScore: 94,
    cred: 0.88,
    tier: "FINALIST",
    stage: "Finalist",
    vch: "maya",
    chain: [["maya", 1.0], ["devin", 0.65]],
    vround: "Final round, Linear",
    seed: 6 * 97 + 7,
    specimenH: 280,
    bio: "B2B design systems and complex flows. Systems thinking as design practice. The person you want when the product is unglamorous but hard.",
    interviews: [
      { company: "Shopify", logo: "Sh", role: "Design Systems Lead", type: "Full-time", round: "Final Round (5/5)", result: "Offer", date: "Apr 2024", verified: true },
      { company: "GitHub", logo: "Gh", role: "Principal Designer", type: "Full-time", round: "Final Round (5/5)", result: "Offer", date: "Mar 2024", verified: true },
      { company: "Stripe", logo: "St", role: "Design Lead", type: "Full-time", round: "System Design (3/5)", result: "Rejected", date: "Jan 2024", verified: true },
    ],
  },
  {
    id: 7,
    name: "Ada Ferreira",
    title: "Brand Designer",
    disc: "Brand Design",
    location: "Lisbon, PT",
    available: true,
    avatar: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=120&h=120&fit=crop&auto=format",
    portfolioImages: [
      "https://images.unsplash.com/photo-1503602642458-232111445657?w=600&auto=format",
      "https://images.unsplash.com/photo-1494438639946-1ebd1d2565cf?w=600&auto=format",
    ],
    aestheticTags: ["Editorial", "Swiss Grid"],
    tags: ["editorial", "warm", "serif", "identity"],
    skills: ["Identity", "Type", "Print", "Packaging"],
    matchScore: 90,
    cred: 0.83,
    tier: "FINALIST",
    stage: "Finalist",
    vch: "maya",
    chain: [["maya", 1.0], ["rosa", 0.6]],
    seed: 7 * 97 + 7,
    specimenH: 290,
    bio: "Identity systems with an editorial backbone. Type-led, warm palettes, print thinking carried into screen.",
    interviews: [
      { company: "Stripe", logo: "St", role: "Brand Designer", type: "Full-time", round: "Final Round (4/4)", result: "Offer", date: "Feb 2024", verified: true },
    ],
  },
  {
    id: 8,
    name: "Priya Nair",
    title: "Cinematographer",
    disc: "Cinematography",
    location: "Mumbai, IN",
    available: true,
    avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=120&h=120&fit=crop&auto=format",
    portfolioImages: [
      "https://images.unsplash.com/photo-1485846234645-a62644f84728?w=600&auto=format",
    ],
    aestheticTags: ["Kinetic Type"],
    tags: ["film", "moody", "ads", "cinematic"],
    skills: ["Cinematography", "Color", "Commercial", "Short Form"],
    matchScore: 76,
    cred: 0.71,
    tier: "SEMIFINALIST",
    stage: "Sourced",
    vch: "theo",
    chain: [["theo", 1.0]],
    seed: 8 * 97 + 7,
    specimenH: 250,
    bio: "Ad and short form cinematography. Available light, slow push ins, a moody hand with color.",
    interviews: [
      { company: "Apple", logo: "", role: "Director of Photography", type: "Contract", round: "Creative Review (2/3)", result: "In Progress", date: "May 2024", verified: false },
    ],
  },
  {
    id: 9,
    name: "Noah Weiss",
    title: "Product Designer",
    disc: "Product Design",
    location: "New York, US",
    available: true,
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&h=120&fit=crop&auto=format",
    portfolioImages: [
      "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600&auto=format",
      "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=600&auto=format",
    ],
    aestheticTags: ["Dark Minimalist", "Swiss Grid"],
    tags: ["systems", "clean", "b2b", "minimal"],
    skills: ["Product Design", "Design Systems", "B2B", "Prototyping"],
    matchScore: 93,
    cred: 0.88,
    tier: "FINALIST",
    stage: "Finalist",
    vch: "maya",
    chain: [["maya", 1.0], ["devin", 0.65]],
    vround: "Final round, Linear",
    seed: 9 * 97 + 7,
    specimenH: 280,
    bio: "B2B design systems and complex flows. The person you want when the product is unglamorous but hard.",
    interviews: [
      { company: "Linear", logo: "L", role: "Product Designer", type: "Full-time", round: "Final Round (4/4)", result: "Offer", date: "Apr 2024", verified: true },
    ],
  },
  {
    id: 10,
    name: "Marco Bianchi",
    title: "Graphic Designer",
    disc: "Graphic Design",
    location: "Milan, IT",
    available: true,
    avatar: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=120&h=120&fit=crop&auto=format",
    portfolioImages: [
      "https://images.unsplash.com/photo-1561070791-2526d30994b5?w=600&auto=format",
    ],
    aestheticTags: ["Neubrutalism", "Memphis"],
    tags: ["brutalist", "bold", "poster", "playful"],
    skills: ["Poster", "Type", "Campaign", "Print"],
    matchScore: 72,
    cred: 0.64,
    tier: "SEMIFINALIST",
    stage: "Semifinalist",
    vch: "rosa",
    chain: [["rosa", 1.0]],
    seed: 10 * 97 + 7,
    specimenH: 310,
    bio: "Poster brain graphic design. Loud grids, confident type, a brutalist streak that still sells.",
    interviews: [
      { company: "Pentagram", logo: "P", role: "Graphic Designer", type: "Full-time", round: "Portfolio Review (1/3)", result: "Rejected", date: "Jan 2024", verified: true },
    ],
  },
]

const liveById = new Map<number, Candidate>()

export function registerLive(person: Candidate) {
  liveById.set(person.id, person)
}

export function clearLive() {
  liveById.clear()
}

export function livePeople() {
  return [...liveById.values()]
}

export function wallPeople() {
  const live = livePeople().filter(c => c.portfolioImages.length > 0 || (c.sites?.length ?? 0) > 0)
  const demo = candidates.filter(c => !liveById.has(c.id))
  return [...live, ...demo]
}

export function getCandidate(id: number) {
  return liveById.get(id) ?? candidates.find(c => c.id === id) ?? candidates[0]
}

export function publicInterview(c: Candidate) {
  return c.interviews.find(i => i.verified) ?? c.interviews[0]
}
