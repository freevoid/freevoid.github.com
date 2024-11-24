define(["jquery", "underscore"], function ($, _) {

    return {
        parseIntAsRGBA: function (color) {
            var components = [];
            for (var i = 0; i < 4; i++) {
                components.push((color >> 8*(3 - i)) & 255);
            }
            return components;
        },

        coordinateToComplex: function (x, y, re0, im0, reWidth, width) {
            var c = reWidth / width;
            return {
                re: re0 + c * x,
                im: im0 + c * y
            };
        },

        scaleCoordinate: function (x, y, re0, im0, scaleFactor) {
            return {
                re: re0 + scaleFactor * x,
                im: im0 + scaleFactor * y
            };
        },

        getColorFromHue: function (hue, iters, maxIters) {
            if (iters === maxIters) {
                return [0, 0, 0, 255];
            }

            return this.hslToRgba(
                Math.max(0, (200 - 200*hue) / 360),
                0.4,
                0.5
            );
        },

        getColor: function (iters, maxIters) {
            return [0, 0, Math.max(0, Math.floor(255 - 10*iters)), 255];
        },

        getColorHSL: function (iters, maxIters) {
            if (iters === maxIters) {
                return [0, 0, 0, 255];
            }

            return this.hslToRgba(
                Math.max(0, (200 - 0.7*iters) / 360),
                0.4,
                0.5
            );
        },

        hue2rgb: function (p, q, t){
            if(t < 0) t += 1;
            if(t > 1) t -= 1;
            if(t < 1/6) return p + (q - p) * 6 * t;
            if(t < 1/2) return q;
            if(t < 2/3) return p + (q - p) * (2/3 - t) * 6;
            return p;
        },

        hslToRgba: function (h, s, l) {
            var r, g, b;

            if (s === 0) {
                r = g = b = l; // achromatic
            } else {

                var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
                var p = 2 * l - q;
                r = this.hue2rgb(p, q, h + 1/3);
                g = this.hue2rgb(p, q, h);
                b = this.hue2rgb(p, q, h - 1/3);
            }

            return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255), 255];
        },

        putPixel: function (imageData, x, y, color) {
            var position = 4 * (y * imageData.width + x);

            imageData.data[position] = color[0];
            imageData.data[position + 1] = color[1];
            imageData.data[position + 2] = color[2];
            imageData.data[position + 3] = color[3];
        },

        draw: function (imageData, options) {
            var startTime = window.performance.now();
            var this_ = this;
            var screenX, screenY, iterations, rowIterationsMap;
            var log2 = Math.log(2);
            var width = imageData.width,
                height = imageData.height;

            var reCentre = options.reCentre || 0,
                imCentre = options.imCentre || 0,
                widthRe = options.widthRe || 3.5,
                maxIters = options.maxIters || 100,
                useHistogram = options.useHistogram || false,
                onProgress = options.onProgress;
            var profileEnabled = options.profileEnabled || false;

            var re0 = reCentre - widthRe / 2,
                im0 = imCentre - (widthRe * height / (2 * width));

            var histogram = [], iterationsMap = {}, total = 0.0;
            if (useHistogram) {
                _.each(_.range(maxIters), function () { histogram.push(0); });
            }

            var scaleFactor = widthRe / width;

            var fillRow = function (screenX) {
                rowIterationsMap = iterationsMap[screenX] = {};
                for (screenY = 0; screenY < height; screenY++) {
                    iterations = 0;
                    var c0 = this_.scaleCoordinate(screenX, screenY, re0, im0, scaleFactor),
                        x0 = c0.re,
                        y0 = c0.im,
                        x = 0.0,
                        y = 0.0;

                    var q = (x0 - 0.25)*(x0 - 0.25) + y0 * y0;
                    if ((q * (q + (x0 - 0.25)) < y0 * y0 / 4) || ((x0 + 1) * (x0 + 1) + y0 * y0 < 1/16))
                    {
                        iterations = maxIters;
                    }
                    else
                    {
                        while ( x*x + y*y < 4 && iterations < maxIters)
                        {
                            var xtemp = x*x - y*y + x0;//,
                            y = 2*x*y + y0;

                            /*
                            if (Math.abs(x - xtemp) < 1e-10 && Math.abs(y - ytemp) < 1e-10)
                            {
                                iterations = maxIters;
                                break;
                            }*/

                            x = xtemp;
                            //y = ytemp;
                            iterations++;
                        }
                    }

                    var realIterations = iterations;

                    if (iterations < maxIters) {
                        // sqrt of inner term removed using log simplification rules.
                        log_zn = Math.log(x*x + y*y) / 2;
                        nu = Math.log(log_zn / log2) / log2;
                        // Rearranging the potential function.
                        // Dividing log_zn by log(2) instead of log(N = 1<<8)
                        // because we want the entire palette to range from the
                        // center to radius 2, NOT our bailout radius.
                        realIterations = iterations + 1 - nu;
                    }

                    if (useHistogram) {
                        rowIterationsMap[screenY] = realIterations;
                        histogram[iterations]++;
                        total += 1;
                    } else {
                        color = this_.getColorHSL(realIterations, maxIters);
                        this_.putPixel(imageData, screenX, screenY, color);
                    }
                }
            };

            var mandelbrotPass2 = function () {
                for (screenX = 0; screenX < width; screenX++) {
                    rowIterationsMap = iterationsMap[screenX];
                    for (screenY = 0; screenY < height; screenY++) {
                        iterations = rowIterationsMap[screenY];
                        var color;

                        if (useHistogram) {
                            var hue = 0.0;
                            var intIters = Math.floor(iterations);
                            for (var i = 0; i < intIters; i++) {
                                hue += histogram[i];
                            }

                            var progressInIteration = iterations - intIters;
                            var smoothHue = progressInIteration * histogram[intIters];

                            hue += smoothHue;
                            hue /= total;
                            color = this_.getColorFromHue(hue, iterations, maxIters);
                        } else {
                            color = this_.getColorHSL(iterations, maxIters);
                        }
                        this_.putPixel(imageData, screenX, screenY, color);
                    }
                }

                console.log("PASS2: DONE", options.reCentre, options.imCentre, options.widthRe, window.performance.now() - startTime);
            };

            return new Promise(function (fulfill, reject) {
                var fractalContext = {
                    imageData: imageData
                };

                var deferredFillRow = function (i) {
                    if (i >= width) {
                        if (profileEnabled && typeof console.profile !== "undefined") {
                            console.profileEnd('mandelbrot');
                        }
                        console.log("Mandelbrot: time spent:", window.performance.now() - startTime);
                        if (useHistogram) {
                            mandelbrotPass2();
                        }

                        if (typeof onProgress === "function") {
                            onProgress(1.0);
                        }

                        fractalContext.timeSpent = window.performance.now() - startTime;

                        fulfill(fractalContext);
                        return;
                    }

                    if (profileEnabled && i === 0 && typeof console.profile !== "undefined") {
                        console.profile('mandelbrot');
                    }
                    for (var j = i; j < width && j < i + 40; j++) {
                        fillRow(j);
                        if (j % 10 === 0 && typeof onProgress === "function") {
                            var progress = j / width;
                            onProgress(progress);
                        }
                    }

                    _.defer(deferredFillRow, i + 40);
                };

                _.defer(deferredFillRow, 0);
            });
        }
    };
});
