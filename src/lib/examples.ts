export type ExampleSketch = {
  id: string;
  name: string;
  category: string;
  difficulty: number;
  accent: string;
  description: string;
  code: string;
};

export const EXAMPLES: ExampleSketch[] = [
  {
    id: 'hello-circle',
    name: 'Hello Circle',
    category: 'Basics',
    difficulty: 1,
    accent: '#5B6FE8',
    description: 'Five concentric rings pulse outward from the mouse like a sonar ping on a dark ocean.',
    code: `setup:{
  \`size\`bg!(800 600;0x0D0D1F)
}

draw:{[state;frameInfo;input;canvas]
  background[0x0D0D1F];
  p:$[null~input\`mouse;0.5*canvas\`size;input\`mouse];
  t:frameInfo\`frameNum;
  circle[([]
    p:5#enlist p;
    r:20 40 64 92 124f + 12*sin each 0.07*t+0 10 20 30 40;
    fill:5#enlist 0x5B6FE8;
    alpha:0.88 0.6 0.38 0.2 0.09
  )];
  state
}
`,
  },
  {
    id: 'color-grid',
    name: 'Color Grid',
    category: 'Basics',
    difficulty: 1,
    accent: '#C4956E',
    description: 'A tide of colour washes across a grid of tiles — each cell shifts hue every few frames.',
    code: `setup:{
  \`size\`bg!(800 600;0x0D0D1F)
}

draw:{[state;frameInfo;input;canvas]
  background[0x0D0D1F];
  nc:20; nr:15;
  cw:first[canvas\`size]%nc;
  ch:last[canvas\`size]%nr;
  idx:til nc*nr;
  palette:(0x5B6FE8;0xC4956E;0xD1694E;0x8C6BC9;0xE07A52;0x4E9F92);
  t:floor 0.03*frameInfo\`frameNum;
  clrs:palette (idx+t) mod count palette;
  rect[([]
    p:flip(cw*idx mod nc;ch*idx div nc);
    s:count[idx]#enlist (cw-2;ch-2);
    fill:clrs;
    alpha:count[idx]#0.9
  )];
  state
}
`,
  },
  {
    id: 'breathing-ring',
    name: 'Breathing Ring',
    category: 'Motion',
    difficulty: 1,
    accent: '#7C8EF2',
    description: 'Four concentric rings inhale and exhale at offset phases, like neon hula hoops in slow motion.',
    code: `setup:{
  \`size\`bg!(800 600;0x0D0D1F)
}

draw:{[state;frameInfo;input;canvas]
  background[0x0D0D1F];
  t:0.05*frameInfo\`frameNum;
  center:0.5*canvas\`size;
  circle[([]
    p:4#enlist center;
    r:(50 82 118 162f) + 22*sin each t+0.9*til 4;
    stroke:(0x5B6FE8;0x7C8EF2;0xC4956E;0xE07A52);
    weight:4#6;
    alpha:0.8 0.6 0.42 0.25
  )];
  state
}
`,
  },
  {
    id: 'line-weave',
    name: 'Line Weave',
    category: 'Primitives',
    difficulty: 1,
    accent: '#5B6FE8',
    description: 'Ten coloured lines snake across the canvas in sinusoidal waves, shifting phase every frame.',
    code: `setup:{
  \`size\`bg!(800 600;0x0D0D1F)
}

draw:{[state;frameInfo;input;canvas]
  background[0x0D0D1F];
  t:0.04*frameInfo\`frameNum;
  w:first canvas\`size;
  h:last canvas\`size;
  n:10;
  ys:h*(1+til n)%(n+1);
  palette:(0x5B6FE8;0x7C8EF2;0xC4956E;0xE07A52;0xD1694E;0x8C6BC9;0x4E9F92;0x5B6FE8;0x7C8EF2;0xC4956E);
  line[([]
    p:flip(n#0f;ys);
    p2:flip(n#w*1f;ys+0.11*h*sin each t+0.7*til n);
    stroke:palette;
    weight:n#3;
    alpha:n#0.7
  )];
  state
}
`,
  },
  {
    id: 'text-poster',
    name: 'Text Poster',
    category: 'Primitives',
    difficulty: 1,
    accent: '#C4956E',
    description: 'A typographic card stacks four lines of copy in contrasting colours on a dark ground.',
    code: `setup:{
  \`size\`bg!(800 600;0x0D0D1F)
}

draw:{[state;frameInfo;input;canvas]
  background[0x0D0D1F];
  cx:0.5*first canvas\`size;
  cy:0.5*last canvas\`size;
  text[([]
    p:((cx;cy-90);(cx;cy-34);(cx;cy+26);(cx;cy+76));
    text:("q language";"data on canvas";"think in tables";"build with q");
    fill:(0xF4ECD8;0x5B6FE8;0xC4956E;0x7C8EF2);
    alpha:4#0.95
  )];
  state
}
`,
  },
  {
    id: 'image-stamp',
    name: 'Image Stamp',
    category: 'Primitives',
    difficulty: 1,
    accent: '#8C6BC9',
    description: 'An inline SVG badge sits centred on the canvas — the image[] primitive in one focused example.',
    code: `setup:{
  img:"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 120'%3E%3Crect width='120' height='120' rx='60' fill='%231C1030'/%3E%3Ccircle cx='60' cy='44' r='18' fill='%235B6FE8'/%3E%3Ccircle cx='60' cy='60' r='44' fill='none' stroke='%238C6BC9' stroke-width='7'/%3E%3Cpath d='M26 88c10-18 58-18 68 0' stroke='%23C4956E' stroke-width='9' stroke-linecap='round' fill='none'/%3E%3C/svg%3E";
  \`size\`bg\`img!(800 600;0x0D0D1F;img)
}

draw:{[state;frameInfo;input;canvas]
  background[state\`bg];
  image[([]
    src:enlist state\`img;
    p:enlist 236 146;
    s:enlist 210 210;
    alpha:enlist 0.98
  )];
  state
}
`,
  },
  {
    id: 'particle-fountain',
    name: 'Particle Fountain',
    category: 'Motion',
    difficulty: 2,
    accent: '#E07A52',
    description: 'Six arcs of coloured sparks launch upward each frame, arcing through gravity back to earth.',
    code: `setup:{
  \`ticks\`bg!(([] x:\`float$();y:\`float$();vx:\`float$();vy:\`float$();life:\`float$());0x0D0D1F)
}

draw:{[state;frameInfo;input;canvas]
  background[state\`bg];
  width:first canvas\`size;
  height:last canvas\`size;
  vxs:-2.4 -1.2 -0.2 0.2 1.2 2.4;
  vys:-9 -7.8 -6.6 -5.8 -5.2 -4.6;
  emit:([] x:6#0.5*width; y:6#height-60f; vx:vxs; vy:vys; life:6#90f);
  ticks:(state\`ticks),emit;
  ticks:update x:x+vx,y:y+vy,vy:vy+0.22,life:life-1 from ticks;
  ticks:select from ticks where life>0;
  palette:(0xE07A52;0x5B6FE8;0xC4956E;0x8C6BC9;0x4E9F92;0xD1694E);
  clrs:palette (til count ticks) mod count palette;
  circle[([] p:flip(ticks\`x;ticks\`y); r:3+0.07*ticks\`life; fill:fills; alpha:(count ticks)#0.88)];
  \`ticks\`bg!(ticks;state\`bg)
}
`,
  },
  {
    id: 'click-painter',
    name: 'Click Painter',
    category: 'Interaction',
    difficulty: 2,
    accent: '#D1694E',
    description: 'Click to stamp circles that grow and cycle through a six-colour palette — your canvas, your rules.',
    code: `setup:{
  \`marks\`bg!(([] p:();r:\`float$());0x0D0D1F)
}

draw:{[state;frameInfo;input;canvas]
  marks:state\`marks;
  if[(input\`mouseButtons)\`left;
    marks,:([] p:enlist input\`mouse; r:enlist 12f+10*count[marks] mod 5)
  ];
  background[state\`bg];
  palette:(0x5B6FE8;0xE07A52;0xC4956E;0x8C6BC9;0x4E9F92;0xD1694E);
  clrs:palette (til count marks) mod count palette;
  circle[([] p:marks\`p; r:marks\`r; fill:fills; alpha:(count marks)#0.88)];
  \`marks\`bg!(marks;state\`bg)
}
`,
  },
  {
    id: 'drag-trail',
    name: 'Drag Trail',
    category: 'Interaction',
    difficulty: 2,
    accent: '#8C6BC9',
    description: 'Drag to paint a rainbow ribbon that fades out — each segment cycles through a vivid palette.',
    code: `setup:{
  \`trail\`bg!(([] p:();life:\`float$());0x0D0D1F)
}

draw:{[state;frameInfo;input;canvas]
  trail:state\`trail;
  if[(input\`mouseButtons)\`left;
    trail,:([] p:enlist input\`mouse; life:enlist 64f)
  ];
  trail:update life:life-1 from trail;
  trail:select from trail where life>0;
  background[state\`bg];
  circle[([] p:trail\`p; r:8+0.2*trail\`life; fill:count[trail]#enlist 0x8C6BC9; alpha:count[trail]#0.82)];
  \`trail\`bg!(trail;state\`bg)
}
`,
  },
];
