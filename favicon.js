/* Animated "kg" favicon. Drop in with <script src="favicon.js" defer></script>.
   Draws each frame on a canvas and swaps the <link rel="icon"> href, so it
   works in Chrome, Safari and Firefox (SVG/GIF favicons don't animate everywhere). */
(function (global) {
  var VIEW = { x: 0, y: 27, w: 1168, h: 1168 };
  var BG = "#1a1a1a";
  var FG = "#ffffff";

  var K = "M144 240H269V575L426 413H572L402 579L592 866H441L316 663L269 709V866H144Z";
  var G =
    "M909 413H1027V835C1027 880 1005 960 925 1005C870 1033 800 1037 760 1035" +
    "C690 1030 620 990 600 945C595 925 593 905 593 890H716C722 915 735 935 755 945" +
    "C775 954 795 954 808 953C860 952 889 925 903 880C908 865 909 855 909 845V783" +
    "C885 825 830 852 770 852C700 852 640 820 610 770C590 735 580 690 578 640" +
    "C575 560 600 480 650 440C690 408 730 400 775 400C840 400 885 430 906 470L909 473Z" +
    "M803 494C870 494 909 550 909 632C909 710 870 760 803 760C735 760 701 700 701 625" +
    "C701 550 740 494 803 494Z";

  // Timeline in seconds: k hops, then g hops, then a rest before the loop.
  var LETTERS = [
    { path: new Path2D(K), cx: 368, start: 0.0 },
    { path: new Path2D(G), cx: 802, start: 0.75 }
  ];
  var HOP = 0.9;      // duration of one letter's dance
  var PERIOD = 3.4;   // full loop, including the pause
  var LIFT = 150;     // hop height in view units
  var BASE = 866;     // baseline the letters pivot on

  function pose(t, start) {
    var p = (t - start) / HOP;
    if (p < 0 || p >= 1) return { y: 0, rot: 0, sx: 1, sy: 1 };
    var air = Math.min(p / 0.6, 1);
    var up = Math.sin(Math.PI * air);                      // main jump
    var settle = p > 0.6 ? Math.sin(Math.PI * (p - 0.6) / 0.4) * 0.22 : 0; // small rebound
    var rise = up + settle;
    return {
      y: -LIFT * rise,
      rot: 0.2 * Math.sin(2 * Math.PI * p * 1.5) * (1 - p),
      sx: 1 - 0.05 * rise,
      sy: 1 + 0.08 * rise
    };
  }

  function draw(ctx, size, t) {
    t = ((t % PERIOD) + PERIOD) % PERIOD;
    var s = size / VIEW.w;
    ctx.save();
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, size, size);
    ctx.scale(s, s);
    ctx.translate(-VIEW.x, -VIEW.y);
    ctx.fillStyle = FG;
    LETTERS.forEach(function (L) {
      var o = pose(t, L.start);
      ctx.save();
      ctx.translate(L.cx, BASE + o.y);
      ctx.rotate(o.rot);
      ctx.scale(o.sx, o.sy);
      ctx.translate(-L.cx, -BASE);
      ctx.fill(L.path, "evenodd");
      ctx.restore();
    });
    ctx.restore();
  }

  function start(opts) {
    opts = opts || {};
    var size = opts.size || 64;
    var fps = opts.fps || 15;
    var canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    var ctx = canvas.getContext("2d");

    var link = document.querySelector('link[rel~="icon"]');
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    link.type = "image/png";

    var t0 = performance.now();
    var lastRest = false;
    var timer = setInterval(function () {
      var t = ((performance.now() - t0) / 1000) % PERIOD;
      var resting = t > LETTERS[LETTERS.length - 1].start + HOP;
      if (resting && lastRest) return; // nothing changes during the pause
      lastRest = resting;
      draw(ctx, size, resting ? 0 : t);
      link.href = canvas.toDataURL("image/png");
    }, 1000 / fps);

    return function stop() { clearInterval(timer); };
  }

  global.AnimatedFavicon = { start: start, draw: draw, PERIOD: PERIOD };
  if (!global.__faviconManual) start();
})(window);
