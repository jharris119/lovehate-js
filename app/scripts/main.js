/* global _, Raphael, colors: true */
/* exported lovehate */

function lovehate(canvas, opts) {
    'use strict';

    var paper = Raphael(canvas, 550, 300);  // jshint ignore:line
    var x, y, person;

    var height = paper.height,
        width  = paper.width;

    var opts = opts || {};

    var delay = Math.floor(1000 / 16);  

    colors = _.shuffle(colors);

    /**
     * @static
     */
    Person.id = 1;

    var people;

    /**
     * Initialization function.
     *
     * @public
     * @param {{count: Number, radius: Number}} - initial parameters
     */
    function initialize(opts) {
        paper.clear();
        people = [];

        opts = _.extend({
            count:  5,
            radius: 10,
        }, opts || {});

        while (people.length < opts.count) {
            x = _.random(opts.radius, width - opts.radius);
            y = _.random(opts.radius, height - opts.radius);

            if (_.any(people, _.partial(collides, {'x': x, 'y': y, 'radius': opts.radius}))) {
                continue;
            }

            person = new Person(x, y, opts.radius/* , vector */);
            people.push(person);
        }

        // don't start animating until all people are created -- i.e., call startAll only
        // after people.length people are created
        var startAfter = _.after(people.length, startAll);

        // once they're initialized, assign each one a random person to love and hate
        _.each(people, function(person) {
            var tmp;
            
            while ((tmp = _.sample(people)) === person) {}
            person.attracted(tmp);

            while ((tmp = _.sample(people)) === person || tmp === person.attracted()) {}
            person.repelled(tmp);

            person.svggroup = new SVGGroup(person);
            startAfter();
        });
    }

    /**
     * Do two people-like interface things occupy the same space?
     *
     * @param {{x: Number, y: Number, radius: Number}} p - a person-like interface thing
     * @param {{x: Number, y: Number, radius: Number}} q - another person-like thing
     * @return {boolean} - true if p and q occupy the same space, falsy otherwise or if p == q
     */
    function collides(p, q) {
        if (p === q) {
            return null;
        }
        return Math.hypot(p.x - q.x, p.y - q.y) <= p.radius + q.radius;
    }

    /**
     * Perform the next iteration of the game on the given person.
     *
     * @param {Person} thePerson - the person we're moving
     */
    function next(thePerson) {
        thePerson.next();

        if (!opts.step) {
            thePerson.timerId = _.delay(next, delay, thePerson);
        }
    }

    /**
     * Start animating all people.
     *
     * @public
     */
    function startAll() {
        _.each(people, next);
    }

    /**
     * Pause all people or pause a specific person.
     *
     * @param {Person} [thePerson] - the person we're pausing, or falsy to pause all people
     */
    function pause(thePerson) {
        if (arguments.length === 0) {
            for (var i = people.length - 1; i >= 0; --i) {
                pause(people[i]);
            }
        }
        else if (thePerson.timerId) {
            clearTimeout(thePerson.timerId);
            thePerson.timerId = null;
        }
    }

    /**
     * Pause the entire animation.
     *
     * @public
     */
    function pauseAll() {
        pause();
    }

    /* ********************************************************************
     *
     * Mathy helper functions
     *
     **********************************************************************/
     /**
      * Apply the given vector to the origin point, and return the resulting
      * Cartesian coordinates.
      *
      * @param {Number[]} origin - the origin point in Cartesian coordinates
      * @oaram {Number[]} vector - the vector in polar coordinates, in radians
      * @return {Number[]} the resultant point, in Cartesian coordinates
      */
    function vectorToEndPoint(origin, vector) {
        var x = origin[0], y = origin[1], r = vector[0], theta = vector[1];
        return [x + (r * Math.cos(theta)), y + (r * Math.sin(theta))];
    }

    function antiparallel(angle, isDegrees) {
        var m = isDegrees ? 180 : Math.PI;
        return angle <= 0 ? angle + m : angle - m;
    }

    /**
     * Find the real root(s) of the quadratic equation ax ^ 2 + bx + c = 0.
     *
     * @param {Number} a
     * @param {Number} b
     * @param {Number} c
     * @return {Number[]} an array of real roots of the equation
     */
    function solveQuadratic(a, b, c) {
        var det = b * b - 4 * a * c, sqrt;
        if (det < 0) {
            return [];
        }
        else if (det === 0) {
            return [-b / 2 / a];
        }
        else {
            sqrt = Math.sqrt(det);
            return [(-b + sqrt) / (2 * a), (-b - sqrt) / (2 * a)];
        }
    }

    /**
     * Find the point on circle that is closest to p.
     *
     * @param {{x: Number, y: Number}} p - a point-like object
     * @param {{x: Number, y: Number, radius: Number}} - a circle-like object
     * @return Number[] - the Cartesian coordinates of the point on the circle closest to p
     */
    function circleClosest(p, circle) {
        var x0 = p.x, y0 = p.y;
        var x1 = circle.x, y1 = circle.y, r = circle.radius;

        var roots, d0, d1;

        // find the slope of the line connecting (x0,y0) and (x1,y1)
        var m = (y1 - y0) / (x1 - x0);

        // if the points are on the same vertical line, then return the point on the 
        // circle that's also on that line and above or below the center
        if (isNaN(m)) {
            return p.y > y1 ? [x1, y1 + r] : [x1, y1 - r];
        }

        // frigging math:
        // 
        // the line connecting (x0,y0) and (x1,y1) is: y - y1 = m * (x - x1)
        // the circle centered at (x1,y1) with radius r is: (x - x1) ^ 2 + (y - y1) ^ 2 = r ^ 2
        //
        // solve the top equation for y: y = m * (x - x1) + y1
        // 
        // substitute for y in the bottom equation, also FOIL the first term:
        // (x ^ 2 - 2 * x1 * x + x1 ^ 2) + (m * (x - x1) + y1 - y1) ^ 2 = r ^ 2
        //
        // cancel out y1, square both of the remaining terms:
        // (x ^ 2 - 2 * x1 * x + x1 ^ 2) + m ^ 2 * (x - x1) ^ 2 = r ^ 2
        //
        // FOIL:
        // (x ^ 2 - 2 * x1 * x + x1 ^ 2) + m ^ 2 * (x ^ 2 - 2 * x1 * x + x1 ^ 2) = r ^ 2
        //
        // Distribute m ^ 2 and collect like terms:
        // (m ^ 2 + 1) * x ^ 2 - 2 * x1 * (m ^ 2 + 1) * x + (m ^ 2 + 1) * x1 ^ 2 - r ^ 2 = 0
        roots = solveQuadratic(m * m + 1, -2 * x1 * (m * m + 1), (m * m + 1) * x1 * x1 - r * r);

        // find the coordinates' y-values by plugging them back into the point-slope equation
        roots = _.map(roots, function(x) {
            return [x, m * (x - x1) + y1];
        });

        // and choose the point that's closest. pick the point whose x-coordinate is closer to p.x.
        d0 = Math.abs(p.x - roots[0][0]);
        d1 = Math.abs(p.x - roots[1][0]);
        if (d0 !== d1) {
            return d0 < d1 ? roots[0] : roots[1];
        }
        else {
            return Math.abs(p.y - roots[0][1]) < Math.abs(p.y - roots[1][1]) ? roots[0] : roots[1];
        }
    }

    /**
     * Given an angle measurement, return an equivalent angle in the range (-PI, PI]
     *
     * @param {Number} angle - the angle
     * @param {Boolean} isDegrees - true if the angle unit is degrees, false if radians
     * @return {Number} the equivalent angle in the range of the atan2 function
     */
    function normalizeAngle(angle, isDegrees) {
        var m = isDegrees ? 180 : Math.PI;
        while (angle >= m) {
            angle -= (2 * m);
        }
        while (angle < -(m)) {
            angle += (2 * m);
        }
        return angle;
    }

    /**
     * Represents a Person in this game.
     *
     * @constructor
     * @param {Number} x - The initial x-coordinate
     * @param {Number} y - The initial y-coordinate
     * @param {Number} [radius=10] - The person's radius
     * @param {Number} [speed=1.0] - The person's speed
     */
    function Person(x, y, radius, speed) {
        this.x = x;
        this.y = y;
        this.radius  = radius;
        this.vector  = [speed || 1.0, null];

        /** @type {!SVGGroup} */
        this.svggroup = null;
        /** @type {?number} */
        this.timerId = null;
        /** @const {number} */
        this.id = Person.id++;

        /** @const {Person} */
        var attractedTo  = null,
            repelledFrom = null;

        /** @const Person[] */
        var pointedAtBy  = []; 

        /**
         * Get or set who this person loves.
         *
         * When called with a parameter, this method is a setter. When called 
         * without a parameter, this method is a getter.
         *
         * @param {Person} [attractor] - the person that this person loves
         * @return {Person} - the person that this person loves
         */
        this.attracted = function(attractor) {
            if (attractor && attractor.constructor === Person) {
                attractedTo = attractor;
                attractor.getPointedAtBy().push(this);
            }
            return attractedTo; 
        };

        this.isAttractedTo = function(person) {
            return attractedTo === person;
        };

        /**
         * Get or set who this person hates.
         *
         * When called with a parameter, this method is a setter. When called
         * without a parameter, this method is a getter.
         *
         * @param {Person} [attractor] - the person that this person hates
         * @return {Person} - the person that this person hates
         */
        this.repelled  = function(repellant) {
            if (repellant && repellant.constructor === Person) {
                repelledFrom = repellant;
                repellant.getPointedAtBy().push(this);
            }
            return repelledFrom;
        };

        this.isRepelledFrom = function(person) {
            return repelledFrom === person;
        };

        this.next = function() {
            var rect;
            var lv = Math.atan2(attractedTo.y - this.y, attractedTo.x - this.x),
                hv = Math.atan2(repelledFrom.y - this.y, repelledFrom.x - this.x);

            this.vector = [1.0, normalizeAngle(lv + antiparallel(hv))];

            if (this.y - this.radius < 0 && this.vector[1] < 0) {
                this.vector[1] = (this.vector[1] >= -Math.PI / 2 ? 0 : -Math.PI);
            }
            else if (this.y + this.radius > height && this.vector[1] > 0) {
                this.vector[1] = (this.vector[1] >= -Math.PI / 2 ? 0 : -Math.PI);
            }

            if (this.x - this.radius < 0 && Math.abs(this.vector[1]) > Math.PI / 2) {
                this.vector[1] = Math.sign(this.vector[1]) * Math.PI / 2;
            }
            else if (this.x + this.radius > width && Math.abs(this.vector[1]) < Math.PI / 2) {
                this.vector[1] = Math.sign(this.vector[1]) * Math.PI / 2;
            }

            rect = Math.polar2rect.apply(null, this.vector);
            this.x += rect[0];
            this.y += rect[1];
            if (_.any(people, _.partial(collides, this))) {
                this.x -= rect[0];
                this.y -= rect[1];
                return;
            }

            this.x = Math.max(Math.min(this.x, width - this.radius), this.radius);
            this.y = Math.max(Math.min(this.y, height - this.radius), this.radius);

            this.draw();
        };

        /**
         * Draw the SVG elements associated with this person.
         */
        this.draw = function() {
            if (!this.svggroup) {
                this.svggroup = new SVGGroup(this);
            }
            else {
                this.svggroup.moveSVGElements();
            }   
        };

        this.getPointedAtBy = function() { 
            return pointedAtBy;
        };

        this.getElement = function() {
            return this.svggroup.circle;
        };

        this.highlight = function() {
            var ep = vectorToEndPoint([this.x, this.y], [75, this.vector[1]]);
            this.svggroup.glow = this.svggroup.circle.glow();
            this.svggroup.glow.push(paper.path(
                Raphael.format('M{0},{1}L{2},{3}', this.x, this.y, ep[0], ep[1])).attr({
                    'stroke-width': 5,
                    'arrow-end': 'classic-wide-long'
                }));
        };

        this.unhighlight = function() {
            if (this.svggroup.glow && this.svggroup.glow.forEach) {
                this.svggroup.glow.forEach(function(el) {
                    el.remove();
                });
                delete this.svggroup.glow;                
            }
        };
    }

    /**
     * The collection of SVGElements tied to this Person.
     *
     * @constructor
     */
    function SVGGroup(person) {
        var pt, pathstr;
        this.circle = paper.circle(person.x, person.y, person.radius - 2).attr({
            'fill': colors.shift(),
            'stroke-width': 1
        });

        console.assert(person.attracted());
        pt = circleClosest(person, person.attracted());
        pathstr = Raphael.format('M{0},{1}L{2},{3}', person.x, person.y, pt[0], pt[1]);
        this.lovearrow = paper.path(pathstr).attr({
            'stroke': 'pink',
            'stroke-dasharray': '- ',
            'stroke-width': 2,
            'arrow-end': 'classic-wide-long'
        });
    
        console.assert(person.repelled());
        pt = circleClosest(person, person.repelled());
        pathstr = Raphael.format('M{0},{1}L{2},{3}', person.x, person.y, pt[0], pt[1]);
        this.hatearrow = paper.path(pathstr).attr({
            'stroke': 'black',
            'stroke-dasharray': '. ',
            'stroke-width': 2,
            'arrow-end': 'classic-wide-long'
        });
 
        /**
         * Called when the person is moved.
         */
        this.moveSVGElements = function() {
            var incoming;

            // move the person
            this.circle.attr({
                'cx': person.x,
                'cy': person.y
            });

            // move the love and hate arrows that start at the person
            moveLine(this.lovearrow, { 'start': [person.x, person.y] });
            moveLine(this.hatearrow, { 'start': [person.x, person.y] });

            // move the arrows that terminate at the person
            incoming = person.getPointedAtBy();
            _.each(incoming, function(i) {
                var arrow;
                if (i.isAttractedTo(person)) {
                    arrow = i.svggroup.lovearrow;
                }
                else if (i.isRepelledFrom(person)) {
                    arrow = i.svggroup.hatearrow;
                }
                else {
                    console.assert(false, 'incoming arrow must come from a lover or a hater');
                }

                moveLine(arrow, { 'end': circleClosest(i, person)});
            });
        };

        function moveLine(element, newcoords) {
            var p = element.attr('path'), start, end;
            if (p.length > 2) {
                console.warn('path attribute contains multiple lines: %s', p);
            }

            start = newcoords.start || p[0].slice(1);
            end   = newcoords.end   || p[1].slice(1);

            element.attr({
                path: Raphael.format('M{0},{1}L{2},{3}', start[0], start[1], end[0], end[1])
            });
        }
    }

    return {
        init: initialize,
        pause: pauseAll,
        unpause: startAll,
    };
}

if (Math.sign === undefined) {
    Math.sign = function sign(x) {
        'use strict';
        x = +x; // convert to a number
        if (x === 0 || isNaN(x)) {
            return x;
        }
        return x > 0 ? 1 : -1;
    };    
}

if (Math.hypot === undefined) {
    Math.hypot = function(x, y) {
        'use strict';
        return Math.sqrt(x * x + y * y);
    };
}

if (Math.polar2rect === undefined) {
    Math.polar2rect = function(r, theta) {
        'use strict';
        return [r * Math.cos(theta), r * Math.sin(theta)];
    };
}
    
if (Math.rect2polar === undefined) {
    Math.rect2polar = function(x, y) {
        'use strict';
        return [Math.hypot(x, y), Math.atan2(y, x)];
    };
}