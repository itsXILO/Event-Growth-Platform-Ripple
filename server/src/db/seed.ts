import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "./index";
import {
  events,
  communities,
  registrations,
  type NewEvent,
} from "./schema";

const EVENT_DATA: NewEvent = {
  slug: "nxtwave-ai-project-in-60-mins",
  title: "Build Your First AI Project in 60 Minutes",
  description:
    "Free hands-on NxtWave workshop for 6th and 7th semester BE students. Build and deploy a real AI app, get hands-on mentorship, and represent your college on the live regional growth leaderboard.",
  startsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
  capacity: 1000,
};

const COLLEGES_DATA = [
  "RV College of Engineering (RVCE)",
  "PES University (PESU)",
  "BMS College of Engineering (BMSCE)",
  "MS Ramaiah Institute of Technology (MSRIT)",
  "Dayananda Sagar College of Engineering (DSCE)",
  "Bangalore Institute of Technology (BIT)",
  "Chaitanya Bharathi Institute of Technology (CBIT)",
  "Vasavi College of Engineering (VCE)",
  "VNR Vignana Jyothi Institute of Engineering & Technology (VNR VJIET)",
  "College of Engineering Pune (COEP)",
  "Thapar Institute of Engineering and Technology (TIET)",
  "Manipal Institute of Technology (MIT)",
];

const CLUBS_DATA: { name: string; collegeName: string }[] = [
  { name: "RVCE AI & Coding Club", collegeName: "RV College of Engineering (RVCE)" },
  { name: "RVCE Google Developer Student Club", collegeName: "RV College of Engineering (RVCE)" },
  { name: "PES Open Source Community", collegeName: "PES University (PESU)" },
  { name: "PES Hackers Club", collegeName: "PES University (PESU)" },
  { name: "BMSCE Developer Student Club", collegeName: "BMS College of Engineering (BMSCE)" },
  { name: "Ramaiah AI & Robotics Society", collegeName: "MS Ramaiah Institute of Technology (MSRIT)" },
  { name: "CBIT Coders Club", collegeName: "Chaitanya Bharathi Institute of Technology (CBIT)" },
  { name: "VNR Turing AI Club", collegeName: "VNR Vignana Jyothi Institute of Engineering & Technology (VNR VJIET)" },
];

const FIRST_NAMES = [
  "Aarav", "Ananya", "Rohan", "Priya", "Aditya", "Sneha", "Vikram", "Neha",
  "Karthik", "Pooja", "Rahul", "Divya", "Siddharth", "Ishita", "Arjun", "Tanvi",
  "Nikhil", "Shreya", "Varun", "Meera", "Gautam", "Rhea", "Akash", "Anushka",
  "Harsh", "Kavya", "Sanjay", "Sanjana", "Tarun", "Bhavna", "Abhishek", "Deepika",
  "Manish", "Swati", "Pranav", "Nandini", "Kiran", "Simran", "Vikas", "Pallavi",
  "Chetan", "Aishwarya", "Yash", "Ritu", "Suraj", "Monika", "Sachin", "Preeti",
];

const LAST_NAMES = [
  "Sharma", "Rao", "Verma", "Patel", "Kulkarni", "Reddy", "Nair", "Iyer",
  "Gupta", "Deshmukh", "Hegde", "Bhat", "Joshi", "Menon", "Chopra", "Shetty",
  "Kumar", "Singh", "Pai", "Gowda", "Prasad", "Mishra", "Patil", "Kamath",
  "Choudhury", "Bose", "Mehta", "Naidu", "Sinha", "Saxena", "Agarwal", "Acharya",
];

const BRANCHES = [
  "Computer Science & Engineering",
  "Information Science & Engineering",
  "Electronics & Communication Engineering",
  "Artificial Intelligence & Data Science",
  "Electrical & Electronics Engineering",
];

function generateCode(prefix: string, index: number): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let hash = "";
  let n = index + 101;
  for (let i = 0; i < 4; i++) {
    hash += chars[n % chars.length];
    n = Math.floor(n / chars.length) + (i + 1) * 7;
  }
  return `${prefix.toUpperCase().slice(0, 3)}-${hash}`;
}

