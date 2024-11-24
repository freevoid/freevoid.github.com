define(["mathjs", "underscore"], function (mathjs, _) {
    console.log("Newton's fractals initialization");

    window.mathjs = mathjs;

    var defaultPolynomial = [-1, 0, 0, 3],
        defaultMaxIters = 20,
        defaultCentreRe = 0,
        defaultCentreIm = 0,
        defaultWidthRe = 8,
        imageDataPixelSize = 4,
        colorsWheel = [
            0x268BD2FF,
            0xDC322FFF,
            0x859900FF,
            0x6C71C4FF,
            0xB58900FF,
            0xCB4B16FF,
            0x2AA198FF,
            0xFDF6E3FF,
            0x586E75FF
        ];

    return {
        epsilon: 1e-5,
        logEpsilon: mathjs.log(1e-5),

        unreachableColor: 0x000000FF,

        complexAlmostEqual: function (x, y) {
            var xc = mathjs.complex(x),
                yc = mathjs.complex(y);
            return Math.abs(xc.re - yc.re) < this.epsilon && Math.abs(xc.im - yc.im) < this.epsilon;
        },

        complexAlmostZero: function (x) {
            return mathjs.abs(x) < this.epsilon;
        },

        findRoot: function (x0, f, iterationFunction, maxIters) {
            var x = x0,
                iter = 0,
                root = null,
                fval = null,
                fabs = null,
                df = null,
                prevfabs = null,
                extraIter = 0;

            while (iter < maxIters) {
                fval = f(x);
                fabs = mathjs.abs(fval);
                if (fabs < this.epsilon)
                {
                    if (prevfabs !== null) {
                        var logprev = mathjs.log(prevfabs),
                            logcurrent = mathjs.log(fabs);

                        extraIter = (this.logEpsilon - logprev) / (logcurrent - logprev);
                    }

                    root = x;
                    break;
                }

                x = iterationFunction(fval, x);
                prevfabs = fabs;
                iter++;
            }

            return [root, iter + extraIter];
        },

        findClosestNumber: function (array, x) {
            for (var i = 0; i < array.length; i++)
            {
                if (this.complexAlmostEqual(array[i], x)) {
                    return i;
                }
            }

            return -1;
        },

        polyEval: function (poly, x) {
            var membersToSum = _.map(poly, function (a, i) {
                if (i === 0) {
                    return a;
                }

                if (a === 0) {
                    return 0;
                }

                return mathjs.multiply(a, mathjs.pow(x, i));
            });

            return _.reduce(membersToSum, function (x, y) { return mathjs.add(x, y); }, 0);
        },

        polyAdd: function (poly1, poly2) {
            // (3x^2 + 2x + 5) + (2x^2 + x - 2) represented by
            // [5, 2, 3], [-2, 1, 2]
            // Result should be
            // [3, 3, 5]
            var smallerLength = Math.min(poly1.length, poly2.length);
            var result = [];
            for (var i = 0; i < smallerLength; i++) {
                result.push(mathjs.add(poly1[i], poly2[i]));
            }

            var biggerPoly = (poly2.length > poly1.length) ? poly2 : poly1;
            for (i = smallerLength; i < biggerPoly.length; i++) {
                result.push(biggerPoly[i]);
            }

            return result;
        },

        polyMultiply: function (poly1, poly2) {
            // (3x^2 + 2x + 5)(2x^2 + x - 2) represented by
            // [5, 2, 3], [-2, 1, 2]
            // Result should be
            // [-10, -4, -6] + [0, 5, 2, 3] + [0, 0, 10, 4, 6]
            // [-10, 1, 6, 7, 6]
            var polysToSum = [];
            for (var i = 0; i < poly1.length; i++)
            {
                var multiplier = poly1[i];
                var intermediate = [];
                for (var j = 0; j < i; j++)
                {
                    intermediate.push(0);
                }

                for (j = 0; j < poly2.length; j++)
                {
                    intermediate.push(mathjs.multiply(multiplier, poly2[j]));
                }

                polysToSum.push(intermediate);
            }

            return _.reduce(polysToSum, this.polyAdd, []);
        },

        getPolynomialFromRoots: function (roots) {
            var polysToMultiply = _.map(roots, function (x) {
                return [mathjs.complex(x), -1];
            });

            var this_ = this;
            var result = [1];
            _.each(polysToMultiply, function (poly) {
                result = this_.polyMultiply(result, poly);
            });

            return result;
        },

        getPolynomialDerivative: function (polynomial) {
            return _.map(_.drop(polynomial, 1), function (a, i) {
                return mathjs.multiply((i + 1), a);
            });
        },

        getPolynomialRepr: function (polynomial) {
            return _.filter(
                _.map(polynomial, function (a, i) {
                    if (a === 0) {
                        return null;
                    } else if (i === 0) {
                        return a.toString();
                    } else if (i === 1) {
                        return (a === 1 ? 'x' : a.toString() + '*x');
                    } else {
                        return (a === 1 ? 'x^' + i.toString() : a.toString() + '*x^' + i.toString());
                    }
                }),
                function (s) { return s !== null; } ).join(' + ');
        },

        getPolynomialFunction: function (polynomial) {
            var fRepr = '(' + this.getPolynomialRepr(polynomial) + ')';
            var f = mathjs.parse(fRepr).compile();
            return function (x) {
                return f.eval({x: x});
            };
        },

        getPartialIterationFunction: function (derivative, aCoefficient) {
            var fRepr = (aCoefficient === 1) ? 'f' : aCoefficient.toString() + '*f';
            var dfRepr = '(' + this.getPolynomialRepr(derivative) + ')';
            var nextIterRepr = 'x - ' + fRepr + '/' + dfRepr;
            var nextIterExpression = mathjs.parse(nextIterRepr).compile();
            return function (poly, x) {
                return nextIterExpression.eval({f: poly, x: x});
            };
        },

        setImageDataPixel: function (data, x, y, color) {
            var pixelPosition =
                    (y * data.width * imageDataPixelSize) + (x * imageDataPixelSize);

            _.each(_.range(4), function (i) {
                var component =
                  typeof color === "number" ?
                  (color >> 8*(3 - i)) & 255 :
                  color[i];
                data.data[pixelPosition + i] = component;
            });
        },

        draw: function (params) {
            var imageData = params.imageData;
            if (typeof imageData === "undefined" || imageData === null)
            {
                console.error("draw functions lacks imageData parameter.");
                return;
            }

            var options = params.options || {};

            console.log(imageData);
            var profileEnabled = options.profileEnabled || false;
            var roots = options.roots;
            var polynomial = options.polynomial;
            if (typeof polynomial === "undefined" || polynomial === null) {
                if (typeof roots !== "undefined" && roots !== null) {
                    polynomial = this.getPolynomialFromRoots(roots);
                } else {
                    polynomial = defaultPolynomial;
                }
            }

            var maxIters = options.maxIters || defaultMaxIters,
                shadeFactor = options.shadeFactor || 0.9,
                widthRe = typeof options.widthRe !== "undefined" && options.widthRe  || defaultWidthRe,
                centreRe = typeof options.centreRe !== "undefined" && options.centreRe  || defaultCentreRe,
                centreIm = typeof options.centreIm !== "undefined" && options.centreIm  || defaultCentreIm,
                aCoefficient = typeof options.aCoefficient !== "undefined" && options.aCoefficient || 1;

            var derivative = options.derivative || this.getPolynomialDerivative(polynomial);
            var polynomialFunction = options.polynomialFunction || this.getPolynomialFunction(polynomial);
            var iterationFunction = options.iterationFunction || this.getPartialIterationFunction(derivative, aCoefficient);
            
            console.log("Polynomial:", this.getPolynomialRepr(polynomial));
            console.log("Derivative:", this.getPolynomialRepr(derivative));

            var startRe = centreRe - widthRe*0.5,
                endRe = startRe + widthRe,
                stepRe = widthRe / imageData.width,
                stepIm = stepRe,
                startIm = centreIm - (imageData.height*0.5*stepIm);

            roots = roots || [];

            var iterSum = 0;
            var this_ = this;

            var fillRow = function (i) {
                var re = startRe + i * stepRe;
                for (var j = 0; j < imageData.height; j++)
                {
                    var im = startIm + j * stepIm;
                    var x0 = mathjs.complex(re, im);
                    var rootAndIter = this_.findRoot(x0, polynomialFunction, iterationFunction, maxIters),
                        root = rootAndIter[0],
                        iter = rootAndIter[1];

                    iterSum += iter;

                    var color = this_.unreachableColor;
                    if (root !== null)
                    {
                        var rootIndex = this_.findClosestNumber(roots, root);
                        if (rootIndex === -1 && roots.length < colorsWheel.length) {
                            console.log("See this root for the first time:", root);
                            rootIndex = roots.length;
                            roots.push(root);
                        }

                        if (((i % 99) === 0) && ((j % 99) === 0)) {
                            console.log(i, j, re, im, iter, rootIndex, color);
                        }

                        color = this_.parseIntAsRGBA(colorsWheel[rootIndex % colorsWheel.length]);
                        color = this_.shadeColor(color, iter, shadeFactor);
                    }

                    this_.setImageDataPixel(imageData, i, j, color);
                }
            };

            var elapsed = window.performance.now();
            return new Promise(function (fulfill, reject) {
                var fractalContext = {
                    imageData: imageData,
                    polynomial: polynomial,
                    derivative: derivative,
                    roots: roots,
                    polynomialFunction: polynomialFunction,
                    iterationFunction: iterationFunction
                };

                var deferredFillRow = function (i) {
                    if (i == imageData.width) {
                        console.log("Done drawing Newtons fractal! Average iterations:", iterSum / (imageData.width * imageData.height));
                        console.log("Newton's: Time spent:", window.performance.now() - elapsed);
                        fulfill(fractalContext);
                        return;
                    }

                    if (profileEnabled && i === 0 && typeof console.profile !== "undefined") {
                        console.profile();
                        fillRow(i);
                        console.profileEnd();
                    } else {
                        fillRow(i);
                    }
                    console.profileEnd();
                    _.defer(deferredFillRow, i + 1);
                };

                _.defer(deferredFillRow, 0);
            });
        },

        parseIntAsRGBA: function (color) {
            var components = [];
            for (var i = 0; i < 4; i++) {
                components.push((color >> 8*(3 - i)) & 255);
            }
            return components;
        },

        shadeColor: function (color, iterations, shadeFactor) {
            var totalShadeFactor = Math.pow(shadeFactor, iterations);
            for (var i = 0; i < 3; i++) {
                color[i] *= totalShadeFactor;
            }

            return color;
        }
    };
});
