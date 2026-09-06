-- ============================================================
--  Anchor — preset scenario seed
--  Migration 0002
--
--  context_fields is a declarative form spec consumed by the scenario
--  setup screen. Field types: currency | number | text | textarea | select.
--  Adding or reshaping a scenario is a data change, never a code change.
-- ============================================================

insert into public.scenarios
  (is_preset, slug, title, summary, user_role, ai_role, unit, unit_suffix, context_fields)
values
-- ------------------------------------------------------------
(true, 'salary',
 'Salary negotiation',
 'You have a written offer in hand. Push the base up without souring the relationship you are about to start.',
 'a candidate who has already received and verbally appreciated a written offer',
 'the hiring manager, who has real budget discretion but is anchored to an internal band and to what your peers are paid',
 'USD', '/yr',
 $json$[
   {"key":"currentOffer","label":"Their offer","type":"currency","required":true,"placeholder":"145000","help":"The base salary currently on the table."},
   {"key":"target","label":"Your target","type":"currency","required":true,"placeholder":"175000"},
   {"key":"walkAway","label":"Your walk-away number","type":"currency","required":false,"placeholder":"155000","help":"Below this you decline. Kept private from the AI."},
   {"key":"leverage","label":"What leverage do you actually have?","type":"textarea","required":false,"placeholder":"Competing offer at 168k, I own the payments service, they have been hiring for this role for 5 months.","help":"Be honest — inventing leverage you do not have is exactly the habit this trains out of you."}
 ]$json$::jsonb),

-- ------------------------------------------------------------
(true, 'freelance-rate',
 'Freelance rate',
 'A prospective client likes your work and has just asked "what would this cost?". Price it without flinching.',
 'an independent contractor pricing a defined project or retainer',
 'a prospective client with a real budget ceiling, comparison quotes, and a habit of treating rates as an opening bid',
 'USD', '/hr',
 $json$[
   {"key":"currentOffer","label":"Their budget or last offer","type":"currency","required":true,"placeholder":"75","help":"Leave as their stated budget if no formal offer yet."},
   {"key":"target","label":"Your target rate","type":"currency","required":true,"placeholder":"140"},
   {"key":"walkAway","label":"Your floor","type":"currency","required":false,"placeholder":"110"},
   {"key":"scope","label":"Scope of work","type":"textarea","required":false,"placeholder":"Rebuild their checkout flow, ~6 weeks, I also maintain it for 3 months after launch."}
 ]$json$::jsonb),

-- ------------------------------------------------------------
(true, 'vendor-deal',
 'Vendor / supplier deal',
 'Renewal is coming up and the price went up 22%. Get it back down, or get more for the same money.',
 'a buyer responsible for this contract at your company',
 'an enterprise account executive carrying a quota, armed with usage data, renewal deadlines, and a discount ladder they will only descend under pressure',
 'USD', '/yr',
 $json$[
   {"key":"currentOffer","label":"Quoted renewal price","type":"currency","required":true,"placeholder":"96000"},
   {"key":"target","label":"Target price","type":"currency","required":true,"placeholder":"72000"},
   {"key":"walkAway","label":"Budget ceiling","type":"currency","required":false,"placeholder":"84000"},
   {"key":"leverage","label":"Your leverage","type":"textarea","required":false,"placeholder":"We are 40% under our seat commit, their competitor quoted us 68k, our renewal date is their quarter end."}
 ]$json$::jsonb),

-- ------------------------------------------------------------
(true, 'sales-call',
 'Sales call',
 'You are the one selling. Hold your price against a buyer whose whole job is to make you drop it.',
 'an account executive trying to close this deal at or near list price',
 'a procurement lead who is skeptical, unhurried, professionally non-committal, and has explicitly been told to extract a discount',
 'USD', '/yr',
 $json$[
   {"key":"currentOffer","label":"Their counter","type":"currency","required":true,"placeholder":"40000","help":"What the buyer says they are willing to pay."},
   {"key":"target","label":"Your list price","type":"currency","required":true,"placeholder":"60000"},
   {"key":"walkAway","label":"Maximum discount you can approve","type":"currency","required":false,"placeholder":"51000"},
   {"key":"scope","label":"Deal context","type":"textarea","required":false,"placeholder":"3-year term, 250 seats, they are already using a free tier and their usage doubled last quarter."}
 ]$json$::jsonb),

-- ------------------------------------------------------------
(true, 'apartment-rent',
 'Apartment rent',
 'Renewal notice says the rent is going up. Talk it down, or trade the increase for something worth having.',
 'a current or prospective tenant negotiating a 12-month lease',
 'a landlord or property manager who knows exactly what vacancy costs them but will never say so out loud',
 'USD', '/mo',
 $json$[
   {"key":"currentOffer","label":"Their asking rent","type":"currency","required":true,"placeholder":"2850"},
   {"key":"target","label":"Your target rent","type":"currency","required":true,"placeholder":"2600"},
   {"key":"walkAway","label":"Most you would pay","type":"currency","required":false,"placeholder":"2750"},
   {"key":"leverage","label":"Your leverage","type":"textarea","required":false,"placeholder":"Two years, never late, three comparable units vacant in the building, I can sign for 24 months."}
 ]$json$::jsonb),

-- ------------------------------------------------------------
(true, 'car-purchase',
 'Car purchase',
 'You are at the desk and the sales manager has just come over. The number on the page is not the real number.',
 'a buyer negotiating an out-the-door price on a specific vehicle',
 'a dealership sales manager who negotiates for a living, controls the trade-in and financing levers, and treats your enthusiasm as information',
 'USD', null,
 $json$[
   {"key":"currentOffer","label":"Their asking price","type":"currency","required":true,"placeholder":"38500","help":"Out-the-door, including fees."},
   {"key":"target","label":"Your target price","type":"currency","required":true,"placeholder":"34000"},
   {"key":"walkAway","label":"Your absolute maximum","type":"currency","required":false,"placeholder":"36000"},
   {"key":"leverage","label":"Your leverage","type":"textarea","required":false,"placeholder":"Pre-approved financing at 5.1%, same trim listed 40 minutes away for 35.9k, it is the last day of the month."}
 ]$json$::jsonb);
