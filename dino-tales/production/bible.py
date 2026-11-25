"""DINO CONTOS — permanent character & style bible.
Every image / animation prompt is assembled from these exact strings so the
characters never drift between scenes or episodes."""

STYLE = ("High-end 3D cinematic children's animation, stylized animated-feature-film look, soft rounded shapes, "
         "smooth clay-like materials with subtle subsurface scattering, vibrant but gentle colors, soft global illumination, "
         "warm rim light, shallow depth of field, magical storybook atmosphere")
NEG = "16:9 aspect ratio, widescreen. No text, no subtitles, no captions, no logos, no watermarks, no extra characters, no humans other than Tuca, no realistic gore, nothing scary."
ANIM_RULES = ("Keep every character on-model: same proportions, colors, clothing and facial features as in the source image. "
              "Natural, weighty, cartoon-appealing motion with gentle squash and stretch only on bounces; no morphing, no extra limbs, "
              "no face distortion, no flicker. 24 fps cinematic look, no text on screen.")

CHARS = {
    'tuca': dict(
        name='Tuca', role='Main character — curious little caveboy',
        full=("Tuca, a cute 6-year-old cartoon caveboy with an oversized round head, big glossy chestnut-brown eyes, a large round button nose, "
              "rosy pink cheeks, one big white front tooth, short spiky dark-brown hair, warm tan skin, wearing a one-shoulder orange tunic "
              "with dark-brown leopard spots, barefoot with big rounded feet and short stubby rounded arms and legs"),
        short='Tuca (cartoon caveboy, spiky dark-brown hair, big nose, one front tooth, orange leopard-spot tunic)',
        appearance='Chubby, rounded body with an oversized head (head is about 40% of his height). Big rounded bare feet. Short stubby arms and legs.',
        colors='Skin warm tan (#E2A477). Hair dark brown (#3B2414). Tunic orange (#F0A23A) with dark-brown spots (#7A3F12). Cheeks pink (#FF9A8A).',
        proportions='About 3 heads tall. Reference height = 1.0 (all other sizes are given relative to Tuca).',
        clothing='One-shoulder orange tunic with leopard spots, strap over the right shoulder. No shoes, no jewelry, no hat.',
        face='Huge glossy brown eyes with white highlights, big round button nose, one big front tooth visible when smiling, expressive thick brows, rosy cheeks.',
        personality='Curious, brave in a small way, gentle, a little clumsy, always ready to help. Shows feelings with his whole body.',
        size='1.0 (reference).'),
    'pipoca': dict(
        name='Pipoca', role='Main character — Tuca\'s baby triceratops best friend',
        full=("Pipoca, a tiny baby triceratops only as tall as Tuca's waist, soft lime-green skin, a pale cream-yellow belly, lighter green spots along "
              "the back, a small round orange frill with a darker orange scalloped edge, two tiny cream horn nubs, huge glossy dark eyes with white "
              "highlights, pink cheek blush, chubby short legs with cream toenails, a short tapered tail, wearing a half cream eggshell with a "
              "zigzag edge as a little hat"),
        short='Pipoca (tiny lime-green baby triceratops, orange frill, cream eggshell hat)',
        appearance='Round, chubby baby dinosaur with a big head, short chunky legs and a short tail.',
        colors='Skin lime green (#9AD46A). Belly cream-yellow (#FFF1B8). Frill orange (#FFB03A) with darker scallops (#F08A2A). Back spots pale green (#C8EF9C).',
        proportions='Body is a soft oval; head is half the body length. Tail is short.',
        clothing='Always wears half of the cream eggshell it hatched from as a little hat, tilted slightly to the right.',
        face='Huge glossy dark eyes, tiny cream horn nubs, small beak-like snout, pink cheek blush, wide happy mouth.',
        personality='Playful, affectionate, easily excited, a bit impatient, very brave when a friend needs help. Wags its tail when happy.',
        size='About 0.5 of Tuca\'s height (top of its frill reaches Tuca\'s waist).'),
    'tete': dict(
        name='Mama Tetê', role='Recurring — Pipoca\'s gentle mother',
        full=("Mama Tetê, a huge gentle mother triceratops, deep leaf-green skin, a cream belly, a large orange frill with a burnt-orange scalloped rim, "
              "two long cream brow horns and a short nose horn, long dark eyelashes, pink cheeks, kind sleepy-sweet eyes and a small pink bow on her frill"),
        short='Mama Tetê (huge leaf-green mother triceratops, orange frill, eyelashes, pink bow)',
        appearance='Massive, rounded body on four thick legs; long tapering tail.', colors='Skin #5AA86A, frill #E8703A, belly cream, bow pink #FF5D8F.',
        proportions='Large head with a wide frill; body very round.', clothing='Small pink bow on the top left of her frill.',
        face='Long eyelashes, big warm eyes, pink cheeks, gentle smile.', personality='Warm, protective, patient, a little dramatic when worried.',
        size='About 3.5x Tuca\'s height at the shoulder.'),
    'bico': dict(
        name='Bico', role='Recurring — young pteranodon friend',
        full=("Bico, a young cartoon pteranodon about as tall as Tuca when standing, lavender-purple body with a pale lilac belly, large soft lavender wing "
              "membranes, a long yellow-orange beak, a red-orange crest on the back of his head, huge round goofy eyes and thin purple legs with orange toes"),
        short='Bico (young lavender pteranodon, long yellow-orange beak, red-orange crest)',
        appearance='Round little body, long beak, very long wings, skinny legs.', colors='Body #7C6FD6, wings #B3A6FF, beak #F4B334, crest #FF6A3D.',
        proportions='Wingspan about 3x Tuca\'s height.', clothing='None.', face='Huge goofy eyes, expressive beak.',
        personality='Goofy, hungry, clumsy, big-hearted, secretly unsure of himself.', size='About 1.0x Tuca\'s height when standing.'),
    'pedrao': dict(
        name='Pedrão', role='Recurring — big sleepy ankylosaurus',
        full=("Pedrão, a big gentle cartoon ankylosaurus, sandy-tan skin with a cream belly, rows of rounded brown armor studs and short cream side spikes, "
              "small sleepy half-closed eyes, a big round brown nose, short sturdy legs and a tail ending in a round brown club"),
        short='Pedrão (big sleepy sandy-tan ankylosaurus with brown armor studs and a tail club)',
        appearance='Wide, low, rounded body like a cozy armored couch.', colors='Skin #C99A5E, armor #7D5A3A, spikes cream #F1E4C4.',
        proportions='Long, low body; small head.', clothing='None.', face='Heavy sleepy eyelids, big round nose, tiny smile.',
        personality='Calm, slow, sleepy, kind, sneezes when tickled.', size='About 1.2x Tuca\'s height tall and 4x long.'),
    'nessa': dict(
        name='Nessa', role='Recurring — friendly plesiosaur of the lagoon',
        full=("Nessa, a friendly cartoon plesiosaur, turquoise-teal skin with a cream belly and darker teal spots, a very long graceful neck, a small round head "
              "with big glossy eyes, long eyelashes, pink cheeks and a gentle smile, four flippers"),
        short='Nessa (friendly turquoise plesiosaur with a long neck and eyelashes)',
        appearance='Rounded body mostly underwater, long curving neck.', colors='Skin #3FB0B8, spots #2F8A94, belly cream.',
        proportions='Neck about 4x Tuca\'s height.', clothing='None.', face='Big eyes, eyelashes, pink cheeks, sweet smile.',
        personality='Playful, giggly, gentle, loves splashing.', size='Head rises about 4x Tuca\'s height above the water.'),
}

