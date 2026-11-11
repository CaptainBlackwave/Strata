# Bug 2026-11-11: the sand did not fall out of the jar right

Reported by the owner from a phone (level 52): during a pour the tilted jar stayed full and the
stream started at a fixed point near, not at, the jar's lip.

Fix (`src/ui/screens/pour.ts`, `src/ui/logic/pour-geometry.ts`): the stream starts at the tilted
jar's lower lip (`lowerLip`, unit-tested), kept over the target's opening, and the poured layers
drain from the jar while the sand falls (over the stream and flow) instead of after it lands.

`check.cjs` pours jar 2 into 9 on level 52 at 412x915 with animations slowed 4x; `frame-1..4.png`
show the stream leaving the lip and the top layer thinning as the target fills.