export async function seed() {
  console.log("🌱 Starting seed...");

  // 1. Ensure Event
  let [event] = await db
    .select()
    .from(events)
    .where(eq(events.slug, EVENT_DATA.slug));

  if (!event) {
    const [inserted] = await db.insert(events).values(EVENT_DATA).returning();
    event = inserted;
    console.log(` Created event: "${event.title}" (id: ${event.id})`);
  } else {
    console.log(` Event exists: "${event.title}" (id: ${event.id})`);
  }

  // 2. Ensure Colleges
  const collegeMap = new Map<string, number>();
  for (const name of COLLEGES_DATA) {
    const existing = await db
      .select()
      .from(communities)
      .where(eq(communities.name, name));

    if (existing.length > 0) {
      collegeMap.set(name, existing[0].id);
    } else {
      const [inserted] = await db
        .insert(communities)
        .values({
          name,
          type: "college",
          parentCollegeId: null,
        })
        .returning();
      collegeMap.set(name, inserted.id);
    }
  }
  console.log(` Seeded/verified ${collegeMap.size} colleges.`);

  // 3. Ensure Clubs
  const clubMap = new Map<string, number>();
  for (const club of CLUBS_DATA) {
    const parentId = collegeMap.get(club.collegeName);
    if (!parentId) continue;

    const existing = await db
      .select()
      .from(communities)
      .where(eq(communities.name, club.name));

    if (existing.length > 0) {
      clubMap.set(club.name, existing[0].id);
    } else {
      const [inserted] = await db
        .insert(communities)
        .values({
          name: club.name,
          type: "club",
          parentCollegeId: parentId,
        })
        .returning();
      clubMap.set(club.name, inserted.id);
    }
  }
  console.log(` Seeded/verified ${clubMap.size} clubs.`);

  // 4. Idempotently handle Registrations for this event
  // If registrations already exist for this event, clear them to refresh demo data cleanly
  const existingRegs = await db
    .select({ id: registrations.id })
    .from(registrations)
    .where(eq(registrations.eventId, event.id));

  if (existingRegs.length > 0) {
    console.log(` Cleaning ${existingRegs.length} existing demo registrations for idempotent re-seed...`);
    await db.delete(registrations).where(eq(registrations.eventId, event.id));
  }

  // 5. Generate ~150 Registrations with realistic distribution & referral chains
  console.log(" Generating ~150 registrations spread over past 5 days with referral chains...");

  // Distribution weights per college (RVCE, PESU, BMSCE dominate leaderboard)
  const collegeWeights = [
    { name: "RV College of Engineering (RVCE)", target: 34 },
    { name: "PES University (PESU)", target: 28 },
    { name: "BMS College of Engineering (BMSCE)", target: 23 },
    { name: "MS Ramaiah Institute of Technology (MSRIT)", target: 16 },
    { name: "Dayananda Sagar College of Engineering (DSCE)", target: 12 },
    { name: "Bangalore Institute of Technology (BIT)", target: 10 },
    { name: "Chaitanya Bharathi Institute of Technology (CBIT)", target: 8 },
    { name: "Vasavi College of Engineering (VCE)", target: 7 },
    { name: "VNR Vignana Jyothi Institute of Engineering & Technology (VNR VJIET)", target: 6 },
    { name: "College of Engineering Pune (COEP)", target: 5 },
    { name: "Thapar Institute of Engineering and Technology (TIET)", target: 4 },
    { name: "Manipal Institute of Technology (MIT)", target: 3 },
  ]; // Sum = 156 registrations

  let regGlobalIndex = 1;
  const now = Date.now();
  const DAY_MS = 24 * 60 * 60 * 1000;

  for (const cw of collegeWeights) {
    const collegeId = collegeMap.get(cw.name)!;
    const collegeClubs = CLUBS_DATA.filter((c) => c.collegeName === cw.name)
      .map((c) => clubMap.get(c.name))
      .filter((id): id is number => typeof id === "number");

    // Track registrations for this college to build realistic referral chains
    const collegeCreatedRegIds: number[] = [];

    for (let i = 0; i < cw.target; i++) {
      const fName = FIRST_NAMES[(regGlobalIndex * 7) % FIRST_NAMES.length];
      const lName = LAST_NAMES[(regGlobalIndex * 11) % LAST_NAMES.length];
      const fullName = `${fName} ${lName}`;
      const email = `${fName.toLowerCase()}.${lName.toLowerCase()}.${regGlobalIndex}@example.com`;
      const semester = regGlobalIndex % 2 === 0 ? 6 : 7;
      const branch = BRANCHES[regGlobalIndex % BRANCHES.length];
      const referralCode = generateCode(fName, regGlobalIndex);

      // Determine day offset between -5.0 and -0.1 days ago
      // Early signups (first 25%) happen on day 5 and 4 ago; subsequent signups flow from them
      const progress = i / cw.target;
      const dayOffset = 5 - progress * 4.8 - (Math.random() * 0.2);
      const createdAt = new Date(now - dayOffset * DAY_MS);

      let source: "direct" | "referral" | "club_link" = "direct";
      let communityId: number | null = null;
      let referredByRegistrationId: number | null = null;

      if (collegeCreatedRegIds.length > 0 && Math.random() < 0.42) {
        // Referral signup: referred by an earlier registrant from the same college (creating referral trees)
        source = "referral";
        // Pick one of the earlier registrants (skewed towards the top "influencers" in the college)
        const referrerIndex = Math.floor(Math.pow(Math.random(), 2) * collegeCreatedRegIds.length);
        referredByRegistrationId = collegeCreatedRegIds[referrerIndex];
      } else if (collegeClubs.length > 0 && Math.random() < 0.35) {
        // Club link signup
        source = "club_link";
        communityId = collegeClubs[regGlobalIndex % collegeClubs.length];
      } else {
        // Direct signup
        source = "direct";
      }

      const [reg] = await db
        .insert(registrations)
        .values({
          eventId: event.id,
          name: fullName,
          email,
          collegeId,
          communityId,
          semester,
          branch,
          referralCode,
          referredByRegistrationId,
          source,
          createdAt,
        })
        .returning();

      collegeCreatedRegIds.push(reg.id);
      regGlobalIndex++;
    }
  }

  // Summary counts
  const totalCount = await db
    .select({ count: registrations.id })
    .from(registrations)
    .where(eq(registrations.eventId, event.id));

  console.log(`✅ Seed finished successfully! Total registrations for demo event: ${totalCount.length}`);
}

// Allow direct CLI execution
if (process.argv[1]?.endsWith("seed.ts") || process.argv[1]?.endsWith("seed.js")) {
  seed()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("❌ Seed failed:", err);
      process.exit(1);
    });
}
