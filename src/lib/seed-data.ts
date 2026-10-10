// Demo seed: the phone-call transcripts from "Aangan_Sep 2026_Enquiries.pdf" (Case 03),
// condensed into structured inputs. These were handled by the human front desk. In the app
// they are replayed through the AI qualification engine and always labelled as demo data.
// T08 (missed call, no details) and the dropped first half of T17 are omitted.

import type { CallInput, Outcome } from "./types";

export interface SeedCall {
  reference: string;
  /** IST timestamp of the original call. */
  at: string;
  input: CallInput;
  transcript: string;
  /** What the engine is expected to decide (verified in tests). */
  expected: Outcome;
}

const ist = (d: string) => `${d}+05:30`;

export const SEED_CALLS: SeedCall[] = [
  {
    reference: "T01",
    at: ist("2026-09-02T10:23:00"),
    expected: "qualified",
    transcript: "Referral from Shruti Joshi. 3BHK in Kothrud (Dahanukar Colony), ~1,400 sq ft carpet, still a builder flat. Wants kitchen, living room, both bedrooms redone. Done by March, no rush. Owner with husband, who is on board.",
    input: { caller_name: "Priya", caller_type: "new_enquiry", project_type: "residential_full", area_sqft: 1400, location: "Kothrud, Dahanukar Colony", timeline_kind: "flexible", timeline_text: "Done by March, no rush", decision_maker: "yes", duration_sec: 252 },
  },
  {
    reference: "T02",
    at: ist("2026-09-03T14:41:00"),
    expected: "qualified",
    transcript: "Saw work on Instagram. 2BHK in Wakad, ~950 sq ft. Full redesign: modular kitchen, wardrobes, living room, both bedrooms. Moving in late November, design from October. Asked twice for a rough price / range.",
    input: { caller_name: null, caller_type: "new_enquiry", project_type: "residential_full", area_sqft: 950, location: "Wakad", timeline_kind: "deadline", deadline_weeks: 12, timeline_text: "Move in by end of November", decision_maker: "unknown", pricing_asked: true, duration_sec: 308 },
  },
  {
    reference: "T03",
    at: ist("2026-09-03T16:15:00"),
    expected: "unqualified",
    transcript: "Saw work on LinkedIn. Based in Nashik; wants home office and study redone. Asked if a smaller project outside Pune is possible.",
    input: { caller_name: "Suresh Patil", caller_type: "new_enquiry", project_type: "residential_partial", location: "Nashik", timeline_kind: "unknown", decision_maker: "yes", duration_sec: 160 },
  },
  {
    reference: "T04",
    at: ist("2026-09-04T11:07:00"),
    expected: "unqualified",
    transcript: "Wants someone to visit and give ideas for the living room: colours, furniture arrangement. Not planning a full project, just exploring.",
    input: { caller_name: null, caller_type: "new_enquiry", project_type: "advice_only", timeline_kind: "unknown", decision_maker: "unknown", duration_sec: 202 },
  },
  {
    reference: "T05",
    at: ist("2026-09-05T10:52:00"),
    expected: "qualified",
    transcript: "Referred by Vikram Agarwal (friend of Nikhil). 4BHK in Koregaon Park, ~2,400 sq ft carpet. Complete redesign: flooring, kitchen, all four bedrooms. Already moved out. Wants to move back by February. Prefers a site visit.",
    input: { caller_name: "Aarti Mehta", caller_type: "new_enquiry", project_type: "residential_full", area_sqft: 2400, location: "Koregaon Park", timeline_kind: "deadline", deadline_weeks: 21, timeline_text: "Move back in by February", decision_maker: "yes", duration_sec: 404 },
  },
  {
    reference: "T06",
    at: ist("2026-09-05T15:28:00"),
    expected: "qualified",
    transcript: "Startup founder. First office in Baner, ~800 sq ft bare shell. Workstations for 20, a cabin, a meeting room, a break area. Operational by December.",
    input: { caller_name: null, caller_type: "new_enquiry", project_type: "commercial_office", area_sqft: 800, location: "Baner", timeline_kind: "deadline", deadline_weeks: 13, timeline_text: "Operational by December", decision_maker: "yes", duration_sec: 301 },
  },
  {
    reference: "T07",
    at: ist("2026-09-08T09:44:00"),
    expected: "unqualified",
    transcript: "Wants living room and kitchen redone before Diwali (~3 weeks away). Asked about doing just the living room. Will think about starting after Diwali.",
    input: { caller_name: null, caller_type: "new_enquiry", project_type: "residential_partial", timeline_kind: "deadline", deadline_weeks: 3, timeline_text: "Before Diwali (~3 weeks)", decision_maker: "unknown", duration_sec: 195 },
  },
  {
    reference: "T09",
    at: ist("2026-09-10T11:32:00"),
    expected: "needs_human_review",
    transcript: "Existing client. Project running for three months; designer Aryan hasn't replied in five days despite three messages and two calls. 'This is not acceptable.' Wants a callback from Nikhil or a senior person.",
    input: {
      caller_name: "Sheetal Deshpande",
      caller_type: "existing_client",
      project_type: "residential_full",
      location: "Viman Nagar",
      timeline_kind: "unknown",
      decision_maker: "yes",
      urgent_human_request: true,
      notes: "My project has been going for three months and my designer (Aryan) hasn't replied in five days. Sent three messages, called twice. This is not acceptable. Wants a callback from Nikhil or a senior person.",
      duration_sec: 352,
    },
  },
  {
    reference: "T10",
    at: ist("2026-09-11T14:04:00"),
    expected: "unqualified",
    transcript: "1BHK in Kharadi, ~550 sq ft. Kitchen and one bedroom. Volunteered a budget of 1 to 1.5 lakh maximum for everything.",
    input: { caller_name: null, caller_type: "new_enquiry", project_type: "residential_partial", area_sqft: 550, location: "Kharadi", timeline_kind: "unknown", budget_text: "1 to 1.5 lakh maximum", decision_maker: "yes", duration_sec: 220 },
  },
  {
    reference: "T11",
    at: ist("2026-09-12T10:18:00"),
    expected: "needs_follow_up",
    transcript: "Rented 2BHK in Baner, 3-year lease, landlord fine with no wall-breaking. Living room, bedroom, kitchen. Design and fittings, no structural changes. Timeline never captured.",
    input: { caller_name: null, caller_type: "new_enquiry", project_type: "residential_partial", location: "Baner", timeline_kind: "unknown", decision_maker: "yes", notes: "Rented apartment, landlord approves, no structural changes.", duration_sec: 382 },
  },
  {
    reference: "T12",
    at: ist("2026-09-15T10:05:00"),
    expected: "qualified",
    transcript: "Villa in Kalyani Nagar, ~5,500 sq ft, ground + two floors, new construction, possession last month. Full end-to-end design. Move in March next year. Wants principal designer site visit.",
    input: { caller_name: "Anand Sharma", caller_type: "new_enquiry", project_type: "residential_full", area_sqft: 5500, location: "Kalyani Nagar", timeline_kind: "flexible", timeline_text: "Move in March next year, no rush", decision_maker: "yes", duration_sec: 450 },
  },
  {
    reference: "T13",
    at: ist("2026-09-16T12:19:00"),
    expected: "needs_follow_up",
    transcript: "3BHK in Aundh, ~1,100 sq ft. Kitchen, wardrobes in both bedrooms, living room. Pushed repeatedly for a rough price range. Timeline never captured.",
    input: { caller_name: null, caller_type: "new_enquiry", project_type: "residential_partial", area_sqft: 1100, location: "Aundh", timeline_kind: "unknown", decision_maker: "unknown", pricing_asked: true, duration_sec: 368 },
  },
  {
    reference: "T14",
    at: ist("2026-09-17T11:41:00"),
    expected: "needs_follow_up",
    transcript: "Son calling for parents' new-possession 3BHK in Hadapsar. Parents will attend the consultation and decide. Timeline never captured.",
    input: { caller_name: null, caller_type: "new_enquiry", project_type: "residential_full", location: "Hadapsar", timeline_kind: "unknown", decision_maker: "authorised_representative", notes: "Caller is son; owners are parents, who will attend the consultation and decide.", duration_sec: 295 },
  },
  {
    reference: "T15",
    at: ist("2026-09-18T15:12:00"),
    expected: "qualified",
    transcript: "Possession of 2BHK in Undri (875 sq ft) in about six weeks. Full home: kitchen, wardrobes, living room. Wants to start design now; builder allows site access. Husband said to go ahead.",
    input: { caller_name: "Smita", caller_type: "new_enquiry", project_type: "residential_full", area_sqft: 875, location: "Undri", timeline_kind: "flexible", timeline_text: "Possession in ~6 weeks; start design now", decision_maker: "yes", duration_sec: 344 },
  },
  {
    reference: "T16",
    at: ist("2026-09-19T10:38:00"),
    expected: "needs_human_review",
    transcript: "Called Monday about a 3BHK in Viman Nagar; nobody got back to him for two days and no note was logged. Frustrated: 'not a good sign if you forget before you even start.'",
    input: { caller_name: "Girish Nair", caller_type: "new_enquiry", project_type: "residential_full", location: "Viman Nagar", timeline_kind: "unknown", decision_maker: "yes", notes: "Called on Monday and gave my number, no one got back to me in two days. Caller frustrated, handle with care.", duration_sec: 318 },
  },
  {
    reference: "T17",
    at: ist("2026-09-22T14:16:00"),
    expected: "qualified",
    transcript: "Called back after a dropped line. 3BHK in Pimple Saudagar, ~1,050 sq ft, moved in two years ago with builder furniture. Kitchen, wardrobes, living room. Ideally done by March.",
    input: { caller_name: "Ritu Kapoor", caller_type: "new_enquiry", project_type: "residential_partial", area_sqft: 1050, location: "Pimple Saudagar", timeline_kind: "flexible", timeline_text: "Ideally done by March", decision_maker: "unknown", duration_sec: 270 },
  },
  {
    reference: "T18",
    at: ist("2026-09-23T11:55:00"),
    expected: "unqualified",
    transcript: "Runs a small coworking space; wants a 180 sq ft pod to look nice: lighting, a desk, storage.",
    input: { caller_name: null, caller_type: "new_enquiry", project_type: "commercial_studio", area_sqft: 180, timeline_kind: "unknown", decision_maker: "yes", duration_sec: 182 },
  },
  {
    reference: "T19",
    at: ist("2026-09-24T16:02:00"),
    expected: "unqualified",
    transcript: "Planning to open a restaurant in Koregaon Park; loves the studio's work and asked for interior design.",
    input: { caller_name: null, caller_type: "new_enquiry", project_type: "restaurant", location: "Koregaon Park", timeline_kind: "unknown", decision_maker: "yes", duration_sec: 170 },
  },
  {
    reference: "T20",
    at: ist("2026-09-25T09:15:00"),
    expected: "qualified",
    transcript: "2BHK in Magarpatta (Cybercity), ~900 sq ft. Kitchen, both bedrooms, living room. Flexible; January execution start ideal. Both owners will attend the consultation.",
    input: { caller_name: "Pooja", caller_type: "new_enquiry", project_type: "residential_full", area_sqft: 900, location: "Magarpatta", timeline_kind: "flexible", timeline_text: "Flexible, January execution start", decision_maker: "yes", duration_sec: 284 },
  },
];
