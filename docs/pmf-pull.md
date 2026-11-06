# Finding product-market fit: the PULL playbook

How we decide what to build and who to sell to. Adapted from Rob Snyder's
PULL framework. Read this before planning a feature or an outreach push.

## The rules

1. **A real pain isn't enough.** People can agree a product solves a real
   problem and still never buy. We're looking for buyers who are already
   trying to solve something, not people who nod along.
2. **PULL is four conditions in one person:**
   - **P**roject: something already on their to-do list.
   - **U**navoidable: a reason it has to happen now.
   - **L**ist: the options they've already tried or considered.
   - **L**imitations: why each of those options leaves them stuck.

   When all four are true, the buyer is a coiled spring.
3. **Design partners are a trap.** A partner buys the vision, hands you
   feedback, and never pays. People with real pull don't want to be
   partners; they want the thing done. Offering a "pilot" or "partnership"
   is a negative signal to people with pull and a positive one to people
   without it. Offer to get their job done instead.
4. **Pull belongs to a person, never a company.** Not "we sell to
   remodelers". Write it as: "Matt, who runs estimates himself and loses his
   evenings to drives for jobs he doesn't win."
5. **Cold outreach should be interesting, not persuasive.** Its only job is
   to get the call. Skip the pain points and value props; lead with
   something worth a reply.
   - Benchmark: about 20 requests a day, 30–40% accepted, 30–50% of those
     reply.
6. **Run the first call like a detective, not a pitcher.** Open with: "I'm
   sure you get a lot of people reaching out. Why did you take this call?"
   The best calls fill in PULL for you.
7. **Pull looks like leaning in, not praise.**
   - "How do we get started?" or "Does it exist yet?" is pull.
   - "That's amazing, the future of the industry" is a polite exit.
   - Anything that pushes the decision later ("Q4", "let me think") is not
     pull.
8. **When a call goes lukewarm, ask the Hail Mary:** "Is there anything on
   your to-do list you'd pay me to do right now?" If you're stuck, go goblin
   mode: a burst of slightly crazy effort to get in front of customers.
9. **Run a case study factory.**
   - Find one type of customer who says "hell yes" both before and after
     buying.
   - Repeat that exact case study through pipeline, sales and delivery.
   - Find the bottleneck in that loop and treat it as the only thing that
     matters until it's fixed (theory of constraints).

## Applied to Haleo

**Who has the pull.** The owner-operator remodeler: 1–10 people, San Jose,
kitchens, baths and additions. They do every estimate themselves.

- **Project:** win more of the jobs they want without burning evenings and
  drives on jobs they don't.
- **Unavoidable:** every unqualified site visit costs about 4–6 unpaid
  hours, and only about 1 in 3 to 1 in 5 estimates becomes a job. Busy
  season makes that time scarcer, and a slow season makes each lead matter
  more.
- **List** of what they use now:
  - phone screening
  - lead marketplaces (Angi, Thumbtack, Houzz)
  - referrals
  - charging for estimates
  - CRMs and estimating software
- **Limitations:**
  - Phone screens miss the house itself.
  - Marketplace leads are shared and often unqualified.
  - Referrals don't scale.
  - Charging for estimates scares off good clients.
  - CRMs track leads but don't qualify them.

**What we test for.** Does the contractor *use the link* with their own next
lead? Sending a lead through `/c/:slug` or `/i/:token` is the pull-shaped
action. Praise for the brief is not.

**Never** call it a pilot or design partnership. Offer to handle their next
lead's intake.

**The case study we're building.** "A small San Jose remodeler sent us their
next 10 leads. They skipped N site visits, and every visit they made was a
job they wanted." Then repeat it.

Today's bottleneck is getting a contractor's real leads into the link.
