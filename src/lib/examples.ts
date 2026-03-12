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
    description: 'A friendly circle follows the mouse and gives the canvas a first pulse of life.',
    code: `setup:{
  \`size\`bg!(800 600;0xF4ECD8)
}

draw:{[state;frameInfo;input;canvas]
  background[0xF4ECD8];
  circle[([]
    p:enlist input\`mouse;
    r:enlist 42;
    fill:enlist 0x5B6FE8;
    alpha:enlist 0.9
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
    description: 'A position-based color study that turns the canvas into a warm geometric quilt.',
    code: `setup:{
  \`size\`bg!(800 600;0xF4ECD8)
}

draw:{[state;frameInfo;input;canvas]
  background[0xF4ECD8];
  idx:til 18*14;
  palette:(0x5B6FE8;0xC4956E;0xD1694E;0x8C6BC9);
  tiles:([]
    p:{(40*x mod 18;40*x div 18)} each idx;
    s:count[idx]#enlist 36 36;
    fill:palette idx mod count palette;
    alpha:count[idx]#0.72
  );
  rect[tiles];
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
    description: 'A single ring expands and contracts with a soft sinusoidal inhale-exhale rhythm.',
    code: `setup:{
  \`size\`bg!(800 600;0xF4ECD8)
}

draw:{[state;frameInfo;input;canvas]
  background[0xF4ECD8];
  circle[([]
    p:enlist 0.5*canvas\`size;
    r:enlist 92 + 24*sin 0.05*frameInfo\`frameNum;
    stroke:enlist 0x5B6FE8;
    weight:enlist 7;
    alpha:enlist 0.88
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
    description: 'A small study of layered strokes so the line primitive has a clear, working example.',
    code: `setup:{
  \`size\`bg!(800 600;0xF4ECD8)
}

draw:{[state;frameInfo;input;canvas]
  background[0xF4ECD8];
  line[([]
    p:((120 170);(120 300);(120 430));
    p2:((520 170);(520 300);(520 430));
    stroke:(0x5B6FE8;0xC4956E;0xD1694E);
    weight:3 6 9;
    alpha:3#0.84
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
    description: 'A simple typographic card that exercises the text primitive directly.',
    code: `setup:{
  \`size\`bg!(800 600;0xF4ECD8)
}

draw:{[state;frameInfo;input;canvas]
  background[0xF4ECD8];
  text[([]
    p:((132 214);(132 250);(132 304));
    text:("Qanvas5";"real q sketches";"text[] primitive");
    fill:(0x2C2520;0x7A6E62;0x5B6FE8);
    alpha:3#0.94
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
    description: 'Embeds a tiny inline SVG so the image primitive has a working example too.',
    code: `setup:{
  img:"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 120'%3E%3Crect width='120' height='120' rx='24' fill='%23C4956E'/%3E%3Ccircle cx='60' cy='60' r='28' fill='%235B6FE8'/%3E%3Cpath d='M24 92c16-18 56-18 72 0' stroke='%23F4ECD8' stroke-width='10' stroke-linecap='round' fill='none'/%3E%3C/svg%3E";
  \`size\`bg\`img!(800 600;0xF4ECD8;img)
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
    description: 'Little sparks launch upward, arc back down, and gather into a lively fountain.',
    code: `setup:{
  \`ticks\`bg!(([] x:\`float$();y:\`float$();vx:\`float$();vy:\`float$();life:\`float$());0xF4ECD8)
}

draw:{[state;frameInfo;input;canvas]
  background[state\`bg];
  width:first canvas\`size;
  height:last canvas\`size;
  emit:([] x:4#0.5*width; y:4#(height-56); vx:-1.6 -0.4 0.4 1.6; vy:-7.8 -6.6 -5.4 -4.8; life:4#72f);
  ticks:(state\`ticks),emit;
  ticks:update x:x+vx,y:y+vy,vy:vy+0.18,life:life-1 from ticks;
  ticks:select from ticks where life>0;
  circle[([] p:flip(ticks\`x;ticks\`y); r:4+0.12*ticks\`life; fill:count[ticks]#enlist 0xE07A52; alpha:count[ticks]#0.9)];
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
    description: 'Each click places a persistent circle so the sketch becomes a shared digital sketchbook.',
    code: `setup:{
  \`marks\`bg!(([] p:();r:\`float$();fill:());0xF4ECD8)
}

draw:{[state;frameInfo;input;canvas]
  marks:state\`marks;
  if[(input\`mouseButtons)\`left;
    marks,:([] p:enlist input\`mouse; r:enlist 24f+4*count marks; fill:enlist 0xD1694E);
  ];
  background[state\`bg];
  circle[([] p:marks\`p; r:marks\`r; fill:marks\`fill; alpha:count[marks]#0.88)];
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
    description: 'Drag across the canvas to leave a fading ribbon of circles that slowly disappears.',
    code: `setup:{
  \`trail\`bg!(([] p:();life:\`float$());0xF4ECD8)
}

draw:{[state;frameInfo;input;canvas]
  trail:state\`trail;
  if[(input\`mouseButtons)\`left; trail,:([] p:enlist input\`mouse; life:enlist 56f)];
  trail:update life:life-1 from trail;
  trail:select from trail where life>0;
  background[state\`bg];
  circle[([] p:trail\`p; r:8+0.2*trail\`life; fill:count[trail]#enlist 0x8C6BC9; alpha:count[trail]#0.82)];
  \`trail\`bg!(trail;state\`bg)
}
`,
  },
];
