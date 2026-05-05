# Diplotactics Rules

## Turn Structure

All living units receive one order, then the turn resolves simultaneously.

## Unit State

Units are either steady or exposed. Exposed units cannot attack or cover.

## Starting Setup

The prototype starts on a 7-by-5 hex rectangle. Blue and Red begin on opposite edge ranks in straight lines facing each other.

## Orders

- Move to an adjacent hex. The unit enters if the move succeeds after simultaneous movement resolution.
- Attack an adjacent hex after movement. If the target unit is steady, it becomes exposed. If it is already exposed, it is killed. Two or more net attacks kill instantly.
- Cover the unit's own hex or an adjacent hex. Cover reduces incoming attacks on that hex by 1.
- Recover. If the unit is exposed and receives no net attacks this turn, it becomes steady. If an exposed recovering unit receives any net attack, it is killed.
- Hold. The unit does nothing.

## Movement

Moves resolve before attacks, cover, and recovery.

- A move into an empty destination succeeds unless multiple units move into the same destination.
- Movement chains are allowed only if every dependent move succeeds.
- If a unit fails to leave a hex, moves into that hex fail.
- Same-team swaps are allowed.
- Opposing-team swaps fail.
