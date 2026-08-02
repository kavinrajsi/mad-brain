/**
 * Seeds the Nithya Amirtham brand from BRAND-CONTENT.md.
 *
 * The brief's own "How the Brand Brain answers" section is left out: it is a
 * different tool's output contract (word limits, verdict formatting), and as
 * retrievable text it would surface as a citation in checks about brand voice.
 * The Google Sheet note is left out for the same reason — it describes where
 * seasonal content lives, not what the brand stands for.
 *
 *   npm run seed:nithya
 */
import { config } from "dotenv";

config({ path: new URL("../.env.local", import.meta.url).pathname });

const { seedBrand } = await import("./lib/seed-brand.mjs");

const PROFILE = {
  mission:
    "Virunthombal — extreme hospitality. Every small moment must become a celebration. The question before any decision: does this turn the moment into a celebration? Vision: Tamil Nadu's most loved food brand, growing through QSR expansion, gifting dominance, and becoming an everyday cultural icon.",
  audience:
    "Families and multi-generational groups, celebration occasions and everyday diners. Thuritham (QSR) serves a younger crowd, office-goers and quick meal seekers. Sweets & Savouries serves gift buyers, festival shoppers and sweet lovers. Veg Restaurant serves pure vegetarian dining, family thali and the lunch crowd.",
  values: [
    "Warmth — cannot be compromised, ever",
    "Celebration — cannot be compromised, ever",
    "Tamil identity — cannot be compromised, ever",
    "Natural authentic photography — cannot be compromised, ever",
    "Freshness and consistency of food and experience — cannot be compromised, ever",
    "Make people feel seen, cared for and connected",
    "Show hospitality without ever saying 'we are hospitable'",
    "Reinterpret Tamil heritage in today's context",
    "Feed people and their feelings",
  ],
  tone: [
    "Warm, grounded, gently cheerful, quintessentially Tamil",
    "Direct, honest, rooted in care",
    "Make people feel, not just think",
    "Sentence rhythm: short, clear, emotional, purposeful",
    "Social captions run 5–6 words and capture an emotion",
    "Tamil-only for deep cultural moments, traditional festivals, regional intimacy",
    "Tanglish for everyday social, youth-facing content and Thuritham",
    "English for wider reach, new audiences, gifting and out-of-home",
    "Never loud, corporate, Western-minimal without cultural depth, or artificially polished",
  ],
  dos: [
    "Use the brand's own words: Anbu, Suvai, Sandhosham, Kai Manam, Namma, Thiruvizha, Kondattam, celebration, freshness, happiness, every day",
    "Keep red as the master identity at roughly 60% of a master-brand composition",
    "Keep each vertical's palette strictly separate",
    "Use greens as veg purity cues and gold for festive elevation",
    "One single idea per post — never stuff multiple messages",
    "Photograph food as served, never styled: the moment just before a customer eats",
    "Photograph people as hosts, cooks, servers, families and regulars — documenting hospitality, not directing performance",
    "Set a custom thumbnail on every Reel and reshare it to Stories with stickers or polls",
    "Open a Reel on the most visually striking moment — a ghee pour, a sweet box opening, a sizzle crack",
    "Keep minimum font size at 14pt on any digital or print text",
    "Adjust weight and size within the approved fonts rather than switching family",
    "Send JPEGs on WhatsApp rather than PDFs, and include reference images in every presentation",
  ],
  donts: [
    "Never use Sattu Puttu Orange #F56A00 outside Thuritham — not even for master brand festivals",
    "Never mix vertical palettes",
    "Never desaturate brand colours or introduce unapproved ones",
    "Never use loud promotional language, corporate jargon or discount-first messaging",
    "Never write 'mega sale', 'unbelievable offer' or 'limited time only'",
    "Never send generic festival greetings",
    "Never use stock imagery, under any circumstances",
    "Never use Gen AI food imagery unless it passes the Real Kitchen Test",
    "Never use artificial-looking food, or let props overshadow the subject",
    "Never use the phone's built-in flash — recreate daylight-balanced lighting",
    "Never start a Reel with a logo, a talking head or a text card, and never exceed 60 seconds",
    "Never put offers, pricing, taglines or promotions in the red area of signage — logo only",
    "Never distort, stretch or alter letterforms",
    "Never let body copy compete with the headline for dominance",
  ],
  visual: [
    "Kumkumam Red #C61D23 (RGB 198/29/35, CMYK 10/100/100/10, Pantone 186 C) — primary, 60% of any master-brand composition",
    "Master secondary: Turmeric Gold #FFB400, Leaf Green #4A8F3C, Stone Grey #6F6E6A, Brass Yellow #DDA73A, Kaavi Maroon #7A0C20",
    "Master usage ratio: Red 60%, Gold/Brass 15%, Greens/Maroon 15%, Neutrals 10%",
    "Thuritham only: Sattu Puttu Orange #F56A00 50%, Chilli Red #D02200 25%, Fire Yellow #FEDE17, Curry Leaf Green #2F6B2C",
    "Sweets & Savouries: Golden Yellow #FFCA2B 50%, Cardamom Green #889E52, Almond Cream #EFDECD, Laddu Orange #FF8E2B, Vellam Brown #8C4A1F",
    "Veg Restaurant: Plantain Leaf Green #2F8C3A 50%, Steamed Rice White #F8F3E7",
    "Typography — English: Aller Bold for headlines, Aller Regular for body",
    "Typography — Tamil: Anek Tamil Bold for headlines, Anek Tamil Regular for body",
    "Backgrounds simple and clean, no busy patterns; light food on darker ground, dark food on lighter ground",
    "Social layout: logo top right at 70px, 50px safe area, text within 55px margins and below 250px from the top",
  ],
};