# characters introduced in this batch (defined here so they stay consistent if they return)
NEW = {
    'glimmers': dict(
        name='Glimmers', role='New — tiny moon moths (Episode 1)',
        full=("tiny round fluffy moon moths the size of a plum, soft white fuzz, glowing pale-blue wings with silver dots, big black shiny eyes and two curly "
              "golden antennae, glowing gently like little lanterns"),
        short='Glimmers (tiny glowing pale-blue moon moths)',
        appearance='Fluffy round bodies, translucent glowing wings.', colors='White fuzz, wings #A8DCFF with silver dots, antennae gold.',
        proportions='Each about the size of Tuca\'s fist.', clothing='None.', face='Big black glossy eyes, tiny smile.',
        personality='Shy, curious, follow kindness and quiet voices.', size='Fist-sized.'),
    'pebble': dict(
        name='Pebble', role='New — baby ankylosaurus, Pedrão\'s little nephew (Episode 2)',
        full=("Pebble, a tiny round baby ankylosaurus the size of a melon, light sandy-yellow skin, soft little rounded brown armor bumps, "
              "a tiny round tail club, huge shy eyes and a small pink nose"),
        short='Pebble (melon-sized sandy-yellow baby ankylosaurus)',
        appearance='Like a tiny armored dumpling.', colors='Skin #E8C27A, bumps #9A7048.', proportions='Very round, short legs.', clothing='None.',
        face='Big shy eyes, pink nose.', personality='Shy and cautious, then joyful.', size='About 0.35x Tuca\'s height.'),
    'shelly': dict(
        name='Grandpa Shell', role='New — ancient wise turtle (Episode 3)',
        full=("Grandpa Shell, a very old giant cartoon tortoise with a mossy dome shell covered in tiny ferns and glowing blue mushrooms, a wrinkled kind face, "
              "a long white droopy mustache, round spectacles made of clear crystal and slow sleepy blinking eyes"),
        short='Grandpa Shell (ancient giant mossy tortoise with crystal spectacles and a white mustache)',
        appearance='Huge mossy shell like a small hill.', colors='Shell olive-brown with green moss, skin grey-green, mustache white.',
        proportions='Shell taller than Tuca.', clothing='Crystal round spectacles.', face='Wrinkled, warm, kind eyes, droopy white mustache.',
        personality='Patient, wise, speaks only with slow nods and smiles.', size='About 1.6x Tuca\'s height.'),
}
ALL = {**CHARS, **NEW}
