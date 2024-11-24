requirejs.config({
  baseUrl: "media/js",
  paths: {
    jquery: "https://ajax.googleapis.com/ajax/libs/jquery/2.1.4/jquery.min",
    mathjs: "https://cdnjs.cloudflare.com/ajax/libs/mathjs/2.4.0/math.min",
    underscore:
      "https://cdnjs.cloudflare.com/ajax/libs/underscore.js/1.8.3/underscore-min",
    "jquery-transit":
      "https://cdnjs.cloudflare.com/ajax/libs/jquery.transit/0.9.12/jquery.transit.min",
  },
});

define([
  "jquery",
  "underscore",
  "./newtons",
  "./mandelbrot",
  "./life",
  "jquery-transit",
], function ($, _, newtons, mandelbrot, life_module) {
  var getWindowDimensions = function () {
    var winW, winH;

    if (document.body && document.body.offsetWidth) {
      winW = document.body.offsetWidth;
      winH = document.body.offsetHeight;
    }
    if (
      document.compatMode == "CSS1Compat" &&
      document.documentElement &&
      document.documentElement.offsetWidth
    ) {
      winW = document.documentElement.offsetWidth;
      winH = document.documentElement.offsetHeight;
    }
    if (window.innerWidth && window.innerHeight) {
      winW = window.innerWidth;
      winH = window.innerHeight;
    }
    return [winW, winH];
  };

  var getDocumentDimensions = function () {
    var D = document,
      h,
      w;
    w = Math.max(
      Math.max(D.body.scrollWidth, D.documentElement.scrollWidth),
      Math.max(D.body.offsetWidth, D.documentElement.offsetWidth),
      Math.max(D.body.clientWidth, D.documentElement.clientWidth)
    );
    h = Math.max(
      Math.max(D.body.scrollHeight, D.documentElement.scrollHeight),
      Math.max(D.body.offsetHeight, D.documentElement.offsetHeight),
      Math.max(D.body.clientHeight, D.documentElement.clientHeight)
    );
    if (w === undefined) {
      return getWindowDimensions();
    }
    return [w, h];
  };

  var $canvasElement = $("#fractal-canvas"),
    canvasElement = $canvasElement.get(0);

  var canvasWidth = 300,
    canvasHeight = 300,
    //documentDims[0];
    //documentDims[1] - 1;
    documentDims = getDocumentDimensions(),
    canvasContext = canvasElement.getContext("2d");

  canvasWidth = documentDims[0];
  canvasHeight = documentDims[1];

  canvasElement.width = canvasWidth;
  canvasElement.height = canvasHeight;
  $canvasElement.width(canvasWidth);
  $canvasElement.height(canvasHeight);
  $canvasElement.parent().width(canvasWidth);
  $canvasElement.parent().height(canvasHeight);

  canvasContext.imageSmoothingEnabled = false;

  var aCoefficient = 1;
  var polynomial = [-1, 0, 0, 0, 0, 1];
  polynomial = [-1, 0, 0, 0, 0, 1];
  polynomial = [-1, 0, 0, 1];
  aCoefficient = 1;
  //polynomial = [-16, 0, 0, 0, 15, 0, 0, 0, 1];

  var imageData = canvasContext.createImageData(
    canvasElement.width,
    canvasElement.height
  );

  window.data = imageData;
  window.canvasContext = canvasContext;
  window.newtons = newtons;
  window.canvas = canvasElement;
  window.$canvas = $canvasElement;

  var currentMode = "newtons";

  var redrawNewtons, redrawMandelbrot;

  var resetNewtons = function () {
    var centreRe = 0,
      centreIm = 0,
      widthRe = 8,
      speedX = -0.5,
      speedY = -0.028,
      scaleFactor = 0.97,
      drawnAtLeastOnce = false,
      fractalData = {};

    speedX = 0;
    speedY = 0;
    scaleFactor = 0.7;

    redrawNewtons = function () {
      newtons
        .draw({
          imageData: imageData,
          options: {
            polynomial: polynomial,
            polynomialFunction: fractalData.polynomialFunction,
            iterationFunction: fractalData.iterationFunction,
            derivative: fractalData.derivative,
            aCoefficient: aCoefficient,
            centreRe: centreRe,
            centreIm: centreIm,
            widthRe: widthRe,
            maxIters: 100,
            roots: fractalData.roots,
            profileEnabled: false,
          },
        })
        .then(function (fractalDataNew) {
          if (currentMode === "newtons") {
            fractalData = fractalDataNew;

            drawnAtLeastOnce = true;
            centreRe += speedX;
            centreIm += speedY;
            widthRe *= scaleFactor;
            canvasContext.putImageData(fractalDataNew.imageData, 0, 0);
            //_.delay(drawAndUpdate, 100);
          }
        });
    };
  };

  var resetMandelbrot = function () {
    var re = 0,
      im = 0,
      width = 4,
      scaleStep = 0.6,
      canvas = document.getElementById("fractal-canvas"),
      $canvas = $(canvas);

    console.log(canvas.width);
    console.log(canvas.height);

    re = 0.3245046418497685;
    im = 0.04855101129280834;

    re = 0.001643721971153;
    im = -0.822467633298876;

    re = 0.28693186889504513;
    im = 0.014286693904085048;

    re = -0.415;
    im = -0.683;

    re = -0.09356364426984008;
    im = -0.8461845258547207;
    //width = 0.25 / (1 << 8);
    re = 0.001643721971153;
    im = -0.822467633298876;

    var options = {
      reCentre: re,
      imCentre: im,
      widthRe: width,
      maxIters: 1000,
      profileEnabled: false,
      onProgress: function (progress) {
        var newScale = 1 + progress * (1 / scaleStep - 1);
        $canvasElement.transition({ scale: newScale }, 0);
      },
    };

    var needToUpdateExpectedRedrawTime = true,
      approximatedRedrawTime = 2000;

    var latestDrawnImage;
    var drawingInProgress = false;
    var transitionInProgress = false;

    var redrawMandelbrotOnce = function (autoRepeat) {
      if (drawingInProgress) {
        return;
      }

      drawingInProgress = true;
      mandelbrot.draw(imageData, options).then(function (fractalDataNew) {
        console.log("Redraw ended:", transitionInProgress, drawingInProgress);
        latestDrawnImage = fractalDataNew.imageData;

        drawingInProgress = false;
        if (transitionInProgress) {
          console.log("Transition still not finished, returning");
          return;
        } else {
          // Need to adjust redraw time because we draw slower than transition
          approximatedRedrawTime = Math.max(
            approximatedRedrawTime,
            fractalDataNew.timeSpent * 1.5
          );
          console.log(
            "Redraw finished last, initiate a new run, new redraw time:",
            approximatedRedrawTime
          );
          $canvasElement.transition({ scale: 1 }, 0);
          canvasContext.putImageData(latestDrawnImage, 0, 0);
          options.widthRe = options.widthRe * scaleStep;
          if (autoRepeat && currentMode === "mandelbrot") {
            _.defer(transit, autoRepeat);
            _.defer(redrawMandelbrotOnce, autoRepeat);
          }
        }
      });
    };

    var transit = function (autoRepeat) {
      if (transitionInProgress) {
        return;
      }

      transitionInProgress = true;
      $canvasElement.transition(
        { scale: 1 / scaleStep },
        approximatedRedrawTime,
        "linear",
        function () {
          console.log(
            "Transition ended:",
            transitionInProgress,
            drawingInProgress
          );
          transitionInProgress = false;
          if (drawingInProgress) {
            console.log("Redrawing still not finished, returning");
            return;
          } else {
            console.log("Transition finished last, initiate a new run");
            $canvasElement.transition({ scale: 1 }, 0);
            canvasContext.putImageData(latestDrawnImage, 0, 0);
            options.widthRe = options.widthRe * scaleStep;
            if (autoRepeat && currentMode === "mandelbrot") {
              _.defer(transit, autoRepeat);
              _.defer(redrawMandelbrotOnce, autoRepeat);
            }
          }
        }
      );
    };

    redrawMandelbrot = function () {
      _.defer(redrawMandelbrotOnce, true);
    };

    /*
        $("#fractal-canvas").click(function (eventData) {
            var screenX = eventData.pageX,
            screenY = eventData.pageY;

            var re0 = options.reCentre - options.widthRe / 2,
                im0 = options.imCentre - (options.widthRe * canvas.height / (2 * canvas.width));

            var newCentre = mandelbrot.coordinateToComplex(screenX, screenY, re0, im0, options.widthRe, canvas.width);
            options.reCentre = newCentre.re;
            options.imCentre = newCentre.im;
        });
        */
  };

  resetNewtons();
  resetMandelbrot();

  $(".fractal-enable-newtons").click(function () {
    currentMode = "newtons";
    _.defer(redrawNewtons);
  });

  $(".fractal-enable-mandelbrot").click(function () {
    currentMode = "mandelbrot";
    _.defer(redrawMandelbrot);
  });

  $(".fractal-disable-animation").click(function () {
    currentMode = null;
  });

  $(document).ready(function () {
    const params = new URLSearchParams(window.location.search);
    if (params.has("fractal")) {
      $("#fractal-canvas-container").show();
      $("#life-controls").hide();
      currentMode = "mandelbrot";
      _.defer(redrawMandelbrot);
    } else {
      $("#life-canvas-container").show();
      const life = new life_module.Life(
        document.getElementById("life_canvas"),
        {
          live_color: "#dbdbdb",
          //random_rounds: 500,
          initial_draw: true,
          fill_random: true,
          redraw_interval: 1000,
          decide_function: life_module.make_decider([2, 3], [3]), // classic life game, example of make_decider
        }
      );

      $("#life-control-slower").click(function () {
        life.slower();
      });
      $("#life-control-toggle").click(function () {
        life.toggle();
      });
      $("#life-control-faster").click(function () {
        life.faster();
      });

      life.start();
    }
  });

  /*
    $(window).resize(function () {
        console.log("WINDOW RESIZED",  $(document).width(), $(document).height(), $(window).width(), $(window).height());
        var w = $(window).width(),
            h = $(window).height();

        $canvasElement.width(w);
        canvasElement.width = w;
        $canvasElement.height(h);
        canvasElement.height = h;
        imageData = canvasContext.createImageData(canvasElement.width, canvasElement.height);
    });
    */
});