const DOCUMENTS = [
  {
    title: "Who Nithya Amirtham Is",
    body: `IDENTITY

A rooted Tamil brand that cares and serves with warmth. Every interaction must feel happy, sincere, respectful and culturally connected. The brand is uncompromising on freshness and consistency of food and experience.

THE NORTH STAR

Virunthombal — extreme hospitality. Every small moment must become a celebration.

The question to ask before any decision: "Does this turn the moment into a celebration?"

VISION AND GROWTH

Vision: Tamil Nadu's most loved food brand.
Growth path: QSR expansion, gifting dominance, everyday cultural icon.

BRAND PERSONALITY

Warm. Grounded. Gently cheerful. Quintessentially Tamil. Direct, honest, rooted in care.

Never: loud, corporate, Western-minimal without cultural depth, or artificially polished.

WHAT CANNOT BE COMPROMISED — EVER

Warmth. Celebration. Tamil identity. Natural authentic photography. Freshness and consistency of food.

WHAT CAN EVOLVE

Illustrations. Packaging across seasons. New Tamil expressions. Campaign IP extensions.`,
  },
  {
    title: "Brand Verticals and Formats",
    body: `NITHYA AMIRTHAM — MASTER BRAND / VEG RESTAURANT

Dominant colour: Kumkumam Red #C61D23.
Audience: families, multi-generational groups, celebration occasions, everyday diners.
Personality: warmth, cultural pride, celebration, everyday joy.
Format descriptor below the logo: "Veg Restaurant".

THURITHAM — QSR

Dominant colour: Sattu Puttu Orange #F56A00. This colour is EXCLUSIVE TO THURITHAM. It is never used outside Thuritham — not even for master brand festivals. This is a hard rule.
Audience: younger crowd, office-goers, quick meal seekers.
Personality: energetic, fast, rooted — "Sattu Puttunu Food".
Format descriptor: "Thuritham" in italic script below the master logo.

SWEETS & SAVOURIES

Dominant colour: Golden Yellow #FFCA2B.
Audience: gift buyers, festival shoppers, sweet lovers.
Personality: festive, indulgent, gifting-forward.
Format descriptor below the logo: "Sweets & Savouries".

VEG RESTAURANT — STANDALONE PURE-VEG FORMAT

Dominant colour: Plantain Leaf Green #2F8C3A.
Audience: pure vegetarian dining, family thali, lunch crowd.
Personality: purity, freshness, Tamil tradition.
Format descriptor below the logo: "Veg Restaurant".

KIOSK

Follows the master brand colour system. Under-25ft signage rules apply.`,
  },
  {
    title: "Colour System",
    body: `PRIMARY — KUMKUMAM RED

HEX #C61D23 · RGB 198/29/35 · CMYK 10/100/100/10 · Pantone 186 C.
Usage: 60% of any composition.
Use for logos, brand visuals, festival communications and corporate identity.

MASTER BRAND SECONDARY PALETTE (master brand and Veg Restaurant)

Turmeric Gold #FFB400 · RGB 255/180/0 · Pantone 123 C — 15%
Leaf Green #4A8F3C · RGB 74/143/60 · Pantone 362 C — 15%
Stone Grey #6F6E6A · RGB 111/110/106 · Pantone Cool Grey 9C — neutrals
Brass Yellow #DDA73A · RGB 221/167/58 · Pantone 7555 C — 15%
Kaavi Maroon #7A0C20 · RGB 122/12/32 · Pantone 7622 C — 15%

Usage ratio: Red 60%, Gold and Brass 15%, Greens and Maroon 15%, Neutrals 10%.

THURITHAM PALETTE — EXCLUSIVE, NEVER MIXED WITH THE MASTER BRAND

Sattu Puttu Orange #F56A00 · Pantone 1585 C — 50%
Chilli Red #D02200 · Pantone 485 C — 25%
Fire Yellow #FEDE17 · Pantone 1235 C — accent
Curry Leaf Green #2F6B2C · Pantone 349 C — accent

SWEETS & SAVOURIES PALETTE

Golden Yellow #FFCA2B · Pantone 7408 C — 50%
Cardamom Green #889E52 · Pantone 5763 C — accent
Almond Cream #EFDECD · Pantone 9185 C — neutral
Laddu Orange #FF8E2B — accent only
Vellam Brown #8C4A1F — accent only

Usage: Yellow 50%, Red 25%, Browns and Greens 15%, Neutrals 10%.

VEG RESTAURANT PALETTE

Plantain Leaf Green #2F8C3A · Pantone 356 C — 50%
Steamed Rice White #F8F3E7 · Pantone 7499 C — neutral

Usage: Green 50%, Red 25%, Gold 10%, Neutrals 15%.

COLOUR RULES

Do: use red consistently as the master identity; keep vertical palettes strictly separate; use greens for veg purity cues; use gold for festive elevation.

Don't: mix vertical palettes, ever. Don't desaturate colours. Don't use orange outside Thuritham. Don't introduce unapproved colours.`,
  },
  {
    title: "Tone of Voice and Writing Rules",
    body: `TONE

Warm, grounded, gently cheerful, quintessentially Tamil. Direct, honest, rooted in care. Make people feel, not just think.

Sentence rhythm: short, clear, emotional, purposeful.
Caption length: 5–6 words to capture an emotion for social posts.

LANGUAGE CHOICE

Tamil-only: deep cultural moments, traditional festival content, regional intimacy.
Tanglish: everyday social content, youth-facing work, Thuritham and QSR formats.
English: wider reach, new audiences, gifting content, out-of-home.

WORDS TO CONSCIOUSLY USE

Anbu · Suvai · Sandhosham · Kai Manam · Namma · Thiruvizha · Celebration · Freshness · Happiness · Every day · Kondattam

NEVER USE

Loud promotional language. Corporate jargon. Discount-first messaging. "Mega sale". "Unbelievable offer". "Limited time only". Generic festival greetings.

APPROVED HEADLINE STYLE

"Sattu Puttunu Food, Now in Alandur"
"Every bite, a small celebration"
"Warmth that feels like home"
"Vanakkam [City]. Kondattam Thodangiduchu."
"Freshly made. Every single day."

APPROVED CAPTION STYLE

"Freshly made. Happily shared."
"Sandhoshathoda serve pannrom."
"Kai Manam. Kadhaigal. Kondattam."
"Namma NA. Namma Taste."`,
  },
  {
    title: "Photography and Visual Content",
    body: `FOOD PHILOSOPHY

"This dish exists for eating, not for photographing." Every food photo must look like the moment just before a customer eats.

APPROACH

Food is served, not styled. Freshness is timing discipline, not a visual trick. The plate is a functional object, not a prop. Texture matters more than drama. Portions are reassuring, not exaggerated. Never use the phone's built-in flash — recreate daylight-balanced lighting always.

ANGLES

Overhead / flat lay: platters, assorted sweets, boxes, thali spreads.
45-degree: bowls, cups, layered desserts, stacked food.
Eye level / side: tall items, drinks, biriyani pots.
Close-up / macro: texture shots, garnish, ingredient beauty, ghee pour.

FOOD STYLING

Backgrounds: simple clean surfaces. No busy patterns. No textured backgrounds.
Props: contextually relevant and minimal. For Kondatangal, small diyas and flowers matching the festival.
Colour contrast: light food on a darker background, dark food on a lighter background.
Garnish: a touch of mint, a whole cashew, saffron strands, a ghee drizzle — elevates without faking.
Freshness: always photograph freshly made items. Stale or sweating sweets never photograph well.

EDITING DIRECTION

Brightness: slightly increase, food should look inviting.
Contrast: small increase, adds depth.
Saturation: slight increase, colours pop naturally.
Warmth: slight warm tint, more appetising.
Sharpness: small increase for texture shots.
Highlights: slightly reduce if overexposed.
Shadows: slightly increase to reveal detail.

PEOPLE

People are not models. They are hosts, cooks, servers, families, regulars. The core thought: "We are documenting hospitality, not directing performance."

Candid moments mid-action, not posed. Expressions come from action, not direction. The camera observes, it does not interrupt. Hands, gestures and interactions matter more than faces alone.

AMBIENCE

Photograph the space as a customer experiences it, not as a showroom. Cleanliness and order communicate premium more than styling does. One strong spatial or cultural cue per frame. Warm, welcoming light.

ABSOLUTE DON'TS

No stock imagery — ever, under any circumstances.
No Gen AI food images for posts unless they pass the Real Kitchen Test.
No artificial-looking food.
No obsession over props at the cost of the main subject.

THE REAL KITCHEN TEST

"If you saw this on the menu of a quality Indian sweets restaurant, would you believe it's real?" If no, regenerate. Do not use it. Always provide real reference photos of the exact plating and crockery when generating AI images.

AI FOOD SPECIFICS

Ladoo: slight grain, unevenness, natural cracking. Never perfectly spherical or glassy.
Barfi: matte, slightly textured cut edge. Never a polished mirror finish.
Halwa: ghee sheen with slight surface irregularity, as if just served.
Murukku: rough, porous, golden surface. Spirals uneven in thickness.
Mixture: pieces vary in size and colour. No two pieces identical.
Fried items: subtle realistic oil sheen, never full wet gloss.
Curries: natural oil pooling at the edges, visible whole spices.
Breads: char marks, puffed and irregular surfaces.

Do: natural surface imperfections, realistic texture, slight garnish irregularity.
Don't: perfectly smooth or round shapes, plastic-looking surfaces, symmetrical garnish patterns.

VIDEOGRAPHY

Format: vertical 9:16 at 1080×1920px. Duration 7–60s, with 15–30s ideal. Frame rate 60fps, up to 120fps for slow motion. Audio is trending music or satisfying food sounds. Always set a custom thumbnail and use Instagram auto-captions for accessibility.`,
  },
  {
    title: "Content System and Platform Strategy",
    body: `CONTENT PURPOSE

Turn everyday moments into celebrations. Make people feel seen, cared for and connected. Honour the Tamil tradition of delightful surprises through content. Build a living, emotional, always-warm brand memory.

CORE NARRATIVE THREADS

Show celebration as a daily behaviour, not only at festivals. Show hospitality without explicitly saying "we are hospitable". Reinterpret Tamil heritage in today's context. Be a brand that feeds people and their feelings.

INSTAGRAM REELS

First 3 seconds: the most visually striking moment — a ghee pour, a sweet box opening, a sizzle crack.
Never start with a logo, a talking head or a text card.
Length: 15–30s for craving and product, up to 45s for making and process. Never exceed 60s.
Audio: trending Instagram music or satisfying kitchen sounds — sizzle, pour, crunch, crack.
Text overlays: always 1–2 lines, because 60% of viewers watch on mute. Product name plus a relatable line.
Cover thumbnail: always set a custom still image, never a random video frame.
After posting: always reshare to Stories with interactive stickers, polls and GIFs.
Hashtags: category, food item, branch name, campaign name, and #ForAllGoodThings.

INSTAGRAM OTHER

Posts: product storytelling, heritage moments, real diner stories.
Captions: 5–6 words, conversational, rooted in Kai Manam and Suvai.
Stories: in-store action, behind the scenes, live polls, Q&A — daily minimum.
Series: Sandhoshathoda Serve Panrom, Suvai Shorts, Thiruvizha Notes.

YOUTUBE

Long-form: kitchen processes, artisan features, cultural showcases, documentary style.
Shorts: festival menus, store launches, nostalgic food stories.
Episodic: Pachai Pathiram (dish origins), Naalu Nimisham Saapadu (mini-meals), micro dramas.
Content ratio target — short to medium to long, 15 : 5 : 1.

FACEBOOK

Target: family decision-makers. Content: livestreams, community stories, Tamil-only interviews, live recipes.

WHATSAPP

JPEGs are preferred over PDFs, always. Catalogues carry price, menu and gifting. Weekly Tamil calendar reminders. Internally, voice note updates are preferred for team approvals.

CADENCE

August to January is the Sweetifully Yours season: high intensity, festivals, gifting, sweets.
February to July is the culture season: culture-led storytelling, rituals, thalis, leaf spreads.
Weekly minimum: 3–4 Reels, 2 posts, 3 Stories.
Monthly minimum: 1 campaign film, 1 in-store reel, 1 founder or chef POV piece.`,
  },
  {
    title: "Campaign IPs and Signature Series",
    body: `KONDATANGAL THODANGATTUM

Traditional festive umbrella, Aadi through Thai. Covers Vinayagar Chaturthi, Krishna Jayanthi, Navaratri, Deepavali, Karthigai Deepam, Pongal, Aadi Perukku and Thai Pongal. Tone: deep cultural pride, community celebration, family togetherness. Visuals are richly festive — diyas, kolam, banana leaf, traditional vessels.

SWEETIFULLY YOURS

Modern festive IP for occasions not under Kondatangal. Covers Valentine's Day, Mother's Day, Father's Day, Teacher's Day, Friendship Day, birthdays and corporate gifting. Tone: warm, gifting-forward, contemporary Tamil sensibility with sweetness.

SATTU PUTTUNU FOOD

QSR and Thuritham specific. Tone: energetic, punchy, speed-celebrating. "Quick but never rushed." Example: "Sattu Puttunu Food. Now in [City/Location]."

VANAKKAM SESSIONS

Influencer and chef-led storytelling. Tone: humour, authenticity, Tamil warmth. Not polished — real. Format: short-form video interviews and behind-the-scenes with personality.

THAMIZH CALENDAR RECIPES

Seasonal food content, matched to Tamil season and ritual. Examples: Karthigai Vilakku snacks, Aadi Perukku river offerings, the Pongal pot ceremony.

CAMPAIGN FOR RELIGIOUS FESTIVALS

Covers Ther Thiruvizha, Thai Poosam, Siva Rathiri, Arudra Darshan and Skanda Sashti. Tone: respectful reverence with celebratory warmth. Not promotional.

CAMPAIGN FOR PRODUCT SPECIALS

Example: MaaPerum Thiruvizha for mango season, and new menu launches. Tone: excitement, product as hero, sensory celebration.

WHICH IP FOR WHICH OCCASION

Deepavali, Pongal, Vinayagar Chaturthi, Navaratri, Karthigai Deepam — Kondatangal Thodangattum.
Thai Poosam, Siva Rathiri — Campaign for Religious Festivals.
Valentine's Day, Mother's Day, Christmas and New Year — Sweetifully Yours.
New branch opening — Sattu Puttunu Food for Thuritham, or a master brand announcement.
Product launches — Campaign for Product Specials.`,
  },
  {
    title: "Signage Guidelines",
    body: `SIGN TYPES

Type 1, horizontal logo, 35ft and wider. Red to white ratio 75:25. Logo mark at 70% of the sign height, wordmark at 30%. Standard reference 35ft × 5ft.

Type 2, stacked logo, 25–35ft. Red to white ratio 70:30. Mark at 65% of sign height, wordmark at 65%. Standard reference 30ft × 5ft.

Base, single-line logo, under 25ft. Red to white ratio 67:33. Mark at 67% of sign height, wordmark at 67%. Standard reference 25ft × 5ft.

STACKED LOGO RULE

Use the stacked logo only when the horizontal version cannot fit without compromising legibility.

CONTENT RESTRICTIONS

The brand colour area — the red section — carries the LOGO ONLY. No offers, pricing, taglines, promotions or extra text.

The neutral area — the white section — carries the FORMAT DESCRIPTOR ONLY, such as "Veg Restaurant", "Sweets & Savouries" or "Thuritham". No promotions, offers, graphics or additional text.`,
  },
  {
    title: "Layout Guidelines",
    body: `ADDRESS BAR RULES

The ratio matches the medium, per the master templates. A "Coming Soon" section always comes first. City names are bold, locations are regular weight. It must include a contact number, social handles and the website. The minimal version carries cities only, with no location detail. The logo sits outside the address bar only when explicitly necessary. Thuritham's address bar uses the orange scheme, not red.

SOCIAL MEDIA DIMENSIONS

Instagram feed portrait, recommended: 1080×1350px at 4:5, JPG under 10MB.
Instagram feed square: 1080×1080px at 1:1, JPG under 10MB.
Instagram Stories: 1080×1920px at 9:16, JPG or PNG under 30MB.
Facebook post: 1200×630px, JPG under 10MB.
WhatsApp Business: 1000×1000px, JPG under 5MB.
Google Business post: 1200×900px, JPG under 5MB.

SOCIAL LAYOUT SPECS

Logo in the top right corner at 70px height. Safe area of 50px on all sides. Text stays within 55px margins and below 250px from the top.

SOCIAL DESIGN RULES

One single idea per post — never stuff multiple messages.
Minimum font size 14pt, no exceptions.
Proofread spelling, grammar and visuals before sharing or posting.
Reshare every Reel and creative to Stories with interactive stickers or polls.
Make typography tweaks within the same font family rather than switching fonts.
Understand open space, which gives relief, versus negative space, which controls eye movement.

COMMUNICATION HIERARCHY

New store launch — H1: Vanakkam [City]. H2: Sattu Puttunu Food now in [Location]. H3: offer details. H4: store address and ordering info.

Festival campaign — H1: festival name. H2: Kondatangal Thodangattum. H3: product and offer. H4: ordering details.

Product promotion — H1: main copy. H2: descriptor line. H3: offer percentage details. H4: ordering details.`,
  },
  {
    title: "Typography",
    body: `TYPEFACES

English: Aller Bold for headlines, Aller Regular for body copy.
Tamil: Anek Tamil Bold for headlines, Anek Tamil Regular for body copy.

RULES

Never distort, stretch or alter letterforms — ever.
Tamil and English headlines can coexist; maintain weight balance between the scripts.
Body copy must never compete with the headline for visual dominance.
Minimum legible size is 14pt for any text, digital or print.
Do not switch fonts for "different vibes" — use weight and size tweaks within the approved fonts.`,
  },
  {
    title: "Checklists",
    body: `BEFORE STARTING

Do I understand the celebration angle of this work?
Is the correct format identified — Restaurant, Thuritham, Sweets & Savouries, or Kiosk?

BEFORE WRITING

Is the tone warm, not corporate and not loud?
Is the language — Tamil, English or Tanglish — chosen correctly for this audience?
Have all loud or corporate words been removed?

BEFORE DESIGNING

Are the colours warm and on-brand for this vertical?
Is the food real and fresh-looking, not stock and not AI unless approved?
Does the layout feel celebratory?

BEFORE PRESENTING

Are JPEGs prepared, rather than PDFs unless specifically asked?
Is a voice note summary ready?
Are reference images included?

BEFORE SENDING TO CLIENT

Are the formats correct for the medium?
Is the master brand hierarchy applied correctly?

BEFORE POSTING, PRINTING OR PHOTOGRAPHING

Is the serving size accurate and realistic?
Has any stock imagery been used?
Has any Gen AI food imagery been used without passing the Real Kitchen Test?`,
  },
  {
    title: "Experience and Dish Qualification",
    body: `Use these tests before introducing any new idea, dish or brand experience.

CULTURAL ALIGNMENT

Does it extend or enrich the Tamil experience Nithya Amirtham stands for? Does it reinforce warmth, celebration and inclusivity?

STEREOTYPING RISK

Does it risk pigeonholing the brand into one caste or community — Iyengar, Iyer, Nadar, Chettiar, Kongu? Is this association limiting?

OPERATIONAL CHECK

Does it demand radical procedure changes? Can we execute it without disrupting the running system?

FINANCIAL LOGIC

Is this commercially viable? Does it improve or dilute margins?

COMMERCIAL VIABILITY

Can this be repeatable, scalable and profitable? Does it have festive, seasonal or evergreen potential?

SUSTAINABILITY

Can we maintain quality every single day across all formats? Will it hold relevance in year five?

LEGACY TEST

If it were removed, would it leave a cultural or emotional void? Does it deserve to become part of the Nithya Amirtham story?`,
  },
  {
    title: "Client and Approval",
    body: `APPROVAL CHAIN

Step 1: Nibhanya, primary SPOC.
Step 2: Sanjay, secondary SPOC.
Step 3: Parthibhan, founder and CEO, final approval.
Advisor: Bala.

CLIENT PREFERENCES

Voice notes over long text messages.
JPEGs on WhatsApp over PDFs.
In-person presentations over email.
Executed output over long planning documents.
Reference images always included in presentations.`,
  },
];

await seedBrand({
  slug: "nithya-amirtham",
  name: "Nithya Amirtham",
  profile: PROFILE,
  documents: DOCUMENTS,
  ownerEmail: process.argv[2] ?? "sikavinraj@gmail.com",
});

process.exit(0);
