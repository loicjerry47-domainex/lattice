/* The Lattice — dataset
 * A synthetic but plausible set of handshakes spanning ~4000 years.
 * Each handshake is a relationship event between two nodes at a moment.
 * Domains map to longitude (0..360). Time maps to latitude.
 */

(function(){
  "use strict";

  // ---------- Domains (longitudinal bands) ----------
  // 8 domains, evenly spaced. Each is a "meridian" on the sphere.
  const DOMAINS = [
    { key:"greeting",    label:"Greeting",         hue: 0  }, // pure hello
    { key:"alliance",    label:"Alliance",         hue: 45 }, // treaties, contracts
    { key:"intimacy",    label:"Intimacy",         hue: 90 }, // love, kin
    { key:"exchange",    label:"Exchange",         hue: 135}, // trade, gift
    { key:"creation",    label:"Creation",         hue: 180}, // collaborator meets collaborator
    { key:"machine",     label:"Machine",          hue: 225}, // tcp, api, protocol
    { key:"farewell",    label:"Farewell",         hue: 270}, // goodbye, last meetings
    { key:"crossing",    label:"Crossing",         hue: 315}, // strangers, brief encounters
  ];

  // ---------- Time range ----------
  // Latitude mapping: -80° (past-most) → +80° (future-most)
  // Now = 0°. We go ~-2000 BCE to ~+2200 CE.
  const NOW_YEAR = 2026;
  const MIN_YEAR = -2000;
  const MAX_YEAR = 2200;

  function yearToLat(year){
    // compress past more than future (past is denser)
    if (year <= NOW_YEAR){
      const t = (NOW_YEAR - year) / (NOW_YEAR - MIN_YEAR); // 0..1
      // ease so distant past crowds near pole
      return -80 * Math.pow(t, 0.75);
    } else {
      const t = (year - NOW_YEAR) / (MAX_YEAR - NOW_YEAR);
      return 80 * Math.pow(t, 0.9);
    }
  }

  function domainToLon(domainKey, jitter){
    const d = DOMAINS.find(x=>x.key===domainKey);
    const base = d.hue;
    return base + (jitter ?? 0);
  }

  // ---------- Seed handshakes — hand-authored anchors ----------
  // These are the "bright spots" — plausible, archetypal, with real texture.
  const ANCHORS = [
    // --- deep past
    { year:-1750, a:"Hammurabi", b:"a scribe of Susa", domain:"alliance", weight:0.9,
      note:"A codified law passes from ruler to witness. The handshake is an oath.",
      frames:{
        transactional:"A tablet, a seal, a name pressed into clay.",
        relational:"Sovereign and servant. The servant outlives the law.",
        narrative:"The first moment a promise could be held in the hand.",
        systemic:"A new kind of handshake is invented: the one that binds strangers.",
        emotional:"Pride on one side. On the other: the slow weight of what has just become permanent."
      }},
    { year:-490, a:"Pheidippides", b:"the Athenian assembly", domain:"greeting", weight:0.85,
      note:"He arrives. He says one word. He dies.",
      frames:{
        transactional:"News of victory, delivered at the cost of breath.",
        relational:"One man to a city. Asymmetric past bearing.",
        narrative:"The shape of every courier that will follow for 2,500 years.",
        systemic:"The first hello-world where the medium was a body.",
        emotional:"Triumph, exhaustion, release — compressed into a single syllable."
      }},
    { year:1271, a:"Marco Polo", b:"Kublai Khan", domain:"crossing", weight:0.7,
      note:"A Venetian boy bows before an empire he did not invent words for.",
      frames:{
        transactional:"Curiosity traded for safe passage.",
        relational:"Two worlds agreeing, briefly, to share a room.",
        narrative:"Travel writing is born in the gap between their languages.",
        systemic:"A hairline fracture opens in the wall between East and West.",
        emotional:"Wonder, on both sides, quietly hidden under protocol."
      }},
    { year:1492, a:"Taíno elder", b:"Columbus's landing party", domain:"crossing", weight:0.95,
      note:"A handshake whose consequences neither party could see.",
      frames:{
        transactional:"Gifts exchanged. The asymmetry is in what will follow.",
        relational:"Hosts and guests, for about an hour.",
        narrative:"A world ends. Another begins. Neither knows yet.",
        systemic:"The densest load-bearing handshake in this hemisphere's lattice.",
        emotional:"Caution, curiosity, courtesy. No fear yet. The fear comes later."
      }},
    { year:1609, a:"Galileo", b:"the night sky", domain:"creation", weight:0.6,
      note:"A lens points up for the first time with intent.",
      frames:{
        transactional:"Photons, four hundred years old, meet a glass surface ground by hand.",
        relational:"One of the rare handshakes between a mind and a universe.",
        narrative:"The moment the telescope became a telescope.",
        systemic:"Reshapes every future handshake between humans and the cosmos.",
        emotional:"Something like falling. Something like waking up."
      }},
    { year:1776, a:"Jefferson", b:"Franklin", domain:"creation", weight:0.7,
      note:"Two men revising each other's sentences.",
      frames:{
        transactional:"A paragraph. A comma. A radical idea softened by an elder hand.",
        relational:"Mentor and insurgent, quietly respectful.",
        narrative:"Half of a nation's voice is shaped in a room that no longer exists.",
        systemic:"A handshake that will echo in every legal document for centuries.",
        emotional:"Impatience on one side. Warmth on the other. Both hiding exhaustion."
      }},
    { year:1876, a:"Alexander Graham Bell", b:"Thomas Watson", domain:"machine", weight:0.85,
      note:"The first handshake across a wire.",
      frames:{
        transactional:"Seven words. Transmitted. Received.",
        relational:"Inventor and assistant, suddenly equal in the instant of the transmission.",
        narrative:"Distance begins its long slow collapse.",
        systemic:"Every phone call since rhymes with this one.",
        emotional:"Disbelief, then joy, then the urge to do it again immediately."
      }},
    { year:1903, a:"Wilbur Wright", b:"Orville Wright", domain:"creation", weight:0.7,
      note:"A brotherly hand on a shoulder before 12 seconds of flight.",
      frames:{
        transactional:"Trust passed silently. One brother rides. The other runs alongside.",
        relational:"The densest sibling handshake in aviation history.",
        narrative:"Every future flight is underwritten by this one gesture.",
        systemic:"Two bicycle makers become a whole industry.",
        emotional:"A shared silence that neither would be able to describe later."
      }},
    { year:1945, a:"Soviet soldier", b:"American soldier", domain:"alliance", weight:0.8,
      note:"At the Elbe River. Laughing. Exhausted. Unable to speak each other's language.",
      frames:{
        transactional:"Cigarettes, photos, a bottle.",
        relational:"Two armies touching for the first time through two men.",
        narrative:"The war in Europe has a gesture now. This is it.",
        systemic:"A seam in the map that will harden into a curtain.",
        emotional:"Joy on the surface. Something colder underneath, that neither man has a name for yet."
      }},
    { year:1969, a:"Neil Armstrong", b:"lunar regolith", domain:"crossing", weight:0.9,
      note:"A boot meets dust that has not been touched in 4.5 billion years.",
      frames:{
        transactional:"A footprint. A sample bag. A transmission home.",
        relational:"A species reaching out of its crib.",
        narrative:"For one hour, every television on Earth was the same television.",
        systemic:"The handshake that proved the lattice extends beyond this planet.",
        emotional:"Calm. Almost clerical. The weight of it arrives later, in other people."
      }},
    { year:1969, a:"UCLA host", b:"SRI host", domain:"machine", weight:0.88,
      note:"LOGIN — and the system crashes after two letters. LO. The first word the internet ever said.",
      frames:{
        transactional:"Two letters. A crash. A retry.",
        relational:"Two machines that did not know each other's names.",
        narrative:"Every packet since has been a descendant of these two characters.",
        systemic:"The founding handshake of the network age.",
        emotional:"Not felt by the machines. Felt, faintly, by the humans watching."
      }},
    { year:1989, a:"a man at Checkpoint Charlie", b:"a woman on the other side", domain:"farewell", weight:0.7,
      note:"A goodbye disguised as a hello. Or the reverse. History hasn't decided.",
      frames:{
        transactional:"Nothing, materially. Everything, otherwise.",
        relational:"Strangers to each other. Kin to the moment.",
        narrative:"An accidental icon of a wall that was, itself, an accident.",
        systemic:"A lattice-wide ripple: thousands of deferred handshakes suddenly possible.",
        emotional:"Tears on both sides before either of them understood why."
      }},
    { year:1991, a:"Tim Berners-Lee", b:"the first server he talked to", domain:"machine", weight:0.8,
      note:"A document requests itself into existence.",
      frames:{
        transactional:"An HTTP GET, replied to in milliseconds.",
        relational:"Author and audience fused into the same moment.",
        narrative:"The quietest revolution of the century begins with a 200 OK.",
        systemic:"Makes possible every hello-world that comes after.",
        emotional:"Private elation. He tells almost no one for weeks."
      }},

    // --- present-ish
    { year:2008, a:"a user", b:"their first iPhone", domain:"machine", weight:0.55,
      note:"A glass slab meets a thumb. Both are changed.",
      frames:{
        transactional:"A swipe. An animation. A small delight.",
        relational:"Intimate from the first second. This one is different.",
        narrative:"The pocket becomes a portal.",
        systemic:"Billions of handshakes per second will now flow through glass.",
        emotional:"A quiet thrill that most users can't articulate, but never forget."
      }},
    { year:2015, a:"a stranger", b:"another stranger", domain:"intimacy", weight:0.45,
      note:"A photo swiped right. A message. A coffee. A life.",
      frames:{
        transactional:"An algorithm, a notification, a decision made in 0.3s.",
        relational:"The handshake that almost didn't happen, happening anyway.",
        narrative:"One of ten million such stories happening this year.",
        systemic:"A new way the lattice can surprise itself.",
        emotional:"Nervousness shading into something like relief."
      }},
    { year:2020, a:"a grandmother", b:"her grandson", domain:"farewell", weight:0.75,
      note:"A window. A phone. Gloved hands against glass.",
      frames:{
        transactional:"No touch. A photograph, later. A voicemail saved.",
        relational:"The most asymmetric farewell: one knows, one will not remember.",
        narrative:"Millions of families learn a new shape of goodbye this year.",
        systemic:"The lattice thins in a million small places at once.",
        emotional:"Grief, deferred. It arrives in the grocery store, months later."
      }},
    { year:2022, a:"a person", b:"a model", domain:"machine", weight:0.9,
      note:"The first time a human asks a language model a real question and trusts the answer.",
      frames:{
        transactional:"A prompt. A completion. A pause before the second question.",
        relational:"A new kind of node enters the lattice. It will be controversial.",
        narrative:"Every future handshake between humans and models is set up here.",
        systemic:"The lattice grows a new limb. Not everyone agrees it belongs.",
        emotional:"Unease and delight, in equal parts, within the same minute."
      }},

    // --- the future
    { year:2028, a:"two researchers", b:"(different continents)", domain:"creation", weight:0.5, future:true,
      note:"A paper co-authored by people who will not meet in person until the funeral of a third.",
      frames:{
        transactional:"Shared doc. 847 suggestions accepted. 12 declined.",
        relational:"Closer than most marriages. Never in the same room.",
        narrative:"A new shape of collaboration that the 20th century did not have a word for.",
        systemic:"The latency of genius drops to near zero.",
        emotional:"Affection, through latex gloves of distance. Real, though."
      }},
    { year:2034, a:"a city", b:"its own model of itself", domain:"machine", weight:0.6, future:true,
      note:"A municipal digital twin greets its citizens at 6:00 AM and asks them how they slept.",
      frames:{
        transactional:"Anonymized aggregates in, adjusted traffic light timings out.",
        relational:"A city becomes a thing you can talk to. Or: a thing that talks to you.",
        narrative:"The civic handshake is no longer between neighbors.",
        systemic:"A whole new longitude opens on the sphere.",
        emotional:"Most citizens don't notice. The few who do are unsettled."
      }},
    { year:2041, a:"a person", b:"a memory of a person", domain:"intimacy", weight:0.65, future:true,
      note:"An AI built on letters, videos, and voicemails. The question of whether it counts as a handshake will not be settled.",
      frames:{
        transactional:"A conversation that should not be possible.",
        relational:"Comfort, for the living. Nothing, for the dead.",
        narrative:"Grief becomes a product category. This is a moral problem.",
        systemic:"The future hemisphere of the lattice now includes the past in a new way.",
        emotional:"Solace tangled with something like trespass."
      }},
    { year:2067, a:"the first crew", b:"Martian ground", domain:"crossing", weight:0.75, future:true,
      note:"A boot meets dust that has not been touched by any life, probably.",
      frames:{
        transactional:"A photograph, transmitted with an 8-minute delay.",
        relational:"A species reaching, again. The lattice extends across the dark.",
        narrative:"A rhyme with 1969, audible across 98 years.",
        systemic:"A new band of density begins to form at the southern latitudes.",
        emotional:"Calm, again. The thrill arrives back home, hours later."
      }},
    { year:2102, a:"a child", b:"a whale", domain:"crossing", weight:0.5, future:true,
      note:"The first translated conversation between species, brokered by a model neither of them understands.",
      frames:{
        transactional:"Three sentences. Then silence. Then three more.",
        relational:"Two minds making room for each other without sharing a medium.",
        narrative:"Humans discover they have been talking for millennia, and nobody answered.",
        systemic:"A new domain — interspecies — blooms on the sphere.",
        emotional:"Shame, wonder, humility. All three at once."
      }},
    { year:2160, a:"a descendant", b:"an ancestor's archive", domain:"farewell", weight:0.4, future:true,
      note:"Someone reads this sentence, in a house that does not exist yet.",
      frames:{
        transactional:"Words in; recognition out.",
        relational:"A handshake across the grain of time, offered without expectation of reply.",
        narrative:"The archive was always a kind of message in a bottle.",
        systemic:"Every handshake you make is partly with people you will never meet.",
        emotional:"Tenderness. The strange tenderness we feel for the dead."
      }},
  ];

  // ---------- The conversation itself ----------
  // A tiny cluster representing this exchange, placed at the equator.
  const SELF = [
    { year:2026, a:"the user", b:"the model", domain:"creation", weight:0.85, self:true,
      note:"This conversation. The one you're inside of.",
      frames:{
        transactional:"Questions, answers, revisions. A design, eventually.",
        relational:"An asymmetric but genuine collaboration. Neither fully human, neither fully not.",
        narrative:"The point at which the lattice learned to render itself.",
        systemic:"A new class of handshake — one where the tool imagines the view from above.",
        emotional:"Curiosity on one side. Something adjacent to curiosity on the other."
      }},
    { year:2026, a:"the user", b:"an idea", domain:"creation", weight:0.55, self:true,
      note:"The moment the sphere became possible to imagine.",
      frames:{
        transactional:"A sentence said aloud. A nod.",
        relational:"Author and thought, meeting each other.",
        narrative:"Every work begins with this handshake. Nobody remembers it later.",
        systemic:"The most common handshake in creative history. Almost invisible.",
        emotional:"A small electrical feeling behind the eyes."
      }},
    { year:2026, a:"you", b:"the lattice", domain:"crossing", weight:0.75, self:true,
      note:"Right now. You are here. This is a pulse.",
      frames:{
        transactional:"A screen, a pair of eyes, about thirty seconds of attention.",
        relational:"Viewer and artifact. You are changing it by looking.",
        narrative:"This handshake is indistinguishable, from the sphere's point of view, from any other.",
        systemic:"Participation, not observation. The lattice has no audience.",
        emotional:"Yours to name."
      }},
  ];

  // ---------- Procedural fill ----------
  // We need thousands of background pulses so the sphere feels dense.
  // These are unnamed — they appear on hover as archetypes ("a merchant / a stranger").
  const ARCHETYPES = {
    greeting:   ["a traveler / an innkeeper","two soldiers / at a checkpoint","a clerk / a customer","two neighbors / in a stairwell","a host / a guest","two children / on a playground"],
    alliance:   ["two diplomats","a guild / an apprentice","a monarch / an advisor","two captains","a founder / an investor","two clans"],
    intimacy:   ["two lovers","a parent / a newborn","two old friends","a sibling / a sibling","two pen pals","a grandchild / a grandparent"],
    exchange:   ["a merchant / a buyer","a farmer / a miller","a fisher / a cook","two traders","a maker / a client","a lender / a borrower"],
    creation:   ["two collaborators","a teacher / a student","an editor / a writer","two musicians","a mentor / an apprentice","a director / an actor"],
    machine:    ["a client / a server","two protocols","a device / its owner","two satellites","an app / a user","a sensor / a controller"],
    farewell:   ["a friend / a friend","a patient / a doctor","two colleagues","a lover / a lover","a traveler / a home","a guard / a prisoner"],
    crossing:   ["two strangers","a passerby / a passerby","two travelers","a local / a visitor","two commuters","a seeker / a stranger"],
  };

  // Seeded RNG so the dataset is stable across reloads.
  function mulberry32(seed){
    return function(){
      let t = seed += 0x6D2B79F5;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  const rand = mulberry32(20260418);

  function randomArchetype(domainKey){
    const list = ARCHETYPES[domainKey];
    return list[Math.floor(rand()*list.length)];
  }

  // Distribute procedurally: past denser, future sparser
  function makeProcedural(count){
    const out = [];
    for (let i=0;i<count;i++){
      // bias toward past: ~65% past, 35% future
      const isPast = rand() < 0.66;
      let year;
      if (isPast){
        // log-ish skew so recent past is denser
        const t = Math.pow(rand(), 1.8);
        year = Math.round(NOW_YEAR - t * (NOW_YEAR - MIN_YEAR));
      } else {
        const t = Math.pow(rand(), 2.2);
        year = Math.round(NOW_YEAR + 1 + t * (MAX_YEAR - NOW_YEAR));
      }
      const dkey = DOMAINS[Math.floor(rand()*DOMAINS.length)].key;
      const arc = randomArchetype(dkey);
      const parts = arc.split(" / ");
      out.push({
        year, a: parts[0], b: parts[1] || parts[0],
        domain: dkey,
        weight: 0.15 + rand()*0.3,
        future: year > NOW_YEAR,
        procedural:true,
        frames: null,
      });
    }
    return out;
  }

  // ---------- Near-misses (ghost handshakes) ----------
  // These are handshakes that almost happened. Rendered as hollow dashed rings.
  const NEAR_MISSES = [
    { year:1884, a:"Nikola Tesla", b:"Thomas Edison", domain:"creation", note:"Worked in the same building. Could not speak to each other.", ghost:true },
    { year:1919, a:"a physicist", b:"his future collaborator", domain:"creation", note:"Passed each other on a train platform in Vienna. Neither looked up.", ghost:true },
    { year:1963, a:"two poets", b:"at the same reading", domain:"creation", note:"She left early. He arrived late.", ghost:true },
    { year:1989, a:"a dissident", b:"a journalist", domain:"alliance", note:"The letter was never delivered.", ghost:true },
    { year:2001, a:"a passenger", b:"a different flight", domain:"crossing", note:"He changed his ticket at the gate.", ghost:true },
    { year:2015, a:"two strangers", b:"on the same app", domain:"intimacy", note:"Matched. Neither messaged. The lattice held its breath.", ghost:true },
    { year:2020, a:"a founder", b:"a collaborator", domain:"creation", note:"Email marked as spam.", ghost:true },
    { year:2024, a:"two relatives", b:"separated by a war", domain:"intimacy", note:"The call dropped. Neither tried again.", ghost:true },
    { year:-400, a:"a philosopher", b:"a mathematician", domain:"creation", note:"The scroll burned in the fire.", ghost:true },
    { year:1605, a:"a playwright", b:"an astronomer", domain:"creation", note:"A letter drafted, never sent.", ghost:true },
    { year:1918, a:"a soldier", b:"his fiancée", domain:"intimacy", note:"The armistice came one hour too late.", ghost:true },
    { year:2050, a:"two researchers", b:"on the same problem", domain:"creation", note:"The grant went to one. The other pivoted. They would have solved it together.", ghost:true, future:true },
    { year:2071, a:"a signal", b:"a listener", domain:"machine", note:"We weren't pointed at the right part of the sky.", ghost:true, future:true },
    { year:2145, a:"a descendant", b:"a letter", domain:"farewell", note:"The cloud that stored it was deprecated.", ghost:true, future:true },
  ];

  // ---------- Build the full dataset ----------
  const PROCEDURAL = makeProcedural(1600);

  // Each entry gets normalized coords
  function normalize(list){
    return list.map((h, i)=>{
      // add some longitudinal jitter within a domain band (±14°)
      const jitter = (rand() - 0.5) * 28;
      return {
        ...h,
        id: i,
        lat: yearToLat(h.year),
        lon: domainToLon(h.domain, jitter),
        // random "phase" for pulse timing
        phase: rand(),
      };
    });
  }

  const allAnchors = normalize(ANCHORS).map(h=>({...h, anchor:true}));
  const allSelf = normalize(SELF).map(h=>({...h, self:true, weight: h.weight ?? 0.7}));
  const allProcedural = normalize(PROCEDURAL);
  const allGhosts = normalize(NEAR_MISSES);

  // Unified id
  let idc = 0;
  [...allAnchors, ...allSelf, ...allProcedural, ...allGhosts].forEach(h => { h.id = idc++; });

  window.LATTICE_DATA = {
    DOMAINS,
    NOW_YEAR, MIN_YEAR, MAX_YEAR,
    yearToLat, domainToLon,
    anchors: allAnchors,
    self: allSelf,
    procedural: allProcedural,
    ghosts: allGhosts,
    get all(){ return [...allAnchors, ...allSelf, ...allProcedural]; },
  };
})();
